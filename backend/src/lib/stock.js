const { ApiError } = require("../middleware/errorHandler");

async function consumeStock(
  tx,
  orderItems,
  { recipeModel, catalogModel, idField, orderId },
) {
  const menuItemIds = [...new Set(orderItems.map((i) => i.menuItemId))];
  if (menuItemIds.length === 0) return;

  const recipeLines = await tx[recipeModel].findMany({
    where: { menuItemId: { in: menuItemIds } },
  });
  if (recipeLines.length === 0) return;

  const qtyByMenuItem = new Map();
  for (const i of orderItems) {
    qtyByMenuItem.set(
      i.menuItemId,
      (qtyByMenuItem.get(i.menuItemId) ?? 0) + i.quantity,
    );
  }

  const neededByCatalogId = new Map();
  for (const line of recipeLines) {
    const orderedQty = qtyByMenuItem.get(line.menuItemId) ?? 0;
    if (orderedQty === 0) continue;
    const needed = Number(line.quantityPerUnit) * orderedQty;
    const catalogId = line[idField];
    neededByCatalogId.set(
      catalogId,
      (neededByCatalogId.get(catalogId) ?? 0) + needed,
    );
  }

  for (const [catalogId, needed] of neededByCatalogId) {
    if (needed <= 0) continue;
    const item = await tx[catalogModel].findUnique({
      where: { id: catalogId },
    });
    if (!item) continue;

    const newStock = Number(item.currentStock) - needed;
    if (newStock < 0) {
      throw new ApiError(
        400,
        `Estoque insuficiente de "${item.name}" (disponível: ${item.currentStock} ${item.unit}, necessário: ${needed} ${item.unit})`,
      );
    }
    await tx[catalogModel].update({
      where: { id: catalogId },
      data: { currentStock: newStock },
    });
    await tx.stockMovement.create({
      data: { [idField]: catalogId, delta: -needed, reason: "SALE", orderId },
    });
  }
}

async function releaseStock(
  tx,
  menuItemId,
  quantity,
  { recipeModel, catalogModel, idField, orderId },
) {
  if (quantity <= 0) return;
  const recipeLines = await tx[recipeModel].findMany({ where: { menuItemId } });

  for (const line of recipeLines) {
    const amount = Number(line.quantityPerUnit) * quantity;
    if (amount <= 0) continue;
    const catalogId = line[idField];
    const item = await tx[catalogModel].findUnique({
      where: { id: catalogId },
    });
    if (!item) continue;

    await tx[catalogModel].update({
      where: { id: catalogId },
      data: { currentStock: Number(item.currentStock) + amount },
    });
    await tx.stockMovement.create({
      data: {
        [idField]: catalogId,
        delta: amount,
        reason: "ORDER_ADJUSTMENT",
        orderId,
      },
    });
  }
}

async function reverseStockForOrder(tx, orderId) {
  const movements = await tx.stockMovement.findMany({
    where: { orderId, reason: { in: ["SALE", "ORDER_ADJUSTMENT"] } },
  });

  const netByCatalogItem = new Map();
  for (const m of movements) {
    const isIngredient = m.ingredientId != null;
    const field = isIngredient ? "ingredientId" : "packagingItemId";
    const catalogId = isIngredient ? m.ingredientId : m.packagingItemId;
    const key = `${field}:${catalogId}`;
    const entry = netByCatalogItem.get(key) ?? { field, catalogId, net: 0 };
    entry.net += Number(m.delta);
    netByCatalogItem.set(key, entry);
  }

  for (const { field, catalogId, net } of netByCatalogItem.values()) {
    const restoreAmount = -net;
    if (restoreAmount <= 0) continue;
    const catalogModel =
      field === "ingredientId" ? "ingredient" : "packagingItem";

    const item = await tx[catalogModel].findUnique({
      where: { id: catalogId },
    });
    if (!item) continue;

    await tx[catalogModel].update({
      where: { id: catalogId },
      data: { currentStock: Number(item.currentStock) + restoreAmount },
    });
    await tx.stockMovement.create({
      data: {
        [field]: catalogId,
        delta: restoreAmount,
        reason: "CANCELLATION_REVERSAL",
        orderId,
      },
    });
  }
}

module.exports = { consumeStock, releaseStock, reverseStockForOrder };
