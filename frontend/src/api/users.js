import { api } from "./client";

export async function fetchUsers() {
  const { data } = await api.get("/users");
  return data;
}

export async function createUser(payload) {
  const { data } = await api.post("/users", payload);
  return data;
}

export async function deleteUser(id) {
  await api.delete(`/users/${id}`);
}
