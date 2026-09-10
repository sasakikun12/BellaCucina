import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignDriver, fetchOrders, setOrderStatus } from "../api/orders";
import { OrderCard } from "../components/OrderCard";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";

export function Delivery() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", "delivery"],
    queryFn: () => fetchOrders({ type: "DELIVERY" }),
    refetchInterval: 30_000,
  });
  const { onOrderNew, onOrderUpdated } = useSocket();

  useEffect(() => {
    const unsubs = [
      onOrderNew(() =>
        queryClient.invalidateQueries({ queryKey: ["orders", "delivery"] }),
      ),
      onOrderUpdated(() =>
        queryClient.invalidateQueries({ queryKey: ["orders", "delivery"] }),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [onOrderNew, onOrderUpdated, queryClient]);

  const claimMutation = useMutation({
    mutationFn: (orderId) => assignDriver(orderId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["orders", "delivery"] }),
  });
  const deliveredMutation = useMutation({
    mutationFn: (orderId) => setOrderStatus(orderId, "DELIVERED"),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["orders", "delivery"] }),
  });

  const readyToClaim = (orders ?? []).filter((o) => o.status === "READY");
  const outForDelivery = (orders ?? []).filter(
    (o) => o.status === "OUT_FOR_DELIVERY",
  );
  const inKitchen = (orders ?? []).filter((o) =>
    ["PENDING", "CONFIRMED", "PREPARING"].includes(o.status),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Entregas</h1>
        <p className="text-sm text-stone-500">
          Assuma pedidos prontos e atualize quando forem entregues.
        </p>
      </div>

      {isLoading && <p className="text-stone-500">Carregando entregas…</p>}

      <Section
        title="Prontos para retirada"
        empty="Nenhum pedido de entrega pronto ainda."
      >
        {readyToClaim.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            footer={
              <button
                className="btn-primary"
                onClick={() => claimMutation.mutate(order.id)}
              >
                Assumir e sair
              </button>
            }
          />
        ))}
      </Section>

      <Section title="Saíram para entrega" empty="Nada na rua no momento.">
        {outForDelivery.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            footer={
              order.driverId === user?.id || user?.role === "ADMIN" ? (
                <button
                  className="btn-primary"
                  onClick={() => deliveredMutation.mutate(order.id)}
                >
                  Marcar como entregue
                </button>
              ) : undefined
            }
          />
        ))}
      </Section>

      <Section title="Ainda em preparo" empty="Nada na cozinha para entrega.">
        {inKitchen.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, empty, children }) {
  /* v8 ignore next */
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
      {!hasChildren && <p className="text-sm text-stone-500">{empty}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  );
}
