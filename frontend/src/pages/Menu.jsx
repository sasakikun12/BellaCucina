import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCategory,
  deleteCategory,
  deleteMenuItem,
  fetchCategories,
  fetchMenuItems,
} from "../api/menu";
import { FALLBACK_IMG, MenuItemCard } from "../components/MenuItemCard";
import { Modal } from "../components/Modal";
import { MenuItemForm } from "../components/MenuItemForm";
import { useAuth } from "../context/AuthContext";
import { money, resolvePhotoUrl } from "../lib/status";

export function Menu() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ["menu"],
    queryFn: fetchMenuItems,
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [editingItem, setEditingItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (categoryFilter === "ALL") return items;
    return items.filter((i) => i.categoryId === categoryFilter);
  }, [items, categoryFilter]);

  const deleteMutation = useMutation({
    mutationFn: deleteMenuItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu"] }),
    onError: (err) =>
      alert(
        err?.response?.data?.error || "Não foi possível excluir este item.",
      ),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategoryFilter((prev) => (prev === deletedId ? "ALL" : prev));
    },
    onError: (err) =>
      alert(
        err?.response?.data?.error ||
          "Não foi possível excluir esta categoria.",
      ),
  });

  function handleDeleteCategory(category) {
    if (confirm(`Excluir a categoria "${category.name}"?`)) {
      deleteCategoryMutation.mutate(category.id);
    }
  }

  function openCreate() {
    setEditingItem(null);
    setShowForm(true);
  }

  function openEdit(item) {
    setEditingItem(item);
    setShowForm(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Cardápio</h1>
          <p className="text-sm text-stone-500">
            Navegue pelos pratos por categoria.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            + Adicionar item
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={categoryFilter === "ALL"}
          onClick={() => setCategoryFilter("ALL")}
          label="Todos"
        />
        {categories?.map((c) => (
          <div key={c.id} className="group relative">
            <FilterChip
              active={categoryFilter === c.id}
              onClick={() => setCategoryFilter(c.id)}
              label={c.name}
            />
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleDeleteCategory(c)}
                title={`Excluir categoria "${c.name}"`}
                className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] leading-none text-white group-hover:flex"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {isLoading && <p className="text-stone-500">Carregando cardápio…</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredItems.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            onClick={() => setViewingItem(item)}
            actions={
              isAdmin ? (
                <>
                  <button
                    onClick={() => openEdit(item)}
                    className="flex-1 rounded-md border border-stone-300 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Excluir "${item.name}"?`))
                        deleteMutation.mutate(item.id);
                    }}
                    className="flex-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Excluir
                  </button>
                </>
              ) : undefined
            }
          />
        ))}
      </div>

      {showForm && (
        <MenuItemForm
          item={editingItem}
          categories={categories ?? []}
          onClose={() => setShowForm(false)}
          onCreateCategory={async (name) => {
            await createCategory(name);
            queryClient.invalidateQueries({ queryKey: ["categories"] });
          }}
        />
      )}

      {viewingItem && (
        <MenuItemDetailModal
          item={viewingItem}
          onClose={() => setViewingItem(null)}
          onEdit={
            isAdmin
              ? () => {
                  setViewingItem(null);
                  openEdit(viewingItem);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function MenuItemDetailModal({ item, onClose, onEdit }) {
  return (
    <Modal title={item.name} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div className="relative h-64 w-full overflow-hidden rounded-lg bg-stone-200 sm:h-80">
          <img
            src={resolvePhotoUrl(item.photoUrl) || FALLBACK_IMG}
            alt={item.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.target.src = FALLBACK_IMG;
            }}
          />
          {!item.available && (
            <span className="absolute right-3 top-3 rounded-full bg-stone-900/80 px-2.5 py-1 text-xs font-medium text-white">
              Indisponível
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
              {item.category.name}
            </span>
            <h2 className="text-lg font-semibold text-stone-800">
              {item.name}
            </h2>
          </div>
          <span className="whitespace-nowrap text-xl font-bold text-brand-700">
            {money(item.price)}
          </span>
        </div>

        <p className="text-sm leading-relaxed text-stone-600">
          {item.description}
        </p>

        <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
          <button className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
          {onEdit && (
            <button className="btn-primary" onClick={onEdit}>
              Editar item
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
        active
          ? "border-brand-500 bg-brand-500 text-white"
          : "border-stone-300 text-stone-600 hover:bg-stone-50"
      }`}
    >
      {label}
    </button>
  );
}

