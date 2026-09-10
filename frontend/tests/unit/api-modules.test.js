import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../src/api/client", () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  return { api, API_BASE_URL: "http://localhost:4000" };
});

import { api } from "../../src/api/client";
import * as authApi from "../../src/api/auth";
import * as menuApi from "../../src/api/menu";
import * as ordersApi from "../../src/api/orders";
import * as tablesApi from "../../src/api/tables";
import * as usersApi from "../../src/api/users";
import { ingredientsApi, packagingApi, fetchStockMovements } from "../../src/api/stock";

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of ["get", "post", "put", "patch", "delete"]) api[m].mockResolvedValue({ data: { ok: true } });
});

describe("api/auth", () => {
  it("login faz POST /auth/login e devolve data", async () => {
    api.post.mockResolvedValue({ data: { token: "t" } });
    const out = await authApi.login("a@b.com", "pw");
    expect(api.post).toHaveBeenCalledWith("/auth/login", { email: "a@b.com", password: "pw" });
    expect(out).toEqual({ token: "t" });
  });

  it("fetchMe faz GET /auth/me", async () => {
    await authApi.fetchMe();
    expect(api.get).toHaveBeenCalledWith("/auth/me");
  });
});

describe("api/menu", () => {
  it("fetchMenuItems / fetchCategories", async () => {
    await menuApi.fetchMenuItems();
    expect(api.get).toHaveBeenCalledWith("/menu");
    await menuApi.fetchCategories();
    expect(api.get).toHaveBeenCalledWith("/menu/categories");
  });

  it("createCategory / deleteCategory", async () => {
    await menuApi.createCategory("Bebidas");
    expect(api.post).toHaveBeenCalledWith("/menu/categories", { name: "Bebidas" });
    await menuApi.deleteCategory("c1");
    expect(api.delete).toHaveBeenCalledWith("/menu/categories/c1");
  });

  it("createMenuItem envia FormData com photoFile quando presente", async () => {
    const file = new File(["x"], "p.png", { type: "image/png" });
    await menuApi.createMenuItem({
      name: "Pizza",
      description: "d",
      price: 30,
      categoryId: "c1",
      available: true,
      photoFile: file,
    });
    const [url, fd, config] = api.post.mock.calls[0];
    expect(url).toBe("/menu");
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get("name")).toBe("Pizza");
    expect(fd.get("price")).toBe("30");
    expect(fd.get("available")).toBe("true");
    expect(fd.get("photo")).toBeInstanceOf(File);
    expect(fd.get("photoUrl")).toBeNull();
    expect(config.headers["Content-Type"]).toBe("multipart/form-data");
  });

  it("updateMenuItem envia photoUrl quando não há photoFile", async () => {
    await menuApi.updateMenuItem("m1", {
      name: "X",
      description: "d",
      price: 1,
      categoryId: "c1",
      available: false,
      photoUrl: "https://x/y.jpg",
    });
    const [url, fd] = api.put.mock.calls[0];
    expect(url).toBe("/menu/m1");
    expect(fd.get("photoUrl")).toBe("https://x/y.jpg");
    expect(fd.get("photo")).toBeNull();
    expect(fd.get("available")).toBe("false");
  });

  it("createMenuItem sem foto alguma não anexa photo nem photoUrl", async () => {
    await menuApi.createMenuItem({ name: "X", description: "d", price: 1, categoryId: "c1", available: true });
    const [, fd] = api.post.mock.calls[0];
    expect(fd.get("photo")).toBeNull();
    expect(fd.get("photoUrl")).toBeNull();
  });

  it("deleteMenuItem / fetchMenuItemRecipe / saveMenuItemRecipe", async () => {
    await menuApi.deleteMenuItem("m1");
    expect(api.delete).toHaveBeenCalledWith("/menu/m1");

    await menuApi.fetchMenuItemRecipe("m1");
    expect(api.get).toHaveBeenCalledWith("/menu/m1/recipe");

    await menuApi.saveMenuItemRecipe("m1", { ingredients: [1], packaging: [2] });
    expect(api.put).toHaveBeenCalledWith("/menu/m1/recipe", { ingredients: [1], packaging: [2] });
  });
});

