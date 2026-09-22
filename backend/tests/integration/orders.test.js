import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers/testApp.js";
import { resetDatabase, prisma } from "../helpers/db.js";
import { createStaffUser } from "../helpers/fixtures.js";

const app = createTestApp();

async function seedPizza({ stock = 10, withPackaging = false, packagingStock = 10 } = {}) {
  const category = await prisma.category.create({ data: { name: "Pratos" } });
  const menuItem = await prisma.menuItem.create({
    data: { name: "Pizza", description: "Pizza de teste", price: 20, categoryId: category.id },
  });
  const flour = await prisma.ingredient.create({
    data: { name: "Farinha", unit: "kg", currentStock: stock, minStock: 1 },
  });
  await prisma.recipeIngredient.create({ data: { menuItemId: menuItem.id, ingredientId: flour.id, quantityPerUnit: 2 } });

  let box = null;
  if (withPackaging) {
    box = await prisma.packagingItem.create({
      data: { name: "Caixa", unit: "un", currentStock: packagingStock, minStock: 1 },
    });
    await prisma.recipePackaging.create({ data: { menuItemId: menuItem.id, packagingItemId: box.id, quantityPerUnit: 1 } });
  }
  return { menuItem, flour, box };
}

describe("Pedidos — leitura", () => {
  let token;

  beforeEach(async () => {
    await resetDatabase();
    token = (await createStaffUser({ role: "WAITER" })).token;
  });

  it("GET / exige autenticação", async () => {
    const res = await request(app).get("/api/orders");
    expect(res.status).toBe(401);
  });

  it("GET / lista todos os pedidos, mais recentes primeiro", async () => {
    const { menuItem } = await seedPizza();
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "TAKEAWAY", items: [{ menuItemId: menuItem.id, quantity: 1 }] });
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "TAKEAWAY", items: [{ menuItemId: menuItem.id, quantity: 2 }] });

    const res = await request(app).get("/api/orders").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(Number(res.body[0].total)).toBe(40);
  });

  it("GET / filtra por status, type e tableId", async () => {
    const { menuItem } = await seedPizza();
    const table = await prisma.restaurantTable.create({ data: { number: 1, capacity: 4 } });
    const dineIn = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "DINE_IN", tableId: table.id, items: [{ menuItemId: menuItem.id, quantity: 1 }] });
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "TAKEAWAY", items: [{ menuItemId: menuItem.id, quantity: 1 }] });

    const byType = await request(app).get("/api/orders?type=DINE_IN").set("Authorization", `Bearer ${token}`);
    expect(byType.body).toHaveLength(1);
    expect(byType.body[0].id).toBe(dineIn.body.id);

    const byTable = await request(app)
      .get(`/api/orders?tableId=${table.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(byTable.body).toHaveLength(1);

    const byStatus = await request(app).get("/api/orders?status=PENDING").set("Authorization", `Bearer ${token}`);
    expect(byStatus.body).toHaveLength(2);

    const none = await request(app).get("/api/orders?status=DELIVERED").set("Authorization", `Bearer ${token}`);
    expect(none.body).toHaveLength(0);
  });

  it("GET /:id devolve o pedido; 404 para id inexistente", async () => {
    const { menuItem } = await seedPizza();
    const created = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "TAKEAWAY", items: [{ menuItemId: menuItem.id, quantity: 1 }] });

    const ok = await request(app).get(`/api/orders/${created.body.id}`).set("Authorization", `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.id).toBe(created.body.id);

    const missing = await request(app).get("/api/orders/inexistente").set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(404);
  });
});

