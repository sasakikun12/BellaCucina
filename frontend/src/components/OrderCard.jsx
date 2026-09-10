import { ITEM_STATUS_LABEL, ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, ORDER_TYPE_LABEL, money } from "../lib/status";
import { StatusBadge } from "./StatusBadge";

export function OrderCard({ order, footer, children, editableItems, onIncreaseItem, onDecreaseItem, onRemoveItem }) {
  const label =
    order.type === "DINE_IN"
      ? order.table
        ? `Mesa ${order.table.number}`
        : "Pedido no salão"
      : order.type === "DELIVERY"
        ? order.customerName || "Pedido de entrega"
        : order.customerName || "Pedido para viagem";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-stone-800">{label}</div>
          <div className="text-xs text-stone-400">
            {ORDER_TYPE_LABEL[order.type]} · {new Date(order.createdAt).toLocaleTimeString("pt-BR")}
          </div>
        </div>
        <StatusBadge label={ORDER_STATUS_LABEL[order.status]} colorClasses={ORDER_STATUS_COLOR[order.status]} />
      </div>

      <ul className="flex flex-col gap-1 text-sm">
        {order.items.map((item) =>
          editableItems ? (
            <li key={item.id} className="flex items-center justify-between gap-2 text-stone-600">
              <span className="flex-1">{item.menuItem.name}</span>
              <span className="text-xs text-stone-400">{ITEM_STATUS_LABEL[item.status]}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onDecreaseItem(item)}
                  className="h-6 w-6 rounded-full border border-stone-300 text-stone-600 hover:bg-stone-50"
                  aria-label={`Diminuir quantidade de ${item.menuItem.name}`}
                >
                  −
                </button>
                <span className="w-4 text-center font-medium text-stone-800">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => onIncreaseItem(item)}
                  className="h-6 w-6 rounded-full border border-stone-300 text-stone-600 hover:bg-stone-50"
                  aria-label={`Aumentar quantidade de ${item.menuItem.name}`}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item)}
                  className="ml-1 text-xs font-medium text-red-600 hover:underline"
                >
                  Remover
                </button>
              </div>
            </li>
          ) : (
            <li key={item.id} className="flex items-center justify-between text-stone-600">
              <span>
                <span className="font-medium text-stone-800">{item.quantity}×</span> {item.menuItem.name}
              </span>
              <span className="text-xs text-stone-400">{ITEM_STATUS_LABEL[item.status]}</span>
            </li>
          )
        )}
      </ul>

      {order.deliveryAddress && (
        <div className="rounded-md bg-stone-50 px-2 py-1 text-xs text-stone-500">📍 {order.deliveryAddress}</div>
      )}
      {order.notes && <div className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">📝 {order.notes}</div>}

      <div className="flex items-center justify-between border-t border-stone-100 pt-2">
        <span className="text-sm font-semibold text-stone-800">Total {money(order.total)}</span>
        {order.driver && <span className="text-xs text-stone-400">Entregador(a): {order.driver.name}</span>}
      </div>

      {children}
      {footer && <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">{footer}</div>}
    </div>
  );
}
