import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOrders, setOrderItemStatus } from "../api/orders";
import { useSocket } from "../context/SocketContext";
import {
  ITEM_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  elapsedLabel,
} from "../lib/status";
import { StatusBadge } from "../components/StatusBadge";

const KITCHEN_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"];

const NEXT_ITEM_STATUS = {
  PENDING: "PREPARING",
  PREPARING: "READY",
  READY: null,
};

export function Kitchen() {
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", "kitchen"],
    queryFn: () => fetchOrders(),
    refetchInterval: 30_000,
  });
  const { onOrderNew, onOrderUpdated } = useSocket();

  useEffect(() => {
    const unsubs = [
      onOrderNew(() =>
        queryClient.invalidateQueries({ queryKey: ["orders", "kitchen"] }),
      ),
      onOrderUpdated(() =>
        queryClient.invalidateQueries({ queryKey: ["orders", "kitchen"] }),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [onOrderNew, onOrderUpdated, queryClient]);

  const itemStatusMutation = useMutation({
    mutationFn: ({ orderId, itemId, status }) =>
      setOrderItemStatus(orderId, itemId, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["orders", "kitchen"] }),
  });

  const queue = (orders ?? [])
    .filter((o) => KITCHEN_STATUSES.includes(o.status))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Cozinha</h1>
        <p className="text-sm text-stone-500">
          Fila de preparo, pedidos mais antigos primeiro. Atualiza em tempo
          real.
        </p>
      </div>

      {isLoading && <p className="text-stone-500">Carregando fila…</p>}
      {!isLoading && queue.length === 0 && (
        <p className="text-stone-500">Nenhum pedido ativo na cozinha. 🎉</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {queue.map((order) => {
          const label =
            order.type === "DINE_IN" && order.table
              ? `Mesa ${order.table.number}`
              : order.customerName
                ? `${ORDER_TYPE_LABEL[order.type]} · ${order.customerName}`
                : ORDER_TYPE_LABEL[order.type];
          return (
            <div
              key={order.id}
              className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-stone-800">{label}</div>
                  <div className="text-xs text-stone-400">
                    {ORDER_TYPE_LABEL[order.type]} · esperando há{" "}
                    {elapsedLabel(order.createdAt)}
                  </div>
                </div>
                <StatusBadge
                  label={ORDER_STATUS_LABEL[order.status]}
                  colorClasses={ORDER_STATUS_COLOR[order.status]}
                />
              </div>

              {order.notes && (
                <div className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  📝 {order.notes}
                </div>
              )}

              <ul className="flex flex-col gap-2">
                {order.items.map((item) => {
                  const next = NEXT_ITEM_STATUS[item.status];
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-stone-50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 text-stone-700">
                        <span className="font-semibold">{item.quantity}×</span>{" "}
                        {item.menuItem.name}
                        {item.notes && (
                          <span className="ml-1 text-xs italic text-stone-400">
                            ({item.notes})
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-400">
                          {ITEM_STATUS_LABEL[item.status]}
                        </span>
                        {next && (
                          <button
                            onClick={() =>
                              itemStatusMutation.mutate({
                                orderId: order.id,
                                itemId: item.id,
                                status: next,
                              })
                            }
                            className="w-28 shrink-0 whitespace-nowrap rounded-md bg-brand-500 px-2 py-2 text-center text-xs font-medium text-white hover:bg-brand-600"
                          >
                            {ITEM_STATUS_LABEL[next]}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