describe("Pedidos — criação e consumo de estoque", () => {
  let token;

  beforeEach(async () => {
    await resetDatabase();
    token = (await createStaffUser({ role: "WAITER" })).token;
  });

  it("cria um pedido de salão, consome os ingredientes e ocupa a mesa", async () => {
    const { menuItem, flour } = await seedPizza({ stock: 10 });
    const table = await prisma.restaurantTable.create({ data: { number: 1, capacity: 4 } });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "DINE_IN", tableId: table.id, items: [{ menuItemId: menuItem.id, quantity: 3 }] });

    expect(res.status).toBe(201);
    expect(Number(res.body.total)).toBe(60);

    const updatedFlour = await prisma.ingredient.findUnique({ where: { id: flour.id } });
    expect(Number(updatedFlour.currentStock)).toBeCloseTo(4);
    const updatedTable = await prisma.restaurantTable.findUnique({ where: { id: table.id } });
    expect(updatedTable.status).toBe("OCCUPIED");
    const movements = await prisma.stockMovement.findMany({ where: { orderId: res.body.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0].reason).toBe("SALE");
  });

  it("cria um pedido para viagem (sem mesa)", async () => {
    const { menuItem } = await seedPizza();
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "TAKEAWAY", customerName: "Zé", items: [{ menuItemId: menuItem.id, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body.tableId).toBeNull();
    expect(res.body.customerName).toBe("Zé");
  });

  it("cria um pedido de entrega com endereço", async () => {
    const { menuItem } = await seedPizza();
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "DELIVERY",
        deliveryAddress: "Rua 1, 100",
        customerPhone: "9999",
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.deliveryAddress).toBe("Rua 1, 100");
  });

  it("DINE_IN sem tableId → 400", async () => {
    const { menuItem } = await seedPizza();
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "DINE_IN", items: [{ menuItemId: menuItem.id, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it("DELIVERY sem deliveryAddress → 400", async () => {
    const { menuItem } = await seedPizza();
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "DELIVERY", items: [{ menuItemId: menuItem.id, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it("item de cardápio inexistente → 400", async () => {
    await seedPizza();
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "TAKEAWAY", items: [{ menuItemId: "nao-existe", quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/não existem/i);
  });

  it("payload sem itens → 400", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "TAKEAWAY", items: [] });
    expect(res.status).toBe(400);
  });

  it("recusa o pedido quando falta estoque e não grava nada", async () => {
    const { menuItem, flour } = await seedPizza({ stock: 1 });
    const table = await prisma.restaurantTable.create({ data: { number: 2, capacity: 2 } });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "DINE_IN", tableId: table.id, items: [{ menuItemId: menuItem.id, quantity: 1 }] });

    expect(res.status).toBe(400);
    await expect(prisma.order.findMany()).resolves.toHaveLength(0);
    expect(Number((await prisma.ingredient.findUnique({ where: { id: flour.id } })).currentStock)).toBe(1);
    expect((await prisma.restaurantTable.findUnique({ where: { id: table.id } })).status).toBe("FREE");
  });

  it("KITCHEN não pode criar pedido (403)", async () => {
    const kitchen = (await createStaffUser({ role: "KITCHEN" })).token;
    const { menuItem } = await seedPizza();
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${kitchen}`)
      .send({ type: "TAKEAWAY", items: [{ menuItemId: menuItem.id, quantity: 1 }] });
    expect(res.status).toBe(403);
  });
});

describe("Pedidos — mudança de status", () => {
  let waiterToken;

  beforeEach(async () => {
    await resetDatabase();
    waiterToken = (await createStaffUser({ role: "WAITER" })).token;
  });

  async function createDineIn(tableNumber = 1, quantity = 2) {
    const { menuItem, flour } = await seedPizza({ stock: 20 });
    const table = await prisma.restaurantTable.create({ data: { number: tableNumber, capacity: 4 } });
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ type: "DINE_IN", tableId: table.id, items: [{ menuItemId: menuItem.id, quantity }] });
    return { orderId: res.body.id, tableId: table.id, flour, menuItem };
  }

  it("404 ao mudar status de pedido inexistente", async () => {
    const res = await request(app)
      .patch("/api/orders/inexistente/status")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ status: "CONFIRMED" });
    expect(res.status).toBe(404);
  });

  it("rejeita um status inválido (400)", async () => {
    const { orderId } = await createDineIn(10);
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ status: "TELEPORTADO" });
    expect(res.status).toBe(400);
  });

  it("CONFIRMED não mexe na mesa", async () => {
    const { orderId, tableId } = await createDineIn(11);
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ status: "CONFIRMED" });
    expect(res.status).toBe(200);
    expect((await prisma.restaurantTable.findUnique({ where: { id: tableId } })).status).toBe("OCCUPIED");
  });

  it("COMPLETED libera a mesa", async () => {
    const { orderId, tableId } = await createDineIn(12);
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ status: "COMPLETED" });
    expect(res.status).toBe(200);
    expect((await prisma.restaurantTable.findUnique({ where: { id: tableId } })).status).toBe("FREE");
  });

  it("CANCELLED devolve o estoque e libera a mesa", async () => {
    const { orderId, tableId, flour } = await createDineIn(13, 2);
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ status: "CANCELLED" });
    expect(res.status).toBe(200);
    expect(Number((await prisma.ingredient.findUnique({ where: { id: flour.id } })).currentStock)).toBe(20);
    expect((await prisma.restaurantTable.findUnique({ where: { id: tableId } })).status).toBe("FREE");
  });

  it("cancelar duas vezes não devolve o estoque em dobro", async () => {
    const { orderId, flour } = await createDineIn(14, 2);
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ status: "CANCELLED" });
    const stockAfterFirst = Number((await prisma.ingredient.findUnique({ where: { id: flour.id } })).currentStock);

    const second = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ status: "CANCELLED" });

    expect(second.status).toBe(200);
    expect(Number((await prisma.ingredient.findUnique({ where: { id: flour.id } })).currentStock)).toBe(stockAfterFirst);
  });

  it("um pedido sem mesa (TAKEAWAY) pode ir a COMPLETED sem tocar em nenhuma mesa", async () => {
    const { menuItem } = await seedPizza();
    const created = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ type: "TAKEAWAY", items: [{ menuItemId: menuItem.id, quantity: 1 }] });

    const res = await request(app)
      .patch(`/api/orders/${created.body.id}/status`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ status: "COMPLETED" });
    expect(res.status).toBe(200);
  });

  it("DELIVERY (papel) também pode mudar o status", async () => {
    const deliveryToken = (await createStaffUser({ role: "DELIVERY" })).token;
    const { orderId } = await createDineIn(15);
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${deliveryToken}`)
      .send({ status: "CONFIRMED" });
    expect(res.status).toBe(200);
  });
});

describe("Pedidos — status dos itens e recomputo do pedido", () => {
  let waiterToken;
  let kitchenToken;

  beforeEach(async () => {
    await resetDatabase();
    waiterToken = (await createStaffUser({ role: "WAITER" })).token;
    kitchenToken = (await createStaffUser({ role: "KITCHEN" })).token;
  });

  async function createOrderWithTwoItems() {
    const { menuItem } = await seedPizza({ stock: 50 });
    const menuItem2 = await prisma.menuItem.create({
      data: {
        name: "Refri",
        description: "Refrigerante",
        price: 8,
        categoryId: (await prisma.menuItem.findUnique({ where: { id: menuItem.id } })).categoryId,
      },
    });
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({
        type: "TAKEAWAY",
        items: [
          { menuItemId: menuItem.id, quantity: 1 },
          { menuItemId: menuItem2.id, quantity: 1 },
        ],
      });
    return { orderId: res.body.id, itemIds: res.body.items.map((i) => i.id) };
  }

  it("404 quando o item não pertence ao pedido informado", async () => {
    const { orderId } = await createOrderWithTwoItems();
    const res = await request(app)
      .patch(`/api/orders/${orderId}/items/item-fantasma/status`)
      .set("Authorization", `Bearer ${kitchenToken}`)
      .send({ status: "PREPARING" });
    expect(res.status).toBe(404);
  });

  it("iniciar um item leva o pedido a PREPARING; concluir todos leva a READY", async () => {
    const { orderId, itemIds } = await createOrderWithTwoItems();

    const p1 = await request(app)
      .patch(`/api/orders/${orderId}/items/${itemIds[0]}/status`)
      .set("Authorization", `Bearer ${kitchenToken}`)
      .send({ status: "PREPARING" });
    expect(p1.body.status).toBe("PREPARING");

    await request(app)
      .patch(`/api/orders/${orderId}/items/${itemIds[1]}/status`)
      .set("Authorization", `Bearer ${kitchenToken}`)
      .send({ status: "PREPARING" });

    await request(app)
      .patch(`/api/orders/${orderId}/items/${itemIds[0]}/status`)
      .set("Authorization", `Bearer ${kitchenToken}`)
      .send({ status: "READY" });
    const done = await request(app)
      .patch(`/api/orders/${orderId}/items/${itemIds[1]}/status`)
      .set("Authorization", `Bearer ${kitchenToken}`)
      .send({ status: "READY" });
    expect(done.body.status).toBe("READY");
  });

  it("voltar um item de READY para PENDING faz o pedido retroceder de READY", async () => {
    const { orderId, itemIds } = await createOrderWithTwoItems();
    for (const id of itemIds) {
      await request(app)
        .patch(`/api/orders/${orderId}/items/${id}/status`)
        .set("Authorization", `Bearer ${kitchenToken}`)
        .send({ status: "READY" });
    }
    const back = await request(app)
      .patch(`/api/orders/${orderId}/items/${itemIds[0]}/status`)
      .set("Authorization", `Bearer ${kitchenToken}`)
      .send({ status: "PENDING" });
    expect(back.body.status).toBe("PREPARING");
  });

  it("repetir o mesmo status de item não muda o status do pedido (retorno antecipado)", async () => {
    const { orderId, itemIds } = await createOrderWithTwoItems();
    const first = await request(app)
      .patch(`/api/orders/${orderId}/items/${itemIds[0]}/status`)
      .set("Authorization", `Bearer ${kitchenToken}`)
      .send({ status: "PENDING" });
    expect(first.body.status).toBe("CONFIRMED");

    const second = await request(app)
      .patch(`/api/orders/${orderId}/items/${itemIds[0]}/status`)
      .set("Authorization", `Bearer ${kitchenToken}`)
      .send({ status: "PENDING" });
    expect(second.status).toBe(200);
    expect(second.body.status).toBe("CONFIRMED");
  });

  it("apenas ADMIN/KITCHEN mudam status de item (garçom → 403)", async () => {
    const { orderId, itemIds } = await createOrderWithTwoItems();
    const res = await request(app)
      .patch(`/api/orders/${orderId}/items/${itemIds[0]}/status`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ status: "PREPARING" });
    expect(res.status).toBe(403);
  });

  it("rejeita um status de item inválido (400)", async () => {
    const { orderId, itemIds } = await createOrderWithTwoItems();
    const res = await request(app)
      .patch(`/api/orders/${orderId}/items/${itemIds[0]}/status`)
      .set("Authorization", `Bearer ${kitchenToken}`)
      .send({ status: "QUEIMADO" });
    expect(res.status).toBe(400);
  });
});

describe("Pedidos — edição de itens de um pedido aberto", () => {
  let waiterToken;
  let kitchenToken;
  let menuItem;
  let flour;
  let orderId;

  beforeEach(async () => {
    await resetDatabase();
    waiterToken = (await createStaffUser({ role: "WAITER" })).token;
    kitchenToken = (await createStaffUser({ role: "KITCHEN" })).token;
    ({ menuItem, flour } = await seedPizza({ stock: 50 }));
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ type: "TAKEAWAY", items: [{ menuItemId: menuItem.id, quantity: 1 }] });
    orderId = res.body.id;
  });

  it("adicionar item consome mais estoque, sobe o total e leva o pedido a CONFIRMED", async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ menuItemId: menuItem.id, quantity: 1 });

    expect(res.status).toBe(201);
    expect(Number(res.body.total)).toBe(40);
    expect(res.body.status).toBe("CONFIRMED");
    expect(Number((await prisma.ingredient.findUnique({ where: { id: flour.id } })).currentStock)).toBe(46);
  });

  it("adicionar item: 404 pedido, 400 item inexistente, 403 cozinha", async () => {
    const missing = await request(app)
      .post("/api/orders/inexistente/items")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ menuItemId: menuItem.id, quantity: 1 });
    expect(missing.status).toBe(404);

    const badItem = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ menuItemId: "nao-existe", quantity: 1 });
    expect(badItem.status).toBe(400);

    const forbidden = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set("Authorization", `Bearer ${kitchenToken}`)
      .send({ menuItemId: menuItem.id, quantity: 1 });
    expect(forbidden.status).toBe(403);
  });

  it("não permite adicionar item a um pedido já não editável", async () => {
    await prisma.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
    const res = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ menuItemId: menuItem.id, quantity: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/não pode mais ser alterado/i);
  });

  it("aumentar a quantidade de um item consome a diferença", async () => {
    const item = (await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })).items[0];
    const res = await request(app)
      .patch(`/api/orders/${orderId}/items/${item.id}/quantity`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ quantity: 3 });

    expect(res.status).toBe(200);
    expect(Number(res.body.total)).toBe(60);
    expect(Number((await prisma.ingredient.findUnique({ where: { id: flour.id } })).currentStock)).toBe(44);
  });

  it("diminuir a quantidade de um item devolve a diferença ao estoque", async () => {
    const item = (await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })).items[0];
    await request(app)
      .patch(`/api/orders/${orderId}/items/${item.id}/quantity`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ quantity: 3 });

    const res = await request(app)
      .patch(`/api/orders/${orderId}/items/${item.id}/quantity`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ quantity: 1 });

    expect(res.status).toBe(200);
    expect(Number((await prisma.ingredient.findUnique({ where: { id: flour.id } })).currentStock)).toBe(48);
  });

  it("definir a mesma quantidade não move estoque", async () => {
    const item = (await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })).items[0];
    const before = Number((await prisma.ingredient.findUnique({ where: { id: flour.id } })).currentStock);
    const res = await request(app)
      .patch(`/api/orders/${orderId}/items/${item.id}/quantity`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ quantity: 1 });
    expect(res.status).toBe(200);
    expect(Number((await prisma.ingredient.findUnique({ where: { id: flour.id } })).currentStock)).toBe(before);
  });

  it("quantidade: 404 pedido, 404 item, 400 quantidade inválida, 400 pedido não editável", async () => {
    const item = (await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })).items[0];

    expect(
      (
        await request(app)
          .patch(`/api/orders/inexistente/items/${item.id}/quantity`)
          .set("Authorization", `Bearer ${waiterToken}`)
          .send({ quantity: 2 })
      ).status,
    ).toBe(404);

    expect(
      (
        await request(app)
          .patch(`/api/orders/${orderId}/items/item-fantasma/quantity`)
          .set("Authorization", `Bearer ${waiterToken}`)
          .send({ quantity: 2 })
      ).status,
    ).toBe(404);

    expect(
      (
        await request(app)
          .patch(`/api/orders/${orderId}/items/${item.id}/quantity`)
          .set("Authorization", `Bearer ${waiterToken}`)
          .send({ quantity: 0 })
      ).status,
    ).toBe(400);

    await prisma.order.update({ where: { id: orderId }, data: { status: "COMPLETED" } });
    expect(
      (
        await request(app)
          .patch(`/api/orders/${orderId}/items/${item.id}/quantity`)
          .set("Authorization", `Bearer ${waiterToken}`)
          .send({ quantity: 2 })
      ).status,
    ).toBe(400);
  });

  it("remover um item devolve o estoque e recalcula o total", async () => {
    await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ menuItemId: menuItem.id, quantity: 2 });
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    const first = order.items[0];

    const res = await request(app)
      .delete(`/api/orders/${orderId}/items/${first.id}`)
      .set("Authorization", `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(Number(res.body.total)).toBe(40);
  });

  it("remover item: 404 pedido, 404 item, 400 no último item, 400 pedido não editável", async () => {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    const only = order.items[0];

    expect(
      (
        await request(app)
          .delete(`/api/orders/inexistente/items/${only.id}`)
          .set("Authorization", `Bearer ${waiterToken}`)
      ).status,
    ).toBe(404);

    expect(
      (
        await request(app)
          .delete(`/api/orders/${orderId}/items/item-fantasma`)
          .set("Authorization", `Bearer ${waiterToken}`)
      ).status,
    ).toBe(404);

    const lastItem = await request(app)
      .delete(`/api/orders/${orderId}/items/${only.id}`)
      .set("Authorization", `Bearer ${waiterToken}`);
    expect(lastItem.status).toBe(400);
    expect(lastItem.body.error).toMatch(/último item/i);

    await prisma.orderItem.create({
      data: { orderId, menuItemId: menuItem.id, quantity: 1, unitPrice: 20 },
    });
    await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
    const notEditable = await request(app)
      .delete(`/api/orders/${orderId}/items/${only.id}`)
      .set("Authorization", `Bearer ${waiterToken}`);
    expect(notEditable.status).toBe(400);
  });
});

describe("Pedidos — despacho de entrega (assign-driver)", () => {
  let waiterToken;
  let deliveryToken;

  beforeEach(async () => {
    await resetDatabase();
    waiterToken = (await createStaffUser({ role: "WAITER" })).token;
    deliveryToken = (await createStaffUser({ role: "DELIVERY" })).token;
  });

  async function createDeliveryOrder({ ready = true } = {}) {
    const { menuItem, flour, box } = await seedPizza({ withPackaging: true, stock: 50, packagingStock: 10 });
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({
        type: "DELIVERY",
        deliveryAddress: "Rua X, 1",
        items: [{ menuItemId: menuItem.id, quantity: 2 }],
      });
    const orderId = res.body.id;
    if (ready) await prisma.order.update({ where: { id: orderId }, data: { status: "READY" } });
    return { orderId, flour, box };
  }

  it("despacha um pedido pronto: baixa embalagem, grava motorista e vai a OUT_FOR_DELIVERY", async () => {
    const { orderId, box } = await createDeliveryOrder({ ready: true });

    const res = await request(app)
      .patch(`/api/orders/${orderId}/assign-driver`)
      .set("Authorization", `Bearer ${deliveryToken}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("OUT_FOR_DELIVERY");
    expect(res.body.driver.role).toBe("DELIVERY");
    expect(Number((await prisma.packagingItem.findUnique({ where: { id: box.id } })).currentStock)).toBe(8);
  });

  it("cancelar depois do despacho devolve ingredientes e embalagem", async () => {
    const { orderId, flour, box } = await createDeliveryOrder({ ready: true });
    await request(app)
      .patch(`/api/orders/${orderId}/assign-driver`)
      .set("Authorization", `Bearer ${deliveryToken}`)
      .send();

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${deliveryToken}`)
      .send({ status: "CANCELLED" });

    expect(res.status).toBe(200);
    expect(Number((await prisma.ingredient.findUnique({ where: { id: flour.id } })).currentStock)).toBe(50);
    expect(Number((await prisma.packagingItem.findUnique({ where: { id: box.id } })).currentStock)).toBe(10);
  });

  it("404 para pedido inexistente", async () => {
    const res = await request(app)
      .patch("/api/orders/inexistente/assign-driver")
      .set("Authorization", `Bearer ${deliveryToken}`)
      .send();
    expect(res.status).toBe(404);
  });

  it("400 se o pedido não é de entrega", async () => {
    const { menuItem } = await seedPizza();
    const created = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ type: "TAKEAWAY", items: [{ menuItemId: menuItem.id, quantity: 1 }] });
    await prisma.order.update({ where: { id: created.body.id }, data: { status: "READY" } });

    const res = await request(app)
      .patch(`/api/orders/${created.body.id}/assign-driver`)
      .set("Authorization", `Bearer ${deliveryToken}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/entrega/i);
  });

  it("400 se o pedido de entrega ainda não está pronto", async () => {
    const { orderId } = await createDeliveryOrder({ ready: false });
    const res = await request(app)
      .patch(`/api/orders/${orderId}/assign-driver`)
      .set("Authorization", `Bearer ${deliveryToken}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/não está pronto/i);
  });

  it("403 para papel WAITER", async () => {
    const { orderId } = await createDeliveryOrder({ ready: true });
    const res = await request(app)
      .patch(`/api/orders/${orderId}/assign-driver`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send();
    expect(res.status).toBe(403);
  });
});
