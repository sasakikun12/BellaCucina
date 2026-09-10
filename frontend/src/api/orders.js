import { api } from "./client";

export async function fetchOrders(filters) {
  const { data } = await api.get("/orders", { params: filters });
  return data;
}

export async function fetchOrder(id) {
  const { data } = await api.get(`/orders/${id}`);
  return data;
}

export async function createOrder(payload) {
  const { data } = await api.post("/orders", payload);
  return data;
}

export async function setOrderStatus(id, status) {
  const { data } = await api.patch(`/orders/${id}/status`, { status });
  return data;
}

export async function setOrderItemStatus(orderId, itemId, status) {
  const { data } = await api.patch(`/orders/${orderId}/items/${itemId}/status`, { status });
  return data;
}

export async function assignDriver(orderId) {
  const { data } = await api.patch(`/orders/${orderId}/assign-driver`, {});
  return data;
}

export async function addOrderItem(orderId, { menuItemId, quantity, notes }) {
  const { data } = await api.post(`/orders/${orderId}/items`, { menuItemId, quantity, notes });
  return data;
}

export async function setOrderItemQuantity(orderId, itemId, quantity) {
  const { data } = await api.patch(`/orders/${orderId}/items/${itemId}/quantity`, { quantity });
  return data;
}

export async function removeOrderItem(orderId, itemId) {
  const { data } = await api.delete(`/orders/${orderId}/items/${itemId}`);
  return data;
}
