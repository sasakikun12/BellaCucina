const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  emitOrderNew,
  emitOrderUpdated,
  emitTableUpdated,
} = require("../socket");
const { ApiError } = require("../middleware/errorHandler");
const {
  consumeStock,
  releaseStock,
  reverseStockForOrder,
} = require("../lib/stock");

const ordersRouter = Router();

const ORDER_INCLUDE = {
  items: { include: { menuItem: true } },
  table: true,
  createdBy: { select: { id: true, name: true, role: true } },
  driver: { select: { id: true, name: true, role: true } },
};

const INGREDIENT_RECIPE = {
  recipeModel: "recipeIngredient",
  catalogModel: "ingredient",
  idField: "ingredientId",
};

async function recalcOrderTotal(tx, orderId) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  const total = items.reduce(
    (sum, i) => sum + Number(i.unitPrice) * i.quantity,
    0,
  );
  await tx.order.update({ where: { id: orderId }, data: { total } });
}

async function recomputeOrderStatus(tx, orderId) {
  const [order, items] = await Promise.all([
    tx.order.findUnique({ where: { id: orderId } }),
    tx.orderItem.findMany({ where: { orderId } }),
  ]);

  /* v8 ignore next */
  if (!order || items.length === 0) return order;

  const allReady = items.every((i) => i.status === "READY");
  const anyStarted = items.some((i) => i.status !== "PENDING");

  let nextStatus = order.status;
  if (allReady) {
    nextStatus = "READY";
  } else if (
    ["PENDING", "CONFIRMED", "READY", "SERVED"].includes(order.status)
  ) {
    nextStatus = anyStarted ? "PREPARING" : "CONFIRMED";
  }

  if (nextStatus === order.status) return order;
  return tx.order.update({
    where: { id: orderId },
    data: { status: nextStatus },
  });
}

ordersRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const { status, type, tableId } = req.query;
    const orders = await prisma.order.findMany({
      where: {
        ...(status && { status: String(status) }),
        ...(type && { type: String(type) }),
        ...(tableId && { tableId: String(tableId) }),
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

ordersRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new ApiError(404, "Pedido não encontrado");
    res.json(order);
  } catch (err) {
    next(err);
  }
});

const createOrderSchema = z.object({
  type: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]),
  tableId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  deliveryAddress: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        notes: z.string().optional(),
      }),
    )
    .min(1, "O pedido deve conter pelo menos um item"),
});

ordersRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "WAITER"),
  async (req, res, next) => {
    try {
      const data = createOrderSchema.parse(req.body);

      if (data.type === "DINE_IN" && !data.tableId) {
        throw new ApiError(400, "tableId é obrigatório para pedidos no salão");
      }
      if (data.type === "DELIVERY" && !data.deliveryAddress) {
        throw new ApiError(
          400,
          "deliveryAddress é obrigatório para pedidos de entrega",
        );
      }

      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: data.items.map((i) => i.menuItemId) } },
      });
      if (
        menuItems.length !== new Set(data.items.map((i) => i.menuItemId)).size
      ) {
        throw new ApiError(400, "Um ou mais itens do cardápio não existem");
      }
      const priceById = new Map(menuItems.map((m) => [m.id, m.price]));
      const total = data.items.reduce(
        (sum, i) => sum + Number(priceById.get(i.menuItemId)) * i.quantity,
        0,
      );

      const { order, table } = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            type: data.type,
            tableId: data.type === "DINE_IN" ? data.tableId : null,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            deliveryAddress:
              data.type === "DELIVERY" ? data.deliveryAddress : null,
            notes: data.notes,
            createdById: req.user.sub,
            total,
            items: {
              create: data.items.map((i) => ({
                menuItemId: i.menuItemId,
                quantity: i.quantity,
                notes: i.notes,
                unitPrice: priceById.get(i.menuItemId),
              })),
            },
          },
          include: ORDER_INCLUDE,
        });

        await consumeStock(tx, data.items, {
          ...INGREDIENT_RECIPE,
          orderId: order.id,
        });

        let table = null;
        if (data.type === "DINE_IN" && data.tableId) {
          table = await tx.restaurantTable.update({
            where: { id: data.tableId },
            data: { status: "OCCUPIED" },
          });
        }

        return { order, table };
      });

      if (table) emitTableUpdated(table);
      emitOrderNew(order);
      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  },
);

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "SERVED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
];

