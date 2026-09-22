import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ingredientsApi,
  packagingApi,
  fetchStockMovements,
} from "../api/stock";
import {
  createCategory,
  fetchCategories,
  fetchMenuItems,
  fetchMenuItemRecipe,
  saveMenuItemRecipe,
} from "../api/menu";
import { Modal } from "../components/Modal";
import { MenuItemForm } from "../components/MenuItemForm";
import { RecipeLinesEditor } from "../components/RecipeLinesEditor";
import { RowActionsMenu } from "../components/RowActionsMenu";
import {
  quantity,
  isLowStock,
  STOCK_MOVEMENT_REASON_LABEL,
} from "../lib/status";

const TABS = [
  { key: "INGREDIENTS", label: "Ingredientes" },
  { key: "PACKAGING", label: "Embalagens" },
  { key: "RECIPES", label: "Receitas" },
  { key: "MOVEMENTS", label: "Movimentações" },
];

export function Stock() {
  const [tab, setTab] = useState("INGREDIENTS");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Estoque</h1>
        <p className="text-sm text-stone-500">
          Ingredientes consumidos no preparo e embalagens usadas nas entregas,
          com base na receita de cada item do cardápio.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              tab === t.key
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-stone-300 text-stone-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "INGREDIENTS" && (
        <CatalogTab
          api={ingredientsApi}
          queryKey="stock-ingredients"
          singular="ingrediente"
          addLabel="+ Novo ingrediente"
        />
      )}
      {tab === "PACKAGING" && (
        <CatalogTab
          api={packagingApi}
          queryKey="stock-packaging"
          singular="embalagem"
          addLabel="+ Nova embalagem"
        />
      )}
      {tab === "RECIPES" && <RecipesTab />}
      {tab === "MOVEMENTS" && <MovementsTab />}
    </div>
  );
}

