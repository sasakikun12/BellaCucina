const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ApiError } = require("../middleware/errorHandler");

const stockRouter = Router();

const itemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  currentStock: z.coerce.number().min(0).optional(),
  minStock: z.coerce.number().min(0).optional(),
});

const adjustSchema = z.object({
  delta: z.coerce
    .number()
    .refine((n) => n !== 0, "A quantidade deve ser diferente de zero"),
  reason: z.enum(["RESTOCK", "ADJUSTMENT"]).default("RESTOCK"),
});

function buildCatalogRoutes(path, model, movementField) {
  stockRouter.get(`/${path}`, requireAuth, async (_req, res, next) => {
    try {
      const items = await prisma[model].findMany({ orderBy: { name: "asc" } });
      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  stockRouter.post(
    `/${path}`,
    requireAuth,
    requireRole("ADMIN"),
    async (req, res, next) => {
      try {
        const data = itemSchema.parse(req.body);
        const item = await prisma[model].create({
          data: {
            name: data.name,
            unit: data.unit,
            currentStock: data.currentStock ?? 0,
            minStock: data.minStock ?? 0,
          },
        });
        res.status(201).json(item);
      } catch (err) {
        next(err);
      }
    },
  );

  stockRouter.put(
    `/${path}/:id`,
    requireAuth,
    requireRole("ADMIN"),
    async (req, res, next) => {
      try {
        const data = itemSchema.partial().parse(req.body);
        const existing = await prisma[model].findUnique({
          where: { id: req.params.id },
        });
        if (!existing) throw new ApiError(404, "Item não encontrado");

        const item = await prisma[model].update({
          where: { id: req.params.id },
          data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.unit !== undefined && { unit: data.unit }),
            ...(data.minStock !== undefined && { minStock: data.minStock }),
          },
        });
        res.json(item);
      } catch (err) {
        next(err);
      }
    },
  );

  stockRouter.delete(
    `/${path}/:id`,
    requireAuth,
    requireRole("ADMIN"),
    async (req, res, next) => {
      try {
        await prisma[model].delete({ where: { id: req.params.id } });
        res.status(204).send();
      } catch (err) {
        if (err?.code === "P2003") {
          return next(
            new ApiError(
              409,
              "Não é possível excluir um item usado em uma receita",
            ),
          );
        }
        next(err);
      }
    },
  );

  stockRouter.patch(
    `/${path}/:id/adjust`,
    requireAuth,
    requireRole("ADMIN"),
    async (req, res, next) => {
      try {
        const { delta, reason } = adjustSchema.parse(req.body);
        const existing = await prisma[model].findUnique({
          where: { id: req.params.id },
        });
        if (!existing) throw new ApiError(404, "Item não encontrado");

        const newStock = Number(existing.currentStock) + delta;
        if (newStock < 0) {
          throw new ApiError(400, "Esse ajuste deixaria o estoque negativo");
        }

        const [item] = await prisma.$transaction([
          prisma[model].update({
            where: { id: req.params.id },
            data: { currentStock: newStock },
          }),
          prisma.stockMovement.create({
            data: { [movementField]: req.params.id, delta, reason },
          }),
        ]);
        res.json(item);
      } catch (err) {
        next(err);
      }
    },
  );
}

buildCatalogRoutes("ingredients", "ingredient", "ingredientId");
buildCatalogRoutes("packaging", "packagingItem", "packagingItemId");

stockRouter.get(
  "/movements",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res, next) => {
    try {
      const movements = await prisma.stockMovement.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          ingredient: { select: { name: true, unit: true } },
          packagingItem: { select: { name: true, unit: true } },
        },
      });
      res.json(movements);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = { stockRouter };