const NON_EDITABLE_STATUSES = [
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
];

function assertEditable(order) {
  if (NON_EDITABLE_STATUSES.includes(order.status)) {
    throw new ApiError(400, "Este pedido não pode mais ser alterado");
  }
}

const statusSchema = z.object({ status: z.enum(ORDER_STATUSES) });

ordersRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole("ADMIN", "WAITER", "KITCHEN", "DELIVERY"),
  async (req, res, next) => {
    try {
      const { status } = statusSchema.parse(req.body);

      const { order, table } = await prisma.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({
          where: { id: req.params.id },
        });
        if (!existing) throw new ApiError(404, "Pedido não encontrado");

        if (status === "CANCELLED" && existing.status !== "CANCELLED") {
          await reverseStockForOrder(tx, req.params.id);
        }

        const order = await tx.order.update({
          where: { id: req.params.id },
          data: { status },
          include: ORDER_INCLUDE,
        });

        let table = null;
        if (
          order.tableId &&
          (status === "COMPLETED" || status === "CANCELLED")
        ) {
          table = await tx.restaurantTable.update({
            where: { id: order.tableId },
            data: { status: "FREE" },
          });
        }

        return { order, table };
      });

      if (table) emitTableUpdated(table);
      emitOrderUpdated(order);
      res.json(order);
    } catch (err) {
      next(err);
    }
  },
);

const itemStatusSchema = z.object({
  status: z.enum(["PENDING", "PREPARING", "READY"]),
});

ordersRouter.patch(
  "/:id/items/:itemId/status",
  requireAuth,
  requireRole("ADMIN", "KITCHEN"),
  async (req, res, next) => {
    try {
      const { status } = itemStatusSchema.parse(req.body);

      const order = await prisma.$transaction(async (tx) => {
        const item = await tx.orderItem.findUnique({
          where: { id: req.params.itemId },
        });
        if (!item || item.orderId !== req.params.id)
          throw new ApiError(404, "Item do pedido não encontrado");

        await tx.orderItem.update({
          where: { id: req.params.itemId },
          data: { status },
        });
        await recomputeOrderStatus(tx, req.params.id);
        return tx.order.findUnique({
          where: { id: req.params.id },
          include: ORDER_INCLUDE,
        });
      });

      emitOrderUpdated(order);
      res.json(order);
    } catch (err) {
      next(err);
    }
  },
);

const addItemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  notes: z.string().optional(),
});

ordersRouter.post(
  "/:id/items",
  requireAuth,
  requireRole("ADMIN", "WAITER"),
  async (req, res, next) => {
    try {
      const data = addItemSchema.parse(req.body);

      const order = await prisma.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({
          where: { id: req.params.id },
        });
        if (!existing) throw new ApiError(404, "Pedido não encontrado");
        assertEditable(existing);

        const menuItem = await tx.menuItem.findUnique({
          where: { id: data.menuItemId },
        });
        if (!menuItem)
          throw new ApiError(400, "Item do cardápio não encontrado");

        await consumeStock(
          tx,
          [{ menuItemId: data.menuItemId, quantity: data.quantity }],
          {
            ...INGREDIENT_RECIPE,
            orderId: existing.id,
          },
        );

        await tx.orderItem.create({
          data: {
            orderId: existing.id,
            menuItemId: data.menuItemId,
            quantity: data.quantity,
            notes: data.notes,
            unitPrice: menuItem.price,
          },
        });

        await recalcOrderTotal(tx, existing.id);
        await recomputeOrderStatus(tx, existing.id);
        return tx.order.findUnique({
          where: { id: existing.id },
          include: ORDER_INCLUDE,
        });
      });

      emitOrderUpdated(order);
      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  },
);