function CatalogTab({ api, queryKey, singular, addLabel }) {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: api.fetchAll,
  });

  const [editingItem, setEditingItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: api.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    onError: (err) =>
      alert(
        err?.response?.data?.error ||
          `Não foi possível excluir este ${singular}.`,
      ),
  });

  const lowStockCount = items?.filter(isLowStock).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-500">
          {lowStockCount > 0 ? (
            <span className="font-medium text-red-600">
              {lowStockCount}{" "}
              {lowStockCount === 1 ? "item está" : "itens estão"} em ou abaixo
              do estoque mínimo
            </span>
          ) : (
            "Todos os itens estão com estoque saudável."
          )}
        </p>
        <button
          className="btn-primary"
          onClick={() => {
            setEditingItem(null);
            setShowForm(true);
          }}
        >
          {addLabel}
        </button>
      </div>

      {isLoading && <p className="text-stone-500">Carregando…</p>}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Estoque atual</th>
                <th className="px-4 py-3">Estoque mínimo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items?.map((item) => (
                <tr
                  key={item.id}
                  className={isLowStock(item) ? "bg-red-50" : undefined}
                >
                  <td className="px-4 py-3 font-medium text-stone-800">
                    {item.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        isLowStock(item)
                          ? "font-semibold text-red-700"
                          : "text-stone-700"
                      }
                    >
                      {quantity(item.currentStock, item.unit)}
                    </span>
                    {isLowStock(item) && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Estoque baixo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {quantity(item.minStock, item.unit)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActionsMenu
                      actions={[
                        {
                          label: "Ajustar estoque",
                          onClick: () => setAdjustingItem(item),
                        },
                        {
                          label: "Editar",
                          onClick: () => {
                            setEditingItem(item);
                            setShowForm(true);
                          },
                        },
                        {
                          label: "Excluir",
                          danger: true,
                          onClick: () => {
                            if (confirm(`Excluir "${item.name}"?`))
                              deleteMutation.mutate(item.id);
                          },
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {items?.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-stone-500"
                  >
                    Nenhum item cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <CatalogItemForm
          api={api}
          queryKey={queryKey}
          item={editingItem}
          singular={singular}
          onClose={() => setShowForm(false)}
        />
      )}
      {adjustingItem && (
        <AdjustStockModal
          api={api}
          queryKey={queryKey}
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
        />
      )}
    </div>
  );
}

function CatalogItemForm({ api, queryKey, item, singular, onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [currentStock, setCurrentStock] = useState(item?.currentStock ?? 0);
  const [minStock, setMinStock] = useState(item?.minStock ?? 0);
  const [error, setError] = useState(null);

  const saveMutation = useMutation({
    mutationFn: (data) => (item ? api.update(item.id, data) : api.create(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      onClose();
    },
    onError: (err) =>
      setError(
        err?.response?.data?.error ||
          `Não foi possível salvar este ${singular}.`,
      ),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    saveMutation.mutate(
      item
        ? { name, unit, minStock: Number(minStock) }
        : {
            name,
            unit,
            currentStock: Number(currentStock),
            minStock: Number(minStock),
          },
    );
  }

  return (
    <Modal
      title={item ? `Editar ${singular}` : `Novo ${singular}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
          Nome
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
          Unidade (ex.: kg, g, ml, L, un)
          <input
            required
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="input"
          />
        </label>
        {!item && (
          <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
            Estoque inicial
            <input
              type="number"
              min="0"
              step="0.001"
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value)}
              className="input"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
          Estoque mínimo (dispara o alerta de estoque baixo)
          <input
            type="number"
            min="0"
            step="0.001"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            className="input"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="btn-primary"
          >
            {saveMutation.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AdjustStockModal({ api, queryKey, item, onClose }) {
  const queryClient = useQueryClient();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("RESTOCK");
  const [error, setError] = useState(null);

  const adjustMutation = useMutation({
    mutationFn: () =>
      api.adjust(
        item.id,
        reason === "RESTOCK" ? Number(delta) : -Number(delta),
        reason,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      onClose();
    },
    onError: (err) =>
      setError(
        err?.response?.data?.error || "Não foi possível ajustar o estoque.",
      ),
  });

  return (
    <Modal title={`Ajustar estoque — ${item.name}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          adjustMutation.mutate();
        }}
        className="flex flex-col gap-3"
      >
        <p className="text-sm text-stone-500">
          Estoque atual:{" "}
          <span className="font-medium text-stone-700">
            {quantity(item.currentStock, item.unit)}
          </span>
        </p>
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
          Quantidade
          <input
            required
            type="number"
            min="0.001"
            step="0.001"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder={`ex.: 10 (${item.unit})`}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
          Motivo
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input"
          >
            <option value="RESTOCK">Reposição</option>
            <option value="ADJUSTMENT">Perda</option>
          </select>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={adjustMutation.isPending}
            className="btn-primary"
          >
            {adjustMutation.isPending ? "Salvando…" : "Confirmar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RecipesTab() {
  const { data: menuItems } = useQuery({
    queryKey: ["menu"],
    queryFn: fetchMenuItems,
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const { data: ingredients } = useQuery({
    queryKey: ["stock-ingredients"],
    queryFn: ingredientsApi.fetchAll,
  });
  const { data: packaging } = useQuery({
    queryKey: ["stock-packaging"],
    queryFn: packagingApi.fetchAll,
  });
  const [menuItemId, setMenuItemId] = useState("");
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: recipe, isLoading } = useQuery({
    queryKey: ["menu-recipe", menuItemId],
    queryFn: () => fetchMenuItemRecipe(menuItemId),
    enabled: Boolean(menuItemId),
  });

  const [ingredientLines, setIngredientLines] = useState([]);
  const [packagingLines, setPackagingLines] = useState([]);
  const [savedRecipeKey, setSavedRecipeKey] = useState(null);

  if (recipe && savedRecipeKey !== menuItemId) {
    setIngredientLines(recipe.ingredients.map((l) => ({ ...l })));
    setPackagingLines(recipe.packaging.map((l) => ({ ...l })));
    setSavedRecipeKey(menuItemId);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      saveMenuItemRecipe(menuItemId, {
        ingredients: ingredientLines.map((l) => ({
          ingredientId: l.ingredientId,
          quantityPerUnit: Number(l.quantityPerUnit),
        })),
        packaging: packagingLines.map((l) => ({
          packagingItemId: l.packagingItemId,
          quantityPerUnit: Number(l.quantityPerUnit),
        })),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["menu-recipe", menuItemId] }),
  });

  const availableIngredients = (ingredients ?? []).filter(
    (i) => !ingredientLines.some((l) => l.ingredientId === i.id),
  );
  const availablePackaging = (packaging ?? []).filter(
    (p) => !packagingLines.some((l) => l.packagingItemId === p.id),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-600 sm:max-w-sm sm:flex-1">
          Item do cardápio
          <select
            value={menuItemId}
            onChange={(e) => {
              setMenuItemId(e.target.value);
              setSavedRecipeKey(null);
            }}
            className="input"
          >
            <option value="">Selecione um item</option>
            {menuItems?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn-primary whitespace-nowrap"
          onClick={() => setShowNewItemForm(true)}
        >
          + Novo item do cardápio
        </button>
      </div>

      {!menuItemId && (
        <p className="text-sm text-stone-500">
          Escolha um item para ver e editar sua receita.
        </p>
      )}
      {menuItemId && isLoading && (
        <p className="text-sm text-stone-500">Carregando receita…</p>
      )}

      {menuItemId && recipe && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <RecipeLinesEditor
            title="Ingredientes"
            lines={ingredientLines}
            setLines={setIngredientLines}
            catalog={ingredients ?? []}
            available={availableIngredients}
            idField="ingredientId"
            emptyLabel="Nenhum ingrediente na receita."
          />
          <RecipeLinesEditor
            title="Embalagem"
            lines={packagingLines}
            setLines={setPackagingLines}
            catalog={packaging ?? []}
            available={availablePackaging}
            idField="packagingItemId"
            emptyLabel="Nenhuma embalagem na receita."
          />
        </div>
      )}

      {menuItemId && recipe && (
        <div className="flex items-center gap-3">
          <button
            className="btn-primary"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Salvando…" : "Salvar receita"}
          </button>
          {saveMutation.isSuccess && (
            <span className="text-sm text-emerald-600">Receita salva.</span>
          )}
          {saveMutation.isError && (
            <span className="text-sm text-red-600">
              Não foi possível salvar a receita.
            </span>
          )}
        </div>
      )}

      {showNewItemForm && (
        <MenuItemForm
          item={null}
          categories={categories ?? []}
          onClose={() => setShowNewItemForm(false)}
          onCreateCategory={async (name) => {
            await createCategory(name);
            queryClient.invalidateQueries({ queryKey: ["categories"] });
          }}
          onSaved={(savedItem) => {
            setMenuItemId(savedItem.id);
            setSavedRecipeKey(null);
          }}
        />
      )}
    </div>
  );
}

function MovementsTab() {
  const { data: movements, isLoading } = useQuery({
    queryKey: ["stock-movements"],
    queryFn: fetchStockMovements,
  });

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      {isLoading && <p className="p-4 text-sm text-stone-500">Carregando…</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Quantidade</th>
              <th className="px-4 py-3">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {movements?.map((m) => {
              const catalogItem = m.ingredient ?? m.packagingItem;
              const positive = Number(m.delta) > 0;
              return (
                <tr key={m.id}>
                  <td className="px-4 py-3 text-stone-500">
                    {new Date(m.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-stone-800">
                    {catalogItem?.name ?? "(item removido)"}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${positive ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {positive ? "+" : ""}
                    {quantity(m.delta, catalogItem?.unit ?? "")}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {STOCK_MOVEMENT_REASON_LABEL[m.reason] ?? m.reason}
                  </td>
                </tr>
              );
            })}
            {movements?.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-stone-500"
                >
                  Nenhuma movimentação registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
