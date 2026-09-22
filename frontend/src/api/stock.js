import { api } from "./client";

function buildCatalogApi(basePath) {
  return {
    fetchAll: async () => {
      const { data } = await api.get(basePath);
      return data;
    },
    create: async (payload) => {
      const { data } = await api.post(basePath, payload);
      return data;
    },
    update: async (id, payload) => {
      const { data } = await api.put(`${basePath}/${id}`, payload);
      return data;
    },
    remove: async (id) => {
      await api.delete(`${basePath}/${id}`);
    },
    adjust: async (id, delta, reason) => {
      const { data } = await api.patch(`${basePath}/${id}/adjust`, {
        delta,
        reason,
      });
      return data;
    },
  };
}

export const ingredientsApi = buildCatalogApi("/stock/ingredients");
export const packagingApi = buildCatalogApi("/stock/packaging");

export async function fetchStockMovements() {
  const { data } = await api.get("/stock/movements");
  return data;
}
