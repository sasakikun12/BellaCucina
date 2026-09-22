import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers/testApp.js";
import { resetDatabase, prisma } from "../helpers/db.js";
import { createStaffUser } from "../helpers/fixtures.js";

describe("POST /api/auth/login", () => {
  const app = createTestApp();

  beforeEach(async () => {
    await resetDatabase();
  });

  it("faz login com credenciais válidas e retorna um token", async () => {
    await createStaffUser({ email: "admin@teste.com", role: "ADMIN", password: "senha123" });

    const res = await request(app).post("/api/auth/login").send({ email: "admin@teste.com", password: "senha123" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user: { email: "admin@teste.com", role: "ADMIN" } });
    expect(typeof res.body.token).toBe("string");
  });

  it("rejeita senha incorreta", async () => {
    await createStaffUser({ email: "admin@teste.com", role: "ADMIN", password: "senha123" });

    const res = await request(app).post("/api/auth/login").send({ email: "admin@teste.com", password: "errada" });

    expect(res.status).toBe(401);
  });

  it("rejeita e-mail inexistente", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "ninguem@teste.com", password: "x" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  const app = createTestApp();

  beforeEach(async () => {
    await resetDatabase();
  });

  it("retorna 401 sem token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("retorna o usuário autenticado com um token válido", async () => {
    const { token, user } = await createStaffUser({ email: "waiter@teste.com", role: "WAITER" });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, email: "waiter@teste.com", role: "WAITER" });
  });

  it("retorna 401 com um token malformado", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer isto-nao-e-um-jwt");
    expect(res.status).toBe(401);
  });

  it("retorna 404 se o usuário do token não existe mais", async () => {
    const { token, user } = await createStaffUser({ email: "fantasma@teste.com", role: "ADMIN" });
    await prisma.staffUser.delete({ where: { id: user.id } });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
