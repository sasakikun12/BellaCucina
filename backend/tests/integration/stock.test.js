import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers/testApp.js";
import { resetDatabase, prisma } from "../helpers/db.js";
import { createStaffUser } from "../helpers/fixtures.js";

const app = createTestApp();

describe("Estoque — ingredientes", () => {
  let token;

  beforeEach(async () => {
    await resetDatabase();
    token = (await createStaffUser({ role: "ADMIN" })).token;
  });

  it("GET /ingredients exige apenas autenticação (qualquer papel)", async () => {
    const waiter = (await createStaffUser({ role: "WAITER" })).token;
    await prisma.ingredient.create({ data: { name: "Farinha", unit: "kg", currentStock: 10, minStock: 2 } });

    const semAuth = await request(app).get("/api/stock/ingredients");
    expect(semAuth.status).toBe(401);

    const res = await request(app).get("/api/stock/ingredients").set("Authorization", `Bearer ${waiter}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("cria um ingrediente", async () => {
    const res = await request(app)
      .post("/api/stock/ingredients")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Farinha", unit: "kg", currentStock: 10, minStock: 2 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Farinha");
    expect(Number(res.body.currentStock)).toBe(10);
  });

  it("cria um ingrediente sem estoque inicial (usa os defaults 0/0)", async () => {
    const res = await request(app)
      .post("/api/stock/ingredients")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Orégano", unit: "g" });

    expect(res.status).toBe(201);
    expect(Number(res.body.currentStock)).toBe(0);
    expect(Number(res.body.minStock)).toBe(0);
  });

  it("criar ingrediente exige papel ADMIN", async () => {
    const waiter = (await createStaffUser({ role: "WAITER" })).token;
    const res = await request(app)
      .post("/api/stock/ingredients")
      .set("Authorization", `Bearer ${waiter}`)
      .send({ name: "X", unit: "kg" });
    expect(res.status).toBe(403);
  });

  it("rejeita payload inválido ao criar ingrediente (400)", async () => {
    const res = await request(app)
      .post("/api/stock/ingredients")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "", unit: "" });
    expect(res.status).toBe(400);
  });

  it("edita nome/unidade/minStock de um ingrediente (PUT parcial não mexe no currentStock)", async () => {
    const ingredient = await prisma.ingredient.create({
      data: { name: "Sal", unit: "kg", currentStock: 5, minStock: 1 },
    });

    const res = await request(app)
      .put(`/api/stock/ingredients/${ingredient.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sal Grosso", unit: "g", minStock: 3, currentStock: 999 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Sal Grosso", unit: "g" });
    expect(Number(res.body.minStock)).toBe(3);
    expect(Number(res.body.currentStock)).toBe(5);
  });

  it("PUT em ingrediente inexistente responde 404", async () => {
    const res = await request(app)
      .put("/api/stock/ingredients/inexistente")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nada" });
    expect(res.status).toBe(404);
  });

  it("editar ingrediente exige papel ADMIN", async () => {
    const waiter = (await createStaffUser({ role: "WAITER" })).token;
    const ingredient = await prisma.ingredient.create({ data: { name: "Sal", unit: "kg" } });
    const res = await request(app)
      .put(`/api/stock/ingredients/${ingredient.id}`)
      .set("Authorization", `Bearer ${waiter}`)
      .send({ name: "X" });
    expect(res.status).toBe(403);
  });

  it("RESTOCK com delta positivo aumenta o estoque", async () => {
    const ingredient = await prisma.ingredient.create({
      data: { name: "Sal", unit: "kg", currentStock: 5, minStock: 1 },
    });

    const res = await request(app)
      .patch(`/api/stock/ingredients/${ingredient.id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: 3, reason: "RESTOCK" });

    expect(res.status).toBe(200);
    expect(Number(res.body.currentStock)).toBe(8);
  });

  it("adjust sem 'reason' usa o default RESTOCK", async () => {
    const ingredient = await prisma.ingredient.create({
      data: { name: "Sal", unit: "kg", currentStock: 5, minStock: 1 },
    });

    const res = await request(app)
      .patch(`/api/stock/ingredients/${ingredient.id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: 1 });

    expect(res.status).toBe(200);
    const [movement] = await prisma.stockMovement.findMany({ where: { ingredientId: ingredient.id } });
    expect(movement.reason).toBe("RESTOCK");
  });

  it("ADJUSTMENT com delta negativo reduz o estoque", async () => {
    const ingredient = await prisma.ingredient.create({
      data: { name: "Sal", unit: "kg", currentStock: 5, minStock: 1 },
    });

    const res = await request(app)
      .patch(`/api/stock/ingredients/${ingredient.id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: -2, reason: "ADJUSTMENT" });

    expect(res.status).toBe(200);
    expect(Number(res.body.currentStock)).toBe(3);
  });

  it("rejeita delta zero (400)", async () => {
    const ingredient = await prisma.ingredient.create({ data: { name: "Sal", unit: "kg", currentStock: 5 } });
    const res = await request(app)
      .patch(`/api/stock/ingredients/${ingredient.id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: 0 });
    expect(res.status).toBe(400);
  });

  it("rejeita um ajuste que deixaria o estoque negativo", async () => {
    const ingredient = await prisma.ingredient.create({
      data: { name: "Sal", unit: "kg", currentStock: 2, minStock: 1 },
    });

    const res = await request(app)
      .patch(`/api/stock/ingredients/${ingredient.id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: -5, reason: "ADJUSTMENT" });

    expect(res.status).toBe(400);
    const unchanged = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    expect(Number(unchanged.currentStock)).toBe(2);
  });

  it("adjust em ingrediente inexistente responde 404", async () => {
    const res = await request(app)
      .patch("/api/stock/ingredients/inexistente/adjust")
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: 1 });
    expect(res.status).toBe(404);
  });

  it("adjust exige papel ADMIN", async () => {
    const waiter = (await createStaffUser({ role: "WAITER" })).token;
    const ingredient = await prisma.ingredient.create({ data: { name: "Sal", unit: "kg", currentStock: 5 } });
    const res = await request(app)
      .patch(`/api/stock/ingredients/${ingredient.id}/adjust`)
      .set("Authorization", `Bearer ${waiter}`)
      .send({ delta: 1 });
    expect(res.status).toBe(403);
  });

  it("exclui um ingrediente que não está em nenhuma receita", async () => {
    const ingredient = await prisma.ingredient.create({ data: { name: "Sal", unit: "kg" } });
    const res = await request(app)
      .delete(`/api/stock/ingredients/${ingredient.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
    await expect(prisma.ingredient.findUnique({ where: { id: ingredient.id } })).resolves.toBeNull();
  });

  it("bloqueia (409) a exclusão de um ingrediente usado em uma receita", async () => {
    const category = await prisma.category.create({ data: { name: "Pratos" } });
    const menuItem = await prisma.menuItem.create({
      data: { name: "Pão", description: "Pão caseiro", price: 4, categoryId: category.id },
    });
    const ingredient = await prisma.ingredient.create({ data: { name: "Farinha", unit: "kg", currentStock: 10 } });
    await prisma.recipeIngredient.create({
      data: { menuItemId: menuItem.id, ingredientId: ingredient.id, quantityPerUnit: 1 },
    });

    const res = await request(app)
      .delete(`/api/stock/ingredients/${ingredient.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
    await expect(prisma.ingredient.findUnique({ where: { id: ingredient.id } })).resolves.not.toBeNull();
  });

  it("excluir ingrediente exige papel ADMIN", async () => {
    const waiter = (await createStaffUser({ role: "WAITER" })).token;
    const ingredient = await prisma.ingredient.create({ data: { name: "Sal", unit: "kg" } });
    const res = await request(app)
      .delete(`/api/stock/ingredients/${ingredient.id}`)
      .set("Authorization", `Bearer ${waiter}`);
    expect(res.status).toBe(403);
  });
});

describe("Estoque — embalagens (packaging)", () => {
  let token;

  beforeEach(async () => {
    await resetDatabase();
    token = (await createStaffUser({ role: "ADMIN" })).token;
  });

  it("cria, lista, edita, ajusta e exclui uma embalagem", async () => {
    const createRes = await request(app)
      .post("/api/stock/packaging")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Caixa de Pizza", unit: "un", currentStock: 40, minStock: 10 });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    const listRes = await request(app).get("/api/stock/packaging").set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.map((p) => p.name)).toContain("Caixa de Pizza");

    const putRes = await request(app)
      .put(`/api/stock/packaging/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ minStock: 5 });
    expect(putRes.status).toBe(200);
    expect(Number(putRes.body.minStock)).toBe(5);

    const adjustRes = await request(app)
      .patch(`/api/stock/packaging/${id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: -10, reason: "ADJUSTMENT" });
    expect(adjustRes.status).toBe(200);
    expect(Number(adjustRes.body.currentStock)).toBe(30);

    const delRes = await request(app)
      .delete(`/api/stock/packaging/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(delRes.status).toBe(204);
  });

  it("PUT em embalagem inexistente responde 404", async () => {
    const res = await request(app)
      .put("/api/stock/packaging/inexistente")
      .set("Authorization", `Bearer ${token}`)
      .send({ minStock: 1 });
    expect(res.status).toBe(404);
  });

  it("bloqueia (409) a exclusão de uma embalagem usada em uma receita", async () => {
    const category = await prisma.category.create({ data: { name: "Pizzas" } });
    const menuItem = await prisma.menuItem.create({
      data: { name: "Pizza", description: "Pizza", price: 30, categoryId: category.id },
    });
    const box = await prisma.packagingItem.create({ data: { name: "Caixa", unit: "un", currentStock: 20 } });
    await prisma.recipePackaging.create({
      data: { menuItemId: menuItem.id, packagingItemId: box.id, quantityPerUnit: 1 },
    });

    const res = await request(app).delete(`/api/stock/packaging/${box.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(409);
  });
});

describe("Estoque — movimentações (/api/stock/movements)", () => {
  let token;

  beforeEach(async () => {
    await resetDatabase();
    token = (await createStaffUser({ role: "ADMIN" })).token;
  });

  it("exige papel ADMIN", async () => {
    const waiter = (await createStaffUser({ role: "WAITER" })).token;
    const res = await request(app).get("/api/stock/movements").set("Authorization", `Bearer ${waiter}`);
    expect(res.status).toBe(403);
  });

  it("registra e devolve as movimentações mais recentes primeiro, com o item embutido", async () => {
    const ingredient = await prisma.ingredient.create({ data: { name: "Sal", unit: "kg", currentStock: 5 } });
    await request(app)
      .patch(`/api/stock/ingredients/${ingredient.id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: 3, reason: "RESTOCK" });
    await request(app)
      .patch(`/api/stock/ingredients/${ingredient.id}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ delta: -1, reason: "ADJUSTMENT" });

    const res = await request(app).get("/api/stock/movements").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].reason).toBe("ADJUSTMENT");
    expect(res.body[0].ingredient).toMatchObject({ name: "Sal", unit: "kg" });
  });
});
