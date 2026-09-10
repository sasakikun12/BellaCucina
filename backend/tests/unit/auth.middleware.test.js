import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { requireAuth, requireRole } = require("../../src/middleware/auth");
const { signToken } = require("../../src/utils/jwt");

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe("middleware/auth — requireAuth", () => {
  it("401 quando não há cabeçalho Authorization", () => {
    const res = mockRes();
    const next = vi.fn();
    requireAuth({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401 quando o cabeçalho não começa com 'Bearer '", () => {
    const res = mockRes();
    const next = vi.fn();
    requireAuth({ headers: { authorization: "Token abc" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("401 quando o token é inválido", () => {
    const res = mockRes();
    const next = vi.fn();
    requireAuth({ headers: { authorization: "Bearer nao-e-jwt" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token inválido ou expirado" });
    expect(next).not.toHaveBeenCalled();
  });

  it("chama next e popula req.user com um token válido", () => {
    const res = mockRes();
    const next = vi.fn();
    const req = { headers: { authorization: `Bearer ${signToken({ sub: "u1", role: "ADMIN" })}` } };
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ sub: "u1", role: "ADMIN" });
  });
});

describe("middleware/auth — requireRole", () => {
  it("401 quando req.user não está definido (defensivo)", () => {
    const res = mockRes();
    const next = vi.fn();
    requireRole("ADMIN")({}, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Não autenticado" });
    expect(next).not.toHaveBeenCalled();
  });

  it("403 quando o papel do usuário não está na lista permitida", () => {
    const res = mockRes();
    const next = vi.fn();
    requireRole("ADMIN", "KITCHEN")({ user: { role: "WAITER" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("chama next quando o papel é permitido", () => {
    const res = mockRes();
    const next = vi.fn();
    requireRole("ADMIN", "WAITER")({ user: { role: "WAITER" } }, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
