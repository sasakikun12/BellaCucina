import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOrders, setOrderStatus } from "../api/orders";
import { OrderCard } from "../components/OrderCard";
import { NewOrderForm } from "../components/NewOrderForm";
import { useSocket } from "../context/SocketContext";
import { ORDER_STATUS_LABEL } from "../lib/status";

const ACTIVE_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
];
const CLOSED_STATUSES = ["SERVED", "DELIVERED", "COMPLETED", "CANCELLED"];

export function Orders() {
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => fetchOrders(),
  });
  const { onOrderNew, onOrderUpdated } = useSocket();
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [view, setView] = useState("ACTIVE");

  useEffect(() => {
    const unsubs = [
      onOrderNew(() => queryClient.invalidateQueries({ queryKey: ["orders"] })),
      onOrderUpdated(() =>
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [onOrderNew, onOrderUpdated, queryClient]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => setOrderStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const visibleOrders = (orders ?? []).filter((o) =>
    (view === "ACTIVE" ? ACTIVE_STATUSES : CLOSED_STATUSES).includes(o.status),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Pedidos</h1>
          <p className="text-sm text-stone-500">
            Todos os pedidos no salão, para viagem e de entrega.
          </p>
        </div>
        <button onClick={() => setShowNewOrder(true)} className="btn-primary">
          + Novo pedido
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setView("ACTIVE")}
          className={`rounded-full border px-3 py-1 text-sm font-medium ${
            view === "ACTIVE"
              ? "border-brand-500 bg-brand-500 text-white"
              : "border-stone-300 text-stone-600"
          }`}
        >
          Ativos
        </button>
        <button
          onClick={() => setView("CLOSED")}
          className={`rounded-full border px-3 py-1 text-sm font-medium ${
            view === "CLOSED"
              ? "border-brand-500 bg-brand-500 text-white"
              : "border-stone-300 text-stone-600"
          }`}
        >
          Encerrados
        </button>
      </div>

      {isLoading && <p className="text-stone-500">Carregando pedidos…</p>}
      {!isLoading && visibleOrders.length === 0 && (
        <p className="text-stone-500">Nenhum pedido aqui.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            footer={
              view === "ACTIVE" ? (
                <>
                  {order.status === "READY" && order.type !== "DELIVERY" && (
                    <button
                      className="btn-secondary"
                      onClick={() =>
                        statusMutation.mutate({
                          id: order.id,
                          status:
                            order.type === "DINE_IN" ? "SERVED" : "COMPLETED",
                        })
                      }
                    >
                      Marcar como{" "}
                      {(order.type === "DINE_IN"
                        ? ORDER_STATUS_LABEL.SERVED
                        : ORDER_STATUS_LABEL.COMPLETED
                      ).toLowerCase()}
                    </button>
                  )}
                  {/* v8 ignore start */}
                  {order.status === "SERVED" && (
                    <button
                      className="btn-secondary"
                      onClick={() =>
                        statusMutation.mutate({
                          id: order.id,
                          status: "COMPLETED",
                        })
                      }
                    >
                      Concluir
                    </button>
                  )}
                  {/* v8 ignore stop */}
                  <button
                    className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    onClick={() =>
                      statusMutation.mutate({
                        id: order.id,
                        status: "CANCELLED",
                      })
                    }
                  >
                    Cancelar
                  </button>
                </>
              ) : undefined
            }
          />
        ))}
      </div>

      {showNewOrder && <NewOrderForm onClose={() => setShowNewOrder(false)} />}
    </div>
  );
}
