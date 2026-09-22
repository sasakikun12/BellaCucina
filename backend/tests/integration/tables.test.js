import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers/testApp.js";
import { resetDatabase, prisma } from "../helpers/db.js";
import { createStaffUser } from "../helpers/fixtures.js";

describe("Mesas (/api/tables)", () => {
  const app = createTestApp();
  let adminToken;
  let waiterToken;

  beforeEach(async () => {
    await resetDatabase();
    adminToken = (await createStaffUser({ role: "ADMIN", email: "admin@teste.com" })).token;
    waiterToken = (await createStaffUser({ role: "WAITER", email: "waiter@teste.com" })).token;
  });

  it("GET exige autenticação", async () => {
    const res = await request(app).get("/api/tables");
    expect(res.status).toBe(401);
  });

  it("GET lista as mesas ordenadas por número, com os pedidos ativos embutidos", async () => {
    const { user } = await createStaffUser({ role: "WAITER", email: "w2@teste.com" });
    const category = await prisma.category.create({ data: { name: "Pratos" } });
    const menuItem = await prisma.menuItem.create({
      data: { name: "Sopa", description: "Sopa do dia", price: 12, categoryId: category.id },
    });
    const t2 = await prisma.restaurantTable.create({ data: { number: 2, capacity: 2 } });
    await prisma.restaurantTable.create({ data: { number: 1, capacity: 4 } });
    await prisma.order.create({
      data: {
        type: "DINE_IN",
        tableId: t2.id,
        status: "PREPARING",
        createdById: user.id,
        total: 12,
        items: { create: [{ menuItemId: menuItem.id, quantity: 1, unitPrice: 12 }] },
      },
    });
    await prisma.order.create({
      data: { type: "DINE_IN", tableId: t2.id, status: "COMPLETED", createdById: user.id, total: 0 },
    });

    const res = await request(app).get("/api/tables").set("Authorization", `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.number)).toEqual([1, 2]);
    const table2 = res.body.find((t) => t.number === 2);
    expect(table2.orders).toHaveLength(1);
    expect(table2.orders[0].items[0].menuItem.name).toBe("Sopa");
  });

  it("ADMIN cria uma mesa", async () => {
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ number: 7, capacity: 6 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ number: 7, capacity: 6, status: "FREE" });
  });

  it("criar mesa exige papel ADMIN", async () => {
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ number: 8, capacity: 2 });
    expect(res.status).toBe(403);
  });

  it("rejeita payload inválido ao criar mesa (400)", async () => {
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ number: -1, capacity: 0 });
    expect(res.status).toBe(400);
  });

  it("ADMIN edita capacidade/número de uma mesa (PUT parcial)", async () => {
    const table = await prisma.restaurantTable.create({ data: { number: 3, capacity: 2 } });

    const res = await request(app)
      .put(`/api/tables/${table.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ capacity: 8 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ number: 3, capacity: 8 });
  });

  it("editar mesa exige papel ADMIN", async () => {
    const table = await prisma.restaurantTable.create({ data: { number: 4, capacity: 2 } });
    const res = await request(app)
      .put(`/api/tables/${table.id}`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ capacity: 8 });
    expect(res.status).toBe(403);
  });

  it("garçom atualiza o status de uma mesa (emite table:updated)", async () => {
    const table = await prisma.restaurantTable.create({ data: { number: 5, capacity: 4 } });

    const res = await request(app)
      .patch(`/api/tables/${table.id}/status`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ status: "RESERVED" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("RESERVED");
  });

  it("rejeita um status de mesa inválido (400)", async () => {
    const table = await prisma.restaurantTable.create({ data: { number: 6, capacity: 4 } });
    const res = await request(app)
      .patch(`/api/tables/${table.id}/status`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ status: "VOANDO" });
    expect(res.status).toBe(400);
  });

  it("atualizar status exige papel ADMIN ou WAITER", async () => {
    const kitchenToken = (await createStaffUser({ role: "KITCHEN" })).token;
    const table = await prisma.restaurantTable.create({ data: { number: 9, capacity: 4 } });
    const res = await request(app)
      .patch(`/api/tables/${table.id}/status`)
      .set("Authorization", `Bearer ${kitchenToken}`)
      .send({ status: "OCCUPIED" });
    expect(res.status).toBe(403);
  });

  it("ADMIN exclui uma mesa livre", async () => {
    const table = await prisma.restaurantTable.create({ data: { number: 10, capacity: 2 } });
    const res = await request(app).delete(`/api/tables/${table.id}`).set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    await expect(prisma.restaurantTable.findUnique({ where: { id: table.id } })).resolves.toBeNull();
  });

  it("excluir uma mesa com pedidos desvincula o pedido (tableId vira null), não falha", async () => {
    const { user } = await createStaffUser({ role: "ADMIN", email: "a2@teste.com" });
    const category = await prisma.category.create({ data: { name: "Bebidas" } });
    const menuItem = await prisma.menuItem.create({
      data: { name: "Água", description: "Água mineral", price: 5, categoryId: category.id },
    });
    const table = await prisma.restaurantTable.create({ data: { number: 11, capacity: 2 } });
    const order = await prisma.order.create({
      data: {
        type: "DINE_IN",
        tableId: table.id,
        createdById: user.id,
        total: 5,
        items: { create: [{ menuItemId: menuItem.id, quantity: 1, unitPrice: 5 }] },
      },
    });

    const res = await request(app).delete(`/api/tables/${table.id}`).set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder.tableId).toBeNull();
  });

  it("excluir uma mesa inexistente propaga erro do Prisma (500)", async () => {
    const res = await request(app).delete("/api/tables/inexistente").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
  });
});
