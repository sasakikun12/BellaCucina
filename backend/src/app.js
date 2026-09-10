require("dotenv/config");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { authRouter } = require("./routes/auth.routes");
const { menuRouter } = require("./routes/menu.routes");
const { tablesRouter } = require("./routes/tables.routes");
const { ordersRouter } = require("./routes/orders.routes");
const { usersRouter } = require("./routes/users.routes");
const { stockRouter } = require("./routes/stock.routes");

function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
  app.use(express.json());

  /* v8 ignore start */
  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }
  /* v8 ignore stop */
  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/menu", menuRouter);
  app.use("/api/tables", tablesRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/stock", stockRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
