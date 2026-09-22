import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { consumeStock, releaseStock, reverseStockForOrder } = require("../../src/lib/stock");

function makeTx({ recipeLines = [], items = {} } = {}) {
  const state = structuredClone(items);
  const movements = [];
  const updates = [];

  function catalogModel() {
    return {
      findUnique: vi.fn(({ where: { id } }) => Promise.resolve(state[id] ?? null)),
      update: vi.fn(({ where: { id }, data }) => {
        state[id] = { ...state[id], ...data };
        updates.push({ id, data });
        return Promise.resolve(state[id]);
      }),
    };
  }

  const tx = {
    recipeIngredient: { findMany: vi.fn().mockResolvedValue(recipeLines) },
    recipePackaging: { findMany: vi.fn().mockResolvedValue(recipeLines) },
    ingredient: catalogModel(),
    packagingItem: catalogModel(),
    stockMovement: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(({ data }) => {
        movements.push(data);
        return Promise.resolve(data);
      }),
    },
  };

  return { tx, state, movements, updates };
}

const INGREDIENT_OPTS = {
  recipeModel: "recipeIngredient",
  catalogModel: "ingredient",
  idField: "ingredientId",
  orderId: "order-1",
};

describe("lib/stock — consumeStock", () => {
  it("desconta o estoque proporcional à quantidade pedida e registra a venda", async () => {
    const { tx, state, movements } = makeTx({
      recipeLines: [{ menuItemId: "pizza", ingredientId: "flour", quantityPerUnit: 0.2 }],
      items: { flour: { id: "flour", name: "Farinha", unit: "kg", currentStock: 10 } },
    });

    await consumeStock(tx, [{ menuItemId: "pizza", quantity: 3 }], INGREDIENT_OPTS);

    expect(state.flour.currentStock).toBeCloseTo(9.4);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ ingredientId: "flour", reason: "SALE", orderId: "order-1" });
    expect(movements[0].delta).toBeCloseTo(-0.6);
  });

  it("soma as quantidades de itens diferentes que compartilham o mesmo ingrediente", async () => {
    const { tx, state } = makeTx({
      recipeLines: [
        { menuItemId: "pizza", ingredientId: "cheese", quantityPerUnit: 0.1 },
        { menuItemId: "lasanha", ingredientId: "cheese", quantityPerUnit: 0.15 },
      ],
      items: { cheese: { id: "cheese", name: "Queijo", unit: "kg", currentStock: 5 } },
    });

    await consumeStock(
      tx,
      [
        { menuItemId: "pizza", quantity: 2 },
        { menuItemId: "lasanha", quantity: 1 },
      ],
      INGREDIENT_OPTS,
    );

    expect(state.cheese.currentStock).toBeCloseTo(4.65);
  });

  it("lança ApiError(400) e não altera o estoque quando o pedido deixaria algo negativo", async () => {
    const { tx, state, updates } = makeTx({
      recipeLines: [{ menuItemId: "pizza", ingredientId: "flour", quantityPerUnit: 1 }],
      items: { flour: { id: "flour", name: "Farinha", unit: "kg", currentStock: 2 } },
    });

    await expect(consumeStock(tx, [{ menuItemId: "pizza", quantity: 5 }], INGREDIENT_OPTS)).rejects.toMatchObject({
      status: 400,
    });

    expect(updates).toHaveLength(0);
    expect(state.flour.currentStock).toBe(2);
  });

  it("ignora silenciosamente um item de catálogo já excluído", async () => {
    const { tx, movements } = makeTx({
      recipeLines: [{ menuItemId: "pizza", ingredientId: "ghost", quantityPerUnit: 1 }],
      items: {},
    });

    await expect(consumeStock(tx, [{ menuItemId: "pizza", quantity: 1 }], INGREDIENT_OPTS)).resolves.toBeUndefined();
    expect(movements).toHaveLength(0);
  });

  it("não faz nada quando o item do cardápio não tem receita", async () => {
    const { tx, movements } = makeTx({ recipeLines: [] });
    await consumeStock(tx, [{ menuItemId: "agua", quantity: 1 }], INGREDIENT_OPTS);
    expect(movements).toHaveLength(0);
  });
});

describe("lib/stock — releaseStock", () => {
  it("devolve ao estoque a quantidade proporcional e registra ORDER_ADJUSTMENT", async () => {
    const { tx, state, movements } = makeTx({
      recipeLines: [{ menuItemId: "pizza", ingredientId: "flour", quantityPerUnit: 0.2 }],
      items: { flour: { id: "flour", name: "Farinha", unit: "kg", currentStock: 5 } },
    });

    await releaseStock(tx, "pizza", 2, INGREDIENT_OPTS);

    expect(state.flour.currentStock).toBeCloseTo(5.4);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ ingredientId: "flour", reason: "ORDER_ADJUSTMENT", orderId: "order-1" });
    expect(movements[0].delta).toBeCloseTo(0.4);
  });

  it("não faz nada para quantidade zero ou negativa", async () => {
    const { tx, movements } = makeTx({
      recipeLines: [{ menuItemId: "pizza", ingredientId: "flour", quantityPerUnit: 1 }],
    });

    await releaseStock(tx, "pizza", 0, INGREDIENT_OPTS);
    await releaseStock(tx, "pizza", -1, INGREDIENT_OPTS);

    expect(movements).toHaveLength(0);
  });
});

