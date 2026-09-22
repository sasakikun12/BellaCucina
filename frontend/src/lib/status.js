import { API_BASE_URL } from "../api/client";

export function resolvePhotoUrl(url) {
  if (!url) return null;
  if (/^(https?:)?\/\//.test(url) || url.startsWith("data:")) return url;
  return `${API_BASE_URL}${url}`;
}

export const ORDER_STATUS_LABEL = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  SERVED: "Servido",
  DELIVERED: "Entregue",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

export const ORDER_STATUS_COLOR = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-300",
  CONFIRMED: "bg-sky-100 text-sky-800 border-sky-300",
  PREPARING: "bg-orange-100 text-orange-800 border-orange-300",
  READY: "bg-emerald-100 text-emerald-800 border-emerald-300",
  OUT_FOR_DELIVERY: "bg-violet-100 text-violet-800 border-violet-300",
  SERVED: "bg-teal-100 text-teal-800 border-teal-300",
  DELIVERED: "bg-teal-100 text-teal-800 border-teal-300",
  COMPLETED: "bg-stone-200 text-stone-700 border-stone-300",
  CANCELLED: "bg-red-100 text-red-800 border-red-300",
};

export const ITEM_STATUS_LABEL = {
  PENDING: "Pendente",
  PREPARING: "Em preparo",
  READY: "Pronto",
};

export const TABLE_STATUS_LABEL = {
  FREE: "Livre",
  OCCUPIED: "Ocupada",
  RESERVED: "Reservada",
};

export const TABLE_STATUS_COLOR = {
  FREE: "bg-emerald-100 text-emerald-800 border-emerald-300",
  OCCUPIED: "bg-red-100 text-red-800 border-red-300",
  RESERVED: "bg-amber-100 text-amber-800 border-amber-300",
};

export const ORDER_TYPE_LABEL = {
  DINE_IN: "No salão",
  TAKEAWAY: "Para viagem",
  DELIVERY: "Entrega",
};

export const ROLE_LABEL = {
  ADMIN: "Administrador(a)",
  WAITER: "Garçom/Garçonete",
  KITCHEN: "Cozinha",
  DELIVERY: "Entregador(a)",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function money(value) {
  return currencyFormatter.format(Number(value));
}

export const STOCK_MOVEMENT_REASON_LABEL = {
  SALE: "Venda",
  RESTOCK: "Reposição",
  ADJUSTMENT: "Perda",
  ORDER_ADJUSTMENT: "Ajuste de pedido",
  CANCELLATION_REVERSAL: "Cancelamento",
};

const UNIT_PAIRS = [
  { large: "kg", small: "g", factor: 1000 },
  { large: "L", small: "ml", factor: 1000 },
];

function normalizeQuantity(value, unit) {
  const abs = Math.abs(value);
  for (const { large, small, factor } of UNIT_PAIRS) {
    if (unit === large && abs > 0 && abs < 1) {
      return { value: Number((value * factor).toFixed(6)), unit: small };
    }
    if (unit === small && abs >= factor) {
      return { value: Number((value / factor).toFixed(6)), unit: large };
    }
  }
  return { value, unit };
}

export function quantity(value, unit) {
  const { value: n, unit: displayUnit } = normalizeQuantity(
    Number(value),
    unit,
  );
  const formatted = Number.isInteger(n)
    ? String(n)
    : n.toFixed(3).replace(/\.?0+$/, "");
  return `${formatted} ${displayUnit}`;
}

export function isLowStock(item) {
  return Number(item.currentStock) <= Number(item.minStock);
}

export function elapsedLabel(date) {
  const totalMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(date).getTime()) / 60000),
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}min`;
}
