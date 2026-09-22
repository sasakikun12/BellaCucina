import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword } from "../../src/utils/password.js";

describe("utils/password", () => {
  it("gera um hash diferente da senha original e confere corretamente", async () => {
    const hash = await hashPassword("segredo123");
    expect(hash).not.toBe("segredo123");
    await expect(comparePassword("segredo123", hash)).resolves.toBe(true);
  });

  it("rejeita a senha errada", async () => {
    const hash = await hashPassword("segredo123");
    await expect(comparePassword("outra-senha", hash)).resolves.toBe(false);
  });
});
