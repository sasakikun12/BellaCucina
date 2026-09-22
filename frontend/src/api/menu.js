import { api } from "./client";

export async function fetchMenuItems() {
  const { data } = await api.get("/menu");
  return data;
}

export async function fetchCategories() {
  const { data } = await api.get("/menu/categories");
  return data;
}

export async function createCategory(name) {
  const { data } = await api.post("/menu/categories", { name });
  return data;
}

export async function deleteCategory(id) {
  await api.delete(`/menu/categories/${id}`);
}

function toFormData(data) {
  const fd = new FormData();
  fd.append("name", data.name);
  fd.append("description", data.description);
  fd.append("price", String(data.price));
  fd.append("categoryId", data.categoryId);
  fd.append("available", String(data.available));
  if (data.photoFile) fd.append("photo", data.photoFile);
  else if (data.photoUrl) fd.append("photoUrl", data.photoUrl);
  return fd;
}

export async function createMenuItem(data) {
  const { data: item } = await api.post("/menu", toFormData(data), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return item;
}

export async function updateMenuItem(id, data) {
  const { data: item } = await api.put(`/menu/${id}`, toFormData(data), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return item;
}

export async function deleteMenuItem(id) {
  await api.delete(`/menu/${id}`);
}

export async function fetchMenuItemRecipe(menuItemId) {
  const { data } = await api.get(`/menu/${menuItemId}/recipe`);
  return data;
}

export async function saveMenuItemRecipe(menuItemId, { ingredients, packaging }) {
  await api.put(`/menu/${menuItemId}/recipe`, { ingredients, packaging });
}
