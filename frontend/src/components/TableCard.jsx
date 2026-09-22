import { TABLE_STATUS_COLOR, TABLE_STATUS_LABEL, money } from "../lib/status";
import { StatusBadge } from "./StatusBadge";

export function TableCard({ table, onClick }) {
  const activeOrder = table.orders?.[0];
  const total = activeOrder ? activeOrder.items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0) : 0;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-white p-5 text-center shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="text-2xl font-bold text-stone-800">#{table.number}</div>
      <div className="text-xs text-stone-500">{table.capacity} lugares</div>
      <StatusBadge label={TABLE_STATUS_LABEL[table.status]} colorClasses={TABLE_STATUS_COLOR[table.status]} />
      {activeOrder && (
        <div className="mt-1 text-xs text-stone-500">
          Pedido em andamento · {money(total)}
        </div>
      )}
    </button>
  );
}