describe("lib/stock — reverseStockForOrder", () => {
  it("devolve o saldo líquido ainda comprometido com o pedido", async () => {
    const { tx, state } = makeTx({ items: { flour: { id: "flour", name: "Farinha", unit: "kg", currentStock: 3 } } });
    tx.stockMovement.findMany = vi.fn().mockResolvedValue([
      { ingredientId: "flour", packagingItemId: null, delta: -5, reason: "SALE" },
      { ingredientId: "flour", packagingItemId: null, delta: 2, reason: "ORDER_ADJUSTMENT" },
    ]);

    await reverseStockForOrder(tx, "order-1");

    expect(state.flour.currentStock).toBeCloseTo(6);
  });

  it("não devolve nada quando o saldo já está zerado", async () => {
    const { tx, updates } = makeTx({ items: { flour: { id: "flour", name: "Farinha", unit: "kg", currentStock: 3 } } });
    tx.stockMovement.findMany = vi.fn().mockResolvedValue([
      { ingredientId: "flour", packagingItemId: null, delta: -5, reason: "SALE" },
      { ingredientId: "flour", packagingItemId: null, delta: 5, reason: "ORDER_ADJUSTMENT" },
    ]);

    await reverseStockForOrder(tx, "order-1");

    expect(updates).toHaveLength(0);
  });

  it("devolve também o saldo de embalagem (movimento sem ingredientId)", async () => {
    const { tx, state } = makeTx({
      items: { box: { id: "box", name: "Caixa", unit: "un", currentStock: 10 } },
    });
    tx.stockMovement.findMany = vi.fn().mockResolvedValue([
      { ingredientId: null, packagingItemId: "box", delta: -4, reason: "SALE" },
    ]);

    await reverseStockForOrder(tx, "order-1");

    expect(state.box.currentStock).toBeCloseTo(14);
  });

  it("ignora um item de catálogo já excluído ao reverter", async () => {
    const { tx, updates } = makeTx({ items: {} });
    tx.stockMovement.findMany = vi.fn().mockResolvedValue([
      { ingredientId: "sumiu", packagingItemId: null, delta: -3, reason: "SALE" },
    ]);

    await reverseStockForOrder(tx, "order-1");

    expect(updates).toHaveLength(0);
  });
});

describe("lib/stock — ramos de borda", () => {
  it("consumeStock não faz nada quando a lista de itens está vazia", async () => {
    const { tx, movements } = makeTx({ recipeLines: [] });
    await consumeStock(tx, [], INGREDIENT_OPTS);
    expect(movements).toHaveLength(0);
  });

  it("consumeStock ignora linhas de receita de itens que não estão no pedido", async () => {
    const { tx, state, movements } = makeTx({
      recipeLines: [
        { menuItemId: "pizza", ingredientId: "flour", quantityPerUnit: 1 },
        { menuItemId: "salada", ingredientId: "flour", quantityPerUnit: 5 },
      ],
      items: { flour: { id: "flour", name: "Farinha", unit: "kg", currentStock: 10 } },
    });

    await consumeStock(tx, [{ menuItemId: "pizza", quantity: 2 }], INGREDIENT_OPTS);

    expect(state.flour.currentStock).toBeCloseTo(8);
    expect(movements).toHaveLength(1);
  });

  it("consumeStock ignora uma linha cujo consumo calculado é zero", async () => {
    const { tx, movements } = makeTx({
      recipeLines: [{ menuItemId: "pizza", ingredientId: "flour", quantityPerUnit: 0 }],
      items: { flour: { id: "flour", name: "Farinha", unit: "kg", currentStock: 10 } },
    });

    await consumeStock(tx, [{ menuItemId: "pizza", quantity: 3 }], INGREDIENT_OPTS);

    expect(movements).toHaveLength(0);
  });

  it("releaseStock ignora uma linha cuja devolução calculada é zero", async () => {
    const { tx, movements } = makeTx({
      recipeLines: [{ menuItemId: "pizza", ingredientId: "flour", quantityPerUnit: 0 }],
      items: { flour: { id: "flour", name: "Farinha", unit: "kg", currentStock: 5 } },
    });

    await releaseStock(tx, "pizza", 2, INGREDIENT_OPTS);

    expect(movements).toHaveLength(0);
  });

  it("releaseStock ignora um item de catálogo já excluído", async () => {
    const { tx, updates } = makeTx({
      recipeLines: [{ menuItemId: "pizza", ingredientId: "sumiu", quantityPerUnit: 1 }],
      items: {},
    });

    await releaseStock(tx, "pizza", 2, INGREDIENT_OPTS);

    expect(updates).toHaveLength(0);
  });
});
