import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { createTestApp } from "../helpers/testApp.js";
import { resetDatabase, prisma } from "../helpers/db.js";
import { createStaffUser } from "../helpers/fixtures.js";

const require = createRequire(import.meta.url);
const uploadsDir = path.join(require.resolve("../../src/app"), "..", "..", "uploads");
const app = createTestApp();

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const uploadedFiles = [];
afterAll(() => {
  for (const f of uploadedFiles) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* noop */
    }
  }
});
function trackUploads(before) {
  const after = fs.readdirSync(uploadsDir);
  for (const name of after) {
    if (!before.includes(name)) uploadedFiles.push(path.join(uploadsDir, name));
  }
}

async function seedCategory(name = "Pratos") {
  return prisma.category.create({ data: { name } });
}

describe("Categorias do cardápio", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("lista categorias sem autenticação (o cardápio é público)", async () => {
    await prisma.category.create({ data: { name: "Bebidas" } });
    const res = await request(app).get("/api/menu/categories");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Bebidas");
  });

  it("exige papel ADMIN para criar categoria", async () => {
    const { token } = await createStaffUser({ role: "WAITER" });
    const res = await request(app)
      .post("/api/menu/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sobremesas" });
    expect(res.status).toBe(403);
  });

  it("exige autenticação para criar categoria", async () => {
    const res = await request(app).post("/api/menu/categories").send({ name: "Sobremesas" });
    expect(res.status).toBe(401);
  });

  it("rejeita nome de categoria vazio (400)", async () => {
    const { token } = await createStaffUser({ role: "ADMIN" });
    const res = await request(app)
      .post("/api/menu/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("admin cria uma categoria", async () => {
    const { token } = await createStaffUser({ role: "ADMIN" });
    const res = await request(app)
      .post("/api/menu/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sobremesas" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Sobremesas");
  });

  it("bloqueia a exclusão de uma categoria que ainda tem itens do cardápio", async () => {
    const { token } = await createStaffUser({ role: "ADMIN" });
    const category = await seedCategory("Entradas");
    await prisma.menuItem.create({
      data: { name: "Bruschetta", description: "Pão com tomate", price: 10, categoryId: category.id },
    });

    const res = await request(app)
      .delete(`/api/menu/categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
    await expect(prisma.category.findUnique({ where: { id: category.id } })).resolves.not.toBeNull();
  });

  it("exclui uma categoria vazia", async () => {
    const { token } = await createStaffUser({ role: "ADMIN" });
    const category = await seedCategory("Vazia");
    const res = await request(app)
      .delete(`/api/menu/categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
    await expect(prisma.category.findUnique({ where: { id: category.id } })).resolves.toBeNull();
  });

  it("excluir categoria exige papel ADMIN", async () => {
    const { token } = await createStaffUser({ role: "WAITER" });
    const category = await seedCategory("X");
    const res = await request(app)
      .delete(`/api/menu/categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("Itens do cardápio — listagem pública", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("lista todos os itens sem login, com a categoria embutida", async () => {
    const cat = await seedCategory();
    await prisma.menuItem.create({ data: { name: "Pizza", description: "d", price: 30, categoryId: cat.id } });
    await prisma.menuItem.create({ data: { name: "Água", description: "d", price: 5, categoryId: cat.id } });

    const res = await request(app).get("/api/menu");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].category.name).toBe("Pratos");
  });

  it("filtra por categoria via ?categoryId=", async () => {
    const a = await seedCategory("A");
    const b = await seedCategory("B");
    await prisma.menuItem.create({ data: { name: "Item A", description: "d", price: 1, categoryId: a.id } });
    await prisma.menuItem.create({ data: { name: "Item B", description: "d", price: 1, categoryId: b.id } });

    const res = await request(app).get(`/api/menu?categoryId=${a.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Item A");
  });
});

describe("Itens do cardápio — escrita (ADMIN)", () => {
  let token;
  let categoryId;

  beforeEach(async () => {
    await resetDatabase();
    token = (await createStaffUser({ role: "ADMIN" })).token;
    categoryId = (await seedCategory()).id;
  });

  it("cria um item sem foto (photoUrl = null)", async () => {
    const res = await request(app)
      .post("/api/menu")
      .set("Authorization", `Bearer ${token}`)
      .field("name", "Salada")
      .field("description", "Salada verde")
      .field("price", "18.5")
      .field("categoryId", categoryId)
      .field("available", "false");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Salada", available: false, photoUrl: null });
    expect(Number(res.body.price)).toBe(18.5);
  });

  it("cria um item com uma URL de foto externa (https)", async () => {
    const res = await request(app)
      .post("/api/menu")
      .set("Authorization", `Bearer ${token}`)
      .field("name", "Pizza")
      .field("description", "Pizza margherita")
      .field("price", "30")
      .field("categoryId", categoryId)
      .field("photoUrl", "https://example.com/pizza.jpg");

    expect(res.status).toBe(201);
    expect(res.body.photoUrl).toBe("https://example.com/pizza.jpg");
    expect(res.body.available).toBe(true);
  });

  it("cria um item com upload de arquivo de imagem", async () => {
    const before = fs.readdirSync(uploadsDir);
    const res = await request(app)
      .post("/api/menu")
      .set("Authorization", `Bearer ${token}`)
      .field("name", "Lasanha")
      .field("description", "Lasanha à bolonhesa")
      .field("price", "42")
      .field("categoryId", categoryId)
      .attach("photo", PNG_BYTES, { filename: "lasanha.png", contentType: "image/png" });
    trackUploads(before);

    expect(res.status).toBe(201);
    expect(res.body.photoUrl).toMatch(/^\/uploads\/\d+-\d+\.png$/);
  });

  it("aceita um body JSON com 'available' booleano de verdade", async () => {
    const res = await request(app)
      .post("/api/menu")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Suco", description: "Suco de laranja", price: 9, categoryId, available: true });

    expect(res.status).toBe(201);
    expect(res.body.available).toBe(true);
  });

  it("rejeita uma photoUrl que não é http(s) nem caminho /uploads (400)", async () => {
    const res = await request(app)
      .post("/api/menu")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X", description: "d", price: 1, categoryId, photoUrl: "ftp://x/y.png" });
    expect(res.status).toBe(400);
  });

  it("rejeita um arquivo que não é imagem", async () => {
    const res = await request(app)
      .post("/api/menu")
      .set("Authorization", `Bearer ${token}`)
      .field("name", "X")
      .field("description", "d")
      .field("price", "1")
      .field("categoryId", categoryId)
      .attach("photo", Buffer.from("texto"), { filename: "nota.txt", contentType: "text/plain" });
    expect(res.status).toBe(500);
  });

  it("rejeita preço não positivo (400)", async () => {
    const res = await request(app)
      .post("/api/menu")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X", description: "d", price: -1, categoryId });
    expect(res.status).toBe(400);
  });

  it("criar item exige papel ADMIN", async () => {
    const waiter = (await createStaffUser({ role: "WAITER" })).token;
    const res = await request(app)
      .post("/api/menu")
      .set("Authorization", `Bearer ${waiter}`)
      .send({ name: "X", description: "d", price: 1, categoryId });
    expect(res.status).toBe(403);
  });

  it("atualiza todos os campos de um item (PUT)", async () => {
    const otherCat = await seedCategory("Outra");
    const item = await prisma.menuItem.create({
      data: { name: "Antigo", description: "d", price: 10, categoryId, photoUrl: "https://old/x.jpg" },
    });

    const res = await request(app)
      .put(`/api/menu/${item.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Novo",
        description: "nova desc",
        price: 25,
        categoryId: otherCat.id,
        available: false,
        photoUrl: "https://new/y.jpg",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Novo",
      description: "nova desc",
      available: false,
      photoUrl: "https://new/y.jpg",
    });
    expect(res.body.category.id).toBe(otherCat.id);
    expect(Number(res.body.price)).toBe(25);
  });

  it("PUT sem nenhum campo mantém o item intacto", async () => {
    const item = await prisma.menuItem.create({
      data: { name: "Estável", description: "d", price: 10, categoryId, photoUrl: "https://x/x.jpg" },
    });

    const res = await request(app)
      .put(`/api/menu/${item.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ photoUrl: "" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Estável", price: "10", photoUrl: "https://x/x.jpg" });
  });

  it("PUT troca a foto por um novo upload", async () => {
    const item = await prisma.menuItem.create({
      data: { name: "ComFoto", description: "d", price: 10, categoryId },
    });
    const before = fs.readdirSync(uploadsDir);

    const res = await request(app)
      .put(`/api/menu/${item.id}`)
      .set("Authorization", `Bearer ${token}`)
      .attach("photo", PNG_BYTES, { filename: "nova.png", contentType: "image/png" });
    trackUploads(before);

    expect(res.status).toBe(200);
    expect(res.body.photoUrl).toMatch(/^\/uploads\/\d+-\d+\.png$/);
  });

  it("PUT em item inexistente responde 404", async () => {
    const res = await request(app)
      .put("/api/menu/inexistente")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X" });
    expect(res.status).toBe(404);
  });

  it("editar item exige papel ADMIN", async () => {
    const waiter = (await createStaffUser({ role: "WAITER" })).token;
    const item = await prisma.menuItem.create({ data: { name: "X", description: "d", price: 1, categoryId } });
    const res = await request(app)
      .put(`/api/menu/${item.id}`)
      .set("Authorization", `Bearer ${waiter}`)
      .send({ name: "Y" });
    expect(res.status).toBe(403);
  });

  it("exclui um item que nunca foi pedido", async () => {
    const item = await prisma.menuItem.create({ data: { name: "Descartável", description: "d", price: 1, categoryId } });
    const res = await request(app).delete(`/api/menu/${item.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it("bloqueia (409) a exclusão de um item já usado em pedidos", async () => {
    const { user } = await createStaffUser({ role: "WAITER", email: "w-del@teste.com" });
    const item = await prisma.menuItem.create({ data: { name: "Pedido", description: "d", price: 1, categoryId } });
    await prisma.order.create({
      data: {
        type: "TAKEAWAY",
        createdById: user.id,
        total: 1,
        items: { create: [{ menuItemId: item.id, quantity: 1, unitPrice: 1 }] },
      },
    });

    const res = await request(app).delete(`/api/menu/${item.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it("excluir item exige papel ADMIN", async () => {
    const waiter = (await createStaffUser({ role: "WAITER" })).token;
    const item = await prisma.menuItem.create({ data: { name: "X", description: "d", price: 1, categoryId } });
    const res = await request(app).delete(`/api/menu/${item.id}`).set("Authorization", `Bearer ${waiter}`);
    expect(res.status).toBe(403);
  });
});

describe("Receita de um item do cardápio", () => {
  let token;
  let categoryId;
  let menuItemId;
  let ingredientId;
  let packagingId;

  beforeEach(async () => {
    await resetDatabase();
    token = (await createStaffUser({ role: "ADMIN" })).token;
    categoryId = (await seedCategory()).id;
    menuItemId = (
      await prisma.menuItem.create({ data: { name: "Pizza", description: "d", price: 30, categoryId } })
    ).id;
    ingredientId = (await prisma.ingredient.create({ data: { name: "Farinha", unit: "kg", currentStock: 10 } })).id;
    packagingId = (await prisma.packagingItem.create({ data: { name: "Caixa", unit: "un", currentStock: 50 } })).id;
  });

  it("GET /recipe exige autenticação", async () => {
    const res = await request(app).get(`/api/menu/${menuItemId}/recipe`);
    expect(res.status).toBe(401);
  });

  it("GET /recipe devolve as linhas de ingrediente e embalagem", async () => {
    await prisma.recipeIngredient.create({ data: { menuItemId, ingredientId, quantityPerUnit: 2 } });
    await prisma.recipePackaging.create({ data: { menuItemId, packagingItemId: packagingId, quantityPerUnit: 1 } });

    const res = await request(app).get(`/api/menu/${menuItemId}/recipe`).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ingredients).toEqual([
      { ingredientId, name: "Farinha", unit: "kg", quantityPerUnit: "2" },
    ]);
    expect(res.body.packaging).toEqual([
      { packagingItemId: packagingId, name: "Caixa", unit: "un", quantityPerUnit: "1" },
    ]);
  });

  it("PUT /recipe grava ingredientes e embalagem", async () => {
    const res = await request(app)
      .put(`/api/menu/${menuItemId}/recipe`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        ingredients: [{ ingredientId, quantityPerUnit: 3 }],
        packaging: [{ packagingItemId: packagingId, quantityPerUnit: 2 }],
      });

    expect(res.status).toBe(204);
    const lines = await prisma.recipeIngredient.findMany({ where: { menuItemId } });
    expect(lines).toHaveLength(1);
    expect(Number(lines[0].quantityPerUnit)).toBe(3);
    const pkg = await prisma.recipePackaging.findMany({ where: { menuItemId } });
    expect(pkg).toHaveLength(1);
  });

  it("PUT /recipe com corpo vazio limpa a receita existente", async () => {
    await prisma.recipeIngredient.create({ data: { menuItemId, ingredientId, quantityPerUnit: 2 } });
    await prisma.recipePackaging.create({ data: { menuItemId, packagingItemId: packagingId, quantityPerUnit: 1 } });

    const res = await request(app)
      .put(`/api/menu/${menuItemId}/recipe`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(204);
    await expect(prisma.recipeIngredient.findMany({ where: { menuItemId } })).resolves.toHaveLength(0);
    await expect(prisma.recipePackaging.findMany({ where: { menuItemId } })).resolves.toHaveLength(0);
  });

  it("PUT /recipe em item inexistente responde 404", async () => {
    const res = await request(app)
      .put("/api/menu/inexistente/recipe")
      .set("Authorization", `Bearer ${token}`)
      .send({ ingredients: [] });
    expect(res.status).toBe(404);
  });

  it("PUT /recipe exige papel ADMIN", async () => {
    const waiter = (await createStaffUser({ role: "WAITER" })).token;
    const res = await request(app)
      .put(`/api/menu/${menuItemId}/recipe`)
      .set("Authorization", `Bearer ${waiter}`)
      .send({ ingredients: [] });
    expect(res.status).toBe(403);
  });
});
