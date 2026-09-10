import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers/testApp.js";
import { resetDatabase, prisma } from "../helpers/db.js";
import { createStaffUser } from "../helpers/fixtures.js";

describe("Rotas — propagação de erros inesperados do Prisma (500)", () => {
  const app = createTestApp();
  let token;
  const boom = () => Promise.reject(new Error("falha simulada do banco"));
  const plainDbError = () => Promise.reject(new Error("erro qualquer, não-P2003"));

  beforeAll(async () => {
    await resetDatabase();
    token = (await createStaffUser({ role: "ADMIN" })).token;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/menu/categories", async () => {
    vi.spyOn(prisma.category, "findMany").mockImplementation(boom);
    expect((await request(app).get("/api/menu/categories")).status).toBe(500);
  });

  it("GET /api/menu", async () => {
    vi.spyOn(prisma.menuItem, "findMany").mockImplementation(boom);
    expect((await request(app).get("/api/menu")).status).toBe(500);
  });

  it("GET /api/menu/:id/recipe", async () => {
    vi.spyOn(prisma.recipeIngredient, "findMany").mockImplementation(boom);
    const res = await request(app).get("/api/menu/qualquer/recipe").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  it("DELETE /api/menu/categories/:id — erro não-P2003 cai no next(err)", async () => {
    vi.spyOn(prisma.category, "delete").mockImplementation(plainDbError);
    const res = await request(app).delete("/api/menu/categories/x").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  it("DELETE /api/menu/:id — erro não-P2003 cai no next(err)", async () => {
    vi.spyOn(prisma.menuItem, "delete").mockImplementation(plainDbError);
    const res = await request(app).delete("/api/menu/x").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  it("GET /api/orders", async () => {
    vi.spyOn(prisma.order, "findMany").mockImplementation(boom);
    const res = await request(app).get("/api/orders").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  it("GET /api/stock/ingredients", async () => {
    vi.spyOn(prisma.ingredient, "findMany").mockImplementation(boom);
    const res = await request(app).get("/api/stock/ingredients").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  it("DELETE /api/stock/ingredients/:id — erro não-P2003 cai no next(err)", async () => {
    vi.spyOn(prisma.ingredient, "delete").mockImplementation(plainDbError);
    const res = await request(app).delete("/api/stock/ingredients/x").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  it("GET /api/stock/movements", async () => {
    vi.spyOn(prisma.stockMovement, "findMany").mockImplementation(boom);
    const res = await request(app).get("/api/stock/movements").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  it("GET /api/tables", async () => {
    vi.spyOn(prisma.restaurantTable, "findMany").mockImplementation(boom);
    const res = await request(app).get("/api/tables").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  it("PUT /api/tables/:id", async () => {
    vi.spyOn(prisma.restaurantTable, "update").mockImplementation(boom);
    const res = await request(app).put("/api/tables/x").set("Authorization", `Bearer ${token}`).send({ capacity: 4 });
    expect(res.status).toBe(500);
  });

  it("GET /api/users", async () => {
    vi.spyOn(prisma.staffUser, "findMany").mockImplementation(boom);
    const res = await request(app).get("/api/users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(500);
  });
});
