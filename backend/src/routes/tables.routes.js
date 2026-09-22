const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { emitTableUpdated } = require("../socket");

const tablesRouter = Router();

tablesRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const tables = await prisma.restaurantTable.findMany({
      orderBy: { number: "asc" },
      include: {
        orders: {
          where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
          include: { items: { include: { menuItem: true } } },
        },
      },
    });
    res.json(tables);
  } catch (err) {
    next(err);
  }
});

const tableSchema = z.object({
  number: z.coerce.number().int().positive(),
  capacity: z.coerce.number().int().positive(),
});

tablesRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const data = tableSchema.parse(req.body);
      const table = await prisma.restaurantTable.create({ data });
      res.status(201).json(table);
    } catch (err) {
      next(err);
    }
  },
);

tablesRouter.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const data = tableSchema.partial().parse(req.body);
      const table = await prisma.restaurantTable.update({
        where: { id: req.params.id },
        data,
      });
      res.json(table);
    } catch (err) {
      next(err);
    }
  },
);

const statusSchema = z.object({
  status: z.enum(["FREE", "OCCUPIED", "RESERVED"]),
});

tablesRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole("ADMIN", "WAITER"),
  async (req, res, next) => {
    try {
      const { status } = statusSchema.parse(req.body);
      const table = await prisma.restaurantTable.update({
        where: { id: req.params.id },
        data: { status },
      });
      emitTableUpdated(table);
      res.json(table);
    } catch (err) {
      next(err);
    }
  },
);

tablesRouter.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      await prisma.restaurantTable.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

module.exports = { tablesRouter };