const itemQuantitySchema = z.object({
  quantity: z.coerce.number().int().positive(),
});

ordersRouter.patch(
  "/:id/items/:itemId/quantity",
  requireAuth,
  requireRole("ADMIN", "WAITER"),
  async (req, res, next) => {
    try {
      const { quantity } = itemQuantitySchema.parse(req.body);

      const order = await prisma.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({
          where: { id: req.params.id },
        });
        if (!existing) throw new ApiError(404, "Pedido não encontrado");
        assertEditable(existing);

        const item = await tx.orderItem.findUnique({
          where: { id: req.params.itemId },
        });
        if (!item || item.orderId !== req.params.id)
          throw new ApiError(404, "Item do pedido não encontrado");

        const delta = quantity - item.quantity;
        if (delta > 0) {
          await consumeStock(
            tx,
            [{ menuItemId: item.menuItemId, quantity: delta }],
            {
              ...INGREDIENT_RECIPE,
              orderId: req.params.id,
            },
          );
        } else if (delta < 0) {
          await releaseStock(tx, item.menuItemId, -delta, {
            ...INGREDIENT_RECIPE,
            orderId: req.params.id,
          });
        }

        await tx.orderItem.update({
          where: { id: req.params.itemId },
          data: { quantity },
        });
        await recalcOrderTotal(tx, req.params.id);
        await recomputeOrderStatus(tx, req.params.id);
        return tx.order.findUnique({
          where: { id: req.params.id },
          include: ORDER_INCLUDE,
        });
      });

      emitOrderUpdated(order);
      res.json(order);
    } catch (err) {
      next(err);
    }
  },
);

ordersRouter.delete(
  "/:id/items/:itemId",
  requireAuth,
  requireRole("ADMIN", "WAITER"),
  async (req, res, next) => {
    try {
      const order = await prisma.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({
          where: { id: req.params.id },
          include: { items: true },
        });
        if (!existing) throw new ApiError(404, "Pedido não encontrado");
        assertEditable(existing);

        const item = existing.items.find((i) => i.id === req.params.itemId);
        if (!item) throw new ApiError(404, "Item do pedido não encontrado");
        if (existing.items.length === 1) {
          throw new ApiError(
            400,
            "Não é possível remover o último item — cancele o pedido em vez disso",
          );
        }

        await releaseStock(tx, item.menuItemId, item.quantity, {
          ...INGREDIENT_RECIPE,
          orderId: req.params.id,
        });
        await tx.orderItem.delete({ where: { id: req.params.itemId } });
        await recalcOrderTotal(tx, req.params.id);
        await recomputeOrderStatus(tx, req.params.id);
        return tx.order.findUnique({
          where: { id: req.params.id },
          include: ORDER_INCLUDE,
        });
      });

      emitOrderUpdated(order);
      res.json(order);
    } catch (err) {
      next(err);
    }
  },
);

ordersRouter.patch(
  "/:id/assign-driver",
  requireAuth,
  requireRole("ADMIN", "DELIVERY"),
  async (req, res, next) => {
    try {
      const order = await prisma.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({
          where: { id: req.params.id },
          include: { items: true },
        });
        if (!existing) throw new ApiError(404, "Pedido não encontrado");
        if (existing.type !== "DELIVERY") {
          throw new ApiError(
            400,
            "Apenas pedidos de entrega podem receber um entregador",
          );
        }
        if (existing.status !== "READY") {
          throw new ApiError(
            400,
            "Este pedido ainda não está pronto para despacho",
          );
        }

        await consumeStock(
          tx,
          existing.items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
          })),
          {
            recipeModel: "recipePackaging",
            catalogModel: "packagingItem",
            idField: "packagingItemId",
            orderId: existing.id,
          },
        );

        return tx.order.update({
          where: { id: req.params.id },
          data: { driverId: req.user.sub, status: "OUT_FOR_DELIVERY" },
          include: ORDER_INCLUDE,
        });
      });

      emitOrderUpdated(order);
      res.json(order);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = { ordersRouter };
