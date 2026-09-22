import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers/testApp.js";
import { resetDatabase, prisma } from "../helpers/db.js";
import { createStaffUser } from "../helpers/fixtures.js";

describe("Equipe (/api/users)", () => {
  const app = createTestApp();
  let adminToken;
  let adminId;

  beforeEach(async () => {
    await resetDatabase();
    const admin = await createStaffUser({ role: "ADMIN", email: "admin@teste.com" });
    adminToken = admin.token;
    adminId = admin.user.id;
  });

  it("GET exige autenticação", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });

  it("GET exige papel ADMIN", async () => {
    const { token } = await createStaffUser({ role: "WAITER" });
    const res = await request(app).get("/api/users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("ADMIN lista a equipe ordenada por nome, sem o hash de senha", async () => {
    await createStaffUser({ role: "KITCHEN", name: "Bruno", email: "bruno@teste.com" });
    const res = await request(app).get("/api/users").set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).not.toHaveProperty("passwordHash");
    const names = res.body.map((u) => u.name);
    expect(names).toEqual([...names].sort());
  });

  it("ADMIN cria um usuário", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Nova Garçonete", email: "nova@teste.com", password: "senha123", role: "WAITER" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: "nova@teste.com", role: "WAITER" });
    expect(res.body).not.toHaveProperty("passwordHash");
    const stored = await prisma.staffUser.findUnique({ where: { email: "nova@teste.com" } });
    expect(stored.passwordHash).not.toBe("senha123");
  });

  it("rejeita e-mail duplicado com 409", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Outro Admin", email: "admin@teste.com", password: "senha123", role: "ADMIN" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/já existe/i);
  });

  it("rejeita payload inválido (senha curta) com 400", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "X", email: "x@teste.com", password: "123", role: "WAITER" });

    expect(res.status).toBe(400);
  });

  it("cria exige papel ADMIN", async () => {
    const { token } = await createStaffUser({ role: "KITCHEN" });
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X", email: "x@teste.com", password: "senha123", role: "WAITER" });
    expect(res.status).toBe(403);
  });

  it("ADMIN exclui outro usuário", async () => {
    const { user } = await createStaffUser({ role: "DELIVERY", email: "del@teste.com" });
    const res = await request(app).delete(`/api/users/${user.id}`).set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    await expect(prisma.staffUser.findUnique({ where: { id: user.id } })).resolves.toBeNull();
  });

  it("impede o ADMIN de excluir a própria conta", async () => {
    const res = await request(app).delete(`/api/users/${adminId}`).set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/própria conta/i);
    await expect(prisma.staffUser.findUnique({ where: { id: adminId } })).resolves.not.toBeNull();
  });

  it("excluir um id inexistente propaga erro do Prisma (500)", async () => {
    const res = await request(app)
      .delete("/api/users/inexistente")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
  });
});
