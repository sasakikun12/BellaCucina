import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers/testApp.js";

describe("app — infraestrutura", () => {
  it("GET /api/health responde ok", async () => {
    const res = await request(createTestApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("rota desconhecida cai no notFoundHandler (404)", async () => {
    const res = await request(createTestApp()).get("/api/rota-que-nao-existe");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Não encontrado" });
  });

  it("serve arquivos estáticos de /uploads", async () => {
    const res = await request(createTestApp()).get("/uploads/inexistente.png");
    expect(res.status).toBe(404);
  });
});

describe("app — logger HTTP no ambiente de teste", () => {
  it("NÃO monta o morgan quando NODE_ENV === 'test'", () => {
    const app = createTestApp();
    const hasMorgan = app._router.stack.some((layer) => layer.name === "logger");
    expect(hasMorgan).toBe(false);
  });
});
