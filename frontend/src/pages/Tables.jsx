import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTables, setTableStatus } from "../api/tables";
import {
  addOrderItem,
  removeOrderItem,
  setOrderItemQuantity,
  setOrderStatus,
} from "../api/orders";
import { fetchCategories, fetchMenuItems } from "../api/menu";
import { TableCard } from "../components/TableCard";
import { NewOrderForm } from "../components/NewOrderForm";
import { Modal } from "../components/Modal";
import { OrderCard } from "../components/OrderCard";
import { useSocket } from "../context/SocketContext";
import { ORDER_STATUS_LABEL, money } from "../lib/status";

export function Tables() {
  const queryClient = useQueryClient();
  const { data: tables, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: fetchTables,
  });
  const { data: menuItems } = useQuery({
    queryKey: ["menu"],
    queryFn: fetchMenuItems,
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const { onTableUpdated, onOrderUpdated, onOrderNew } = useSocket();

  const [selectedTable, setSelectedTable] = useState(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrderTableId, setNewOrderTableId] = useState(undefined);
  const [itemError, setItemError] = useState(null);

  useEffect(() => {
    const unsubs = [
      onTableUpdated(() =>
        queryClient.invalidateQueries({ queryKey: ["tables"] }),
      ),
      onOrderUpdated(() =>
        queryClient.invalidateQueries({ queryKey: ["tables"] }),
      ),
      onOrderNew(() => queryClient.invalidateQueries({ queryKey: ["tables"] })),
    ];
    return () => unsubs.forEach((u) => u());
  }, [onTableUpdated, onOrderUpdated, onOrderNew, queryClient]);

  const freeMutation = useMutation({
    mutationFn: (id) => setTableStatus(id, "FREE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
  });

  const orderStatusMutation = useMutation({
    mutationFn: ({ id, status }) => setOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setSelectedTable(null);
    },
  });

  function onItemMutationError(err) {
    setItemError(
      err?.response?.data?.error || "Não foi possível atualizar o pedido.",
    );
  }
  function onItemMutationSuccess() {
    setItemError(null);
    queryClient.invalidateQueries({ queryKey: ["tables"] });
  }

  const addItemMutation = useMutation({
    mutationFn: ({ orderId, menuItemId, quantity }) =>
      addOrderItem(orderId, { menuItemId, quantity }),
    onSuccess: onItemMutationSuccess,
    onError: onItemMutationError,
  });
  const quantityMutation = useMutation({
    mutationFn: ({ orderId, itemId, quantity }) =>
      setOrderItemQuantity(orderId, itemId, quantity),
    onSuccess: onItemMutationSuccess,
    onError: onItemMutationError,
  });
  const removeItemMutation = useMutation({
    mutationFn: ({ orderId, itemId }) => removeOrderItem(orderId, itemId),
    onSuccess: onItemMutationSuccess,
    onError: onItemMutationError,
  });

  const liveSelected = selectedTable
    ? (tables?.find((t) => t.id === selectedTable.id) ?? selectedTable)
    : null;
  const activeOrder = liveSelected?.orders?.[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Mesas</h1>
          <p className="text-sm text-stone-500">
            Clique em uma mesa para receber clientes ou gerenciar o pedido.
          </p>
        </div>
        <button
          onClick={() => {
            setNewOrderTableId(undefined);
            setShowNewOrder(true);
          }}
          className="btn-primary"
        >
          + Novo pedido
        </button>
      </div>

      {isLoading && <p className="text-stone-500">Carregando mesas…</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {tables?.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            onClick={() => setSelectedTable(table)}
          />
        ))}
      </div>

      {showNewOrder && (
        <NewOrderForm
          onClose={() => setShowNewOrder(false)}
          presetType={newOrderTableId ? "DINE_IN" : undefined}
          presetTableId={newOrderTableId}
        />
      )}

      {liveSelected && (
        <Modal
          title={`Mesa ${liveSelected.number}`}
          onClose={() => {
            setSelectedTable(null);
            setItemError(null);
          }}
          wide={Boolean(activeOrder)}
        >
          <div className="flex flex-col gap-4">
            {activeOrder ? (
              <>
                <OrderCard
                  order={activeOrder}
                  editableItems
                  onIncreaseItem={(item) =>
                    quantityMutation.mutate({
                      orderId: activeOrder.id,
                      itemId: item.id,
                      quantity: item.quantity + 1,
                    })
                  }
                  onDecreaseItem={(item) => {
                    if (item.quantity <= 1) {
                      removeItemMutation.mutate({
                        orderId: activeOrder.id,
                        itemId: item.id,
                      });
                    } else {
                      quantityMutation.mutate({
                        orderId: activeOrder.id,
                        itemId: item.id,
                        quantity: item.quantity - 1,
                      });
                    }
                  }}
                  onRemoveItem={(item) =>
                    removeItemMutation.mutate({
                      orderId: activeOrder.id,
                      itemId: item.id,
                    })
                  }
                />

                {itemError && (
                  <p className="text-sm text-red-600">{itemError}</p>
                )}

                <AddItemForm
                  menuItems={menuItems}
                  categories={categories}
                  pending={addItemMutation.isPending}
                  onAdd={({ menuItemId, quantity }) =>
                    addItemMutation.mutate({
                      orderId: activeOrder.id,
                      menuItemId,
                      quantity,
                    })
                  }
                />

                <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                  {activeOrder.status !== "SERVED" &&
                    activeOrder.status !== "COMPLETED" && (
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          orderStatusMutation.mutate({
                            id: activeOrder.id,
                            status: "SERVED",
                          })
                        }
                      >
                        Marcar como {ORDER_STATUS_LABEL.SERVED.toLowerCase()}
                      </button>
                    )}
                  <button
                    className="btn-primary"
                    onClick={() =>
                      orderStatusMutation.mutate({
                        id: activeOrder.id,
                        status: "COMPLETED",
                      })
                    }
                  >
                    Concluir e liberar mesa
                  </button>
                  <button
                    className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    onClick={() =>
                      orderStatusMutation.mutate({
                        id: activeOrder.id,
                        status: "CANCELLED",
                      })
                    }
                  >
                    Cancelar pedido
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-stone-500">
                  Esta mesa está livre no momento.
                </p>
                <div className="flex gap-2">
                  {liveSelected.status !== "FREE" && (
                    <button
                      className="btn-secondary"
                      onClick={() => freeMutation.mutate(liveSelected.id)}
                    >
                      Marcar como livre
                    </button>
                  )}
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setNewOrderTableId(liveSelected.id);
                      setSelectedTable(null);
                      setShowNewOrder(true);
                    }}
                  >
                    Receber clientes e iniciar pedido
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function AddItemForm({ menuItems, categories, onAdd, pending }) {
  const [menuItemId, setMenuItemId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const availableItems = menuItems?.filter((i) => i.available) ?? [];
  const itemsByCategory = categories?.map((category) => ({
    category,
    items: availableItems.filter((i) => i.categoryId === category.id),
  }));

  function handleAdd() {
    onAdd({ menuItemId, quantity: Number(quantity) });
    setMenuItemId("");
    setQuantity(1);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-stone-50 p-2">
      <select
        value={menuItemId}
        onChange={(e) => setMenuItemId(e.target.value)}
        className="input flex-1"
      >
        <option value="">Selecione um item…</option>
        {itemsByCategory?.map(
          ({ category, items }) =>
            items.length > 0 && (
              <optgroup key={category.id} label={category.name}>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({money(i.price)})
                  </option>
                ))}
              </optgroup>
            ),
        )}
      </select>
      <input
        type="number"
        min="1"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className="w-16 rounded-md border border-stone-300 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        className="btn-primary whitespace-nowrap"
        disabled={!menuItemId || Number(quantity) < 1 || pending}
        onClick={handleAdd}
      >
        {pending ? "Adicionando…" : "Adicionar"}
      </button>
    </div>
  );
}
