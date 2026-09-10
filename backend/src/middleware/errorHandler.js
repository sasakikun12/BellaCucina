const { ZodError } = require("zod");

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Falha na validação", details: err.flatten() });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Erro interno do servidor" });
}

function notFoundHandler(_req, res) {
  res.status(404).json({ error: "Não encontrado" });
}

module.exports = { ApiError, errorHandler, notFoundHandler };
