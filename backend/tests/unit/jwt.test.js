import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../../src/utils/jwt.js";

describe("utils/jwt", () => {
  it("verifyToken devolve o mesmo payload assinado por signToken", () => {
    const token = signToken({ sub: "user-1", role: "ADMIN" });
    const payload = verifyToken(token);
    expect(payload).toMatchObject({ sub: "user-1", role: "ADMIN" });
  });

  it("rejeita um token adulterado", () => {
    const token = signToken({ sub: "user-1", role: "ADMIN" });
    expect(() => verifyToken(`${token}x`)).toThrow();
  });

  it("rejeita uma string que não é um token", () => {
    expect(() => verifyToken("isto-nao-e-um-jwt")).toThrow();
  });
});