describe("api/orders", () => {
  it("cobre todos os wrappers", async () => {
    await ordersApi.fetchOrders({ type: "DELIVERY" });
    expect(api.get).toHaveBeenCalledWith("/orders", { params: { type: "DELIVERY" } });

    await ordersApi.fetchOrder("o1");
    expect(api.get).toHaveBeenCalledWith("/orders/o1");

    await ordersApi.createOrder({ type: "TAKEAWAY" });
    expect(api.post).toHaveBeenCalledWith("/orders", { type: "TAKEAWAY" });

    await ordersApi.setOrderStatus("o1", "READY");
    expect(api.patch).toHaveBeenCalledWith("/orders/o1/status", { status: "READY" });

    await ordersApi.setOrderItemStatus("o1", "i1", "PREPARING");
    expect(api.patch).toHaveBeenCalledWith("/orders/o1/items/i1/status", { status: "PREPARING" });

    await ordersApi.assignDriver("o1");
    expect(api.patch).toHaveBeenCalledWith("/orders/o1/assign-driver", {});

    await ordersApi.addOrderItem("o1", { menuItemId: "m1", quantity: 2, notes: "sem cebola" });
    expect(api.post).toHaveBeenCalledWith("/orders/o1/items", { menuItemId: "m1", quantity: 2, notes: "sem cebola" });

    await ordersApi.setOrderItemQuantity("o1", "i1", 5);
    expect(api.patch).toHaveBeenCalledWith("/orders/o1/items/i1/quantity", { quantity: 5 });

    await ordersApi.removeOrderItem("o1", "i1");
    expect(api.delete).toHaveBeenCalledWith("/orders/o1/items/i1");
  });
});

describe("api/tables", () => {
  it("cobre todos os wrappers", async () => {
    await tablesApi.fetchTables();
    expect(api.get).toHaveBeenCalledWith("/tables");
    await tablesApi.createTable(5, 4);
    expect(api.post).toHaveBeenCalledWith("/tables", { number: 5, capacity: 4 });
    await tablesApi.setTableStatus("t1", "FREE");
    expect(api.patch).toHaveBeenCalledWith("/tables/t1/status", { status: "FREE" });
    await tablesApi.deleteTable("t1");
    expect(api.delete).toHaveBeenCalledWith("/tables/t1");
  });
});

describe("api/users", () => {
  it("cobre todos os wrappers", async () => {
    await usersApi.fetchUsers();
    expect(api.get).toHaveBeenCalledWith("/users");
    await usersApi.createUser({ name: "X" });
    expect(api.post).toHaveBeenCalledWith("/users", { name: "X" });
    await usersApi.deleteUser("u1");
    expect(api.delete).toHaveBeenCalledWith("/users/u1");
  });
});

describe("api/stock", () => {
  it("ingredientsApi cobre fetchAll/create/update/remove/adjust no caminho certo", async () => {
    await ingredientsApi.fetchAll();
    expect(api.get).toHaveBeenCalledWith("/stock/ingredients");
    await ingredientsApi.create({ name: "Sal" });
    expect(api.post).toHaveBeenCalledWith("/stock/ingredients", { name: "Sal" });
    await ingredientsApi.update("i1", { minStock: 3 });
    expect(api.put).toHaveBeenCalledWith("/stock/ingredients/i1", { minStock: 3 });
    await ingredientsApi.remove("i1");
    expect(api.delete).toHaveBeenCalledWith("/stock/ingredients/i1");
    await ingredientsApi.adjust("i1", 5, "RESTOCK");
    expect(api.patch).toHaveBeenCalledWith("/stock/ingredients/i1/adjust", { delta: 5, reason: "RESTOCK" });
  });

  it("packagingApi usa o basePath de embalagens", async () => {
    await packagingApi.fetchAll();
    expect(api.get).toHaveBeenCalledWith("/stock/packaging");
    await packagingApi.adjust("p1", -2, "ADJUSTMENT");
    expect(api.patch).toHaveBeenCalledWith("/stock/packaging/p1/adjust", { delta: -2, reason: "ADJUSTMENT" });
  });

  it("fetchStockMovements faz GET /stock/movements", async () => {
    await fetchStockMovements();
    expect(api.get).toHaveBeenCalledWith("/stock/movements");
  });
});
