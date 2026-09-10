import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";

// zod e errorHandler.js são CommonJS. Carregamos ambos via createRequire (em
// vez de `import`) para garantir a MESMA classe ZodError/ApiError que
// errorHandler.js usa internamente — misturar `import` (ESM) e `require`
// (CJS) para o mesmo pacote pode resolver para duas classes distintas.
const require = createRequire(import.meta.url);
const { z } = require("zod");
const { ApiError, errorHandler, notFoundHandler } = require("../../src/middleware/errorHandler");

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe("middleware/errorHandler", () => {
  it("responde 400 com os detalhes de um ZodError", () => {
    const schema = z.object({ name: z.string().min(1) });
    const { error } = schema.safeParse({ name: "" });
    const res = mockRes();

    errorHandler(error, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Falha na validação" }));
  });

  it("responde com o status e a mensagem de um ApiError", () => {
    const res = mockRes();

    errorHandler(new ApiError(404, "Não encontrado"), {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Não encontrado" });
  });

  it("responde 500 para um erro inesperado, sem vazar a mensagem original", () => {
    const res = mockRes();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(new Error("detalhe interno sensível"), {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Erro interno do servidor" });
    consoleSpy.mockRestore();
  });

  it("notFoundHandler responde 404", () => {
    const res = mockRes();
    notFoundHandler({}, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Não encontrado" });
  });
});
