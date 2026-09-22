import { api } from "./client";

export async function fetchTables() {
  const { data } = await api.get("/tables");
  return data;
}

export async function createTable(number, capacity) {
  const { data } = await api.post("/tables", { number, capacity });
  return data;
}

export async function setTableStatus(id, status) {
  const { data } = await api.patch(`/tables/${id}/status`, { status });
  return data;
}

export async function deleteTable(id) {
  await api.delete(`/tables/${id}`);
}
