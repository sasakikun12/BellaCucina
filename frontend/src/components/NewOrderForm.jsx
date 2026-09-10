import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMenuItems } from "../api/menu";
import { fetchTables } from "../api/tables";
import { createOrder } from "../api/orders";
import { money } from "../lib/status";
import { Modal } from "./Modal";

const TYPE_LABEL = {
  DINE_IN: "No salão",
  TAKEAWAY: "Para viagem",
  DELIVERY: "Entrega",
};

export function NewOrderForm({ onClose, presetType, presetTableId }) {
  const queryClient = useQueryClient();
  const { data: menuItems } = useQuery({
    queryKey: ["menu"],
    queryFn: fetchMenuItems,
  });
  const { data: tables } = useQuery({
    queryKey: ["tables"],
    queryFn: fetchTables,
  });

  const [type, setType] = useState(presetType ?? "DINE_IN");
  const [tableId, setTableId] = useState(presetTableId ?? "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState({});
  const [error, setError] = useState(null);

  const freeTables = useMemo(
    () =>
      tables?.filter((t) => t.status === "FREE" || t.id === presetTableId) ??
      [],
    [tables, presetTableId],
  );

  const cartLines = Object.values(cart);
  const total = cartLines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  function addItem(id, name, price) {
    setCart((prev) => {
      const existing = prev[id];
      return {
        ...prev,
        [id]: {
          menuItemId: id,
          name,
          price,
          quantity: (existing?.quantity ?? 0) + 1,
        },
      };
    });
  }

  function changeQty(id, delta) {
    setCart((prev) => {
      const existing = prev[id];
      /* v8 ignore next */
      if (!existing) return prev;
      const quantity = existing.quantity + delta;
      if (quantity <= 0) {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { ...existing, quantity } };
    });
  }

  const createMutation = useMutation({
    mutationFn: (data) => createOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      onClose();
    },
    onError: (err) => {
      const message =
        err?.response?.data?.error || "Não foi possível criar o pedido";
      setError(message);
    },
  });

  function handleSubmit() {
    setError(null);
    if (cartLines.length === 0) {
      setError("Adicione pelo menos um item ao pedido.");
      return;
    }
    if (type === "DINE_IN" && !tableId) {
      setError("Selecione uma mesa para este pedido.");
      return;
    }
    if (type === "DELIVERY" && !deliveryAddress.trim()) {
      setError("O endereço de entrega é obrigatório.");
      return;
    }
    createMutation.mutate({
      type,
      tableId: type === "DINE_IN" ? tableId : undefined,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      deliveryAddress: type === "DELIVERY" ? deliveryAddress : undefined,
      notes: notes || undefined,
      items: cartLines.map((l) => ({
        menuItemId: l.menuItemId,
        quantity: l.quantity,
      })),
    });
  }

  return (
    <Modal title="Novo pedido" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        {!presetType && (
          <div className="flex gap-2">
            {["DINE_IN", "TAKEAWAY", "DELIVERY"].map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  type === t
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-stone-300 text-stone-600"
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        )}

        {type === "DINE_IN" && (
          <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
            Mesa
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="input"
              required
            >
              <option value="" disabled>
                Selecione uma mesa livre
              </option>
              {freeTables.map((t) => (
                <option key={t.id} value={t.id}>
                  Mesa {t.number} ({t.capacity} lugares)
                </option>
              ))}
            </select>
          </label>
        )}

        {(type === "TAKEAWAY" || type === "DELIVERY") && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
              Nome do cliente
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
              Telefone
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="input"
              />
            </label>
          </div>
        )}
        {type === "DELIVERY" && (
          <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
            Endereço de entrega
            <input
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="input"
              required
            />
          </label>
        )}

        <div>
          <div className="mb-2 text-sm font-medium text-stone-600">
            Itens do cardápio
          </div>
          <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-md border border-stone-200 p-2 sm:grid-cols-2">
            {menuItems
              ?.filter((i) => i.available)
              .map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => addItem(i.id, i.name, Number(i.price))}
                  className="flex items-center justify-between gap-2 rounded-md border border-stone-200 px-3 py-2 text-left text-sm hover:bg-stone-50"
                >
                  <span className="text-stone-700">{i.name}</span>
                  <span className="text-xs font-medium text-brand-700">
                    {money(i.price)}
                  </span>
                </button>
              ))}
          </div>
        </div>

        {cartLines.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md bg-stone-50 p-3">
            {cartLines.map((l) => (
              <div
                key={l.menuItemId}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-stone-700">{l.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changeQty(l.menuItemId, -1)}
                    className="h-6 w-6 rounded-full border border-stone-300 text-stone-600"
                  >
                    −
                  </button>
                  <span className="w-4 text-center">{l.quantity}</span>
                  <button
                    type="button"
                    onClick={() => changeQty(l.menuItemId, 1)}
                    className="h-6 w-6 rounded-full border border-stone-300 text-stone-600"
                  >
                    +
                  </button>
                  <span className="w-14 text-right font-medium text-stone-800">
                    {money(l.price * l.quantity)}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex justify-between border-t border-stone-200 pt-2 text-sm font-semibold text-stone-800">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
          Observações (opcional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="btn-primary"
          >
            {createMutation.isPending ? "Enviando pedido…" : "Fazer pedido"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
