import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMenuItem,
  saveMenuItemRecipe,
  updateMenuItem,
} from "../api/menu";
import { ingredientsApi, packagingApi } from "../api/stock";
import { Modal } from "./Modal";
import { RecipeLinesEditor } from "./RecipeLinesEditor";

export function MenuItemForm({
  item,
  categories,
  onClose,
  onCreateCategory,
  onSaved,
}) {
  const queryClient = useQueryClient();
  const isNew = !item;
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item?.price ?? "");
  const [categoryId, setCategoryId] = useState(
    item?.categoryId ?? categories[0]?.id ?? "",
  );
  const [available, setAvailable] = useState(item?.available ?? true);
  const [photoUrl, setPhotoUrl] = useState(item?.photoUrl ?? "");
  const [photoFile, setPhotoFile] = useState(null);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState(null);

  const { data: ingredients } = useQuery({
    queryKey: ["stock-ingredients"],
    queryFn: ingredientsApi.fetchAll,
    enabled: isNew,
  });
  const { data: packaging } = useQuery({
    queryKey: ["stock-packaging"],
    queryFn: packagingApi.fetchAll,
    enabled: isNew,
  });
  const [ingredientLines, setIngredientLines] = useState([]);
  const [packagingLines, setPackagingLines] = useState([]);
  const availableIngredients = (ingredients ?? []).filter(
    (i) => !ingredientLines.some((l) => l.ingredientId === i.id),
  );
  const availablePackaging = (packaging ?? []).filter(
    (p) => !packagingLines.some((l) => l.packagingItemId === p.id),
  );

  const saveMutation = useMutation({
    mutationFn: (data) =>
      item ? updateMenuItem(item.id, data) : createMenuItem(data),
    onSuccess: async (savedItem) => {
      if (isNew && (ingredientLines.length > 0 || packagingLines.length > 0)) {
        try {
          await saveMenuItemRecipe(savedItem.id, {
            ingredients: ingredientLines.map((l) => ({
              ingredientId: l.ingredientId,
              quantityPerUnit: Number(l.quantityPerUnit),
            })),
            packaging: packagingLines.map((l) => ({
              packagingItemId: l.packagingItemId,
              quantityPerUnit: Number(l.quantityPerUnit),
            })),
          });
        } catch {
          alert(
            "Item criado, mas não foi possível salvar a receita. Ajuste-a em Estoque → Receitas.",
          );
        }
      }
      queryClient.invalidateQueries({ queryKey: ["menu"] });
      onSaved?.(savedItem);
      onClose();
    },
    onError: () =>
      setError(
        "Não foi possível salvar o item. Verifique os campos e tente novamente.",
      ),
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!categoryId) {
      setError("Escolha ou crie uma categoria primeiro.");
      return;
    }
    saveMutation.mutate({
      name,
      description,
      price: Number(price),
      categoryId,
      available,
      photoFile,
      photoUrl: photoUrl || undefined,
    });
  }

  async function handleAddCategory() {
    if (!newCategory.trim()) return;
    await onCreateCategory(newCategory.trim());
    setNewCategory("");
  }

  return (
    <Modal
      title={item ? "Editar item do cardápio" : "Adicionar item ao cardápio"}
      onClose={onClose}
      wide
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Nome">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Descrição">
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input"
          />
        </Field>
        <Field label="Preço (R$)">
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Categoria">
          <div className="flex gap-2">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input"
              required
            >
              <option value="" disabled>
                Selecione a categoria
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Nome da nova categoria"
              className="input"
            />
            <button
              type="button"
              onClick={handleAddCategory}
              className="btn-secondary whitespace-nowrap"
            >
              + Adicionar
            </button>
          </div>
        </Field>
        <Field label="URL da foto">
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://…"
            className="input"
          />
        </Field>
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <span className="h-px flex-1 bg-stone-200" />
          ou
          <span className="h-px flex-1 bg-stone-200" />
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
        />
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />
          Disponível no cardápio
        </label>

        {isNew && (
          <div className="flex flex-col gap-3 border-t border-stone-200 pt-3">
            <RecipeLinesEditor
              title="Ingredientes"
              lines={ingredientLines}
              setLines={setIngredientLines}
              available={availableIngredients}
              idField="ingredientId"
              emptyLabel="Nenhum ingrediente adicionado."
            />
            <RecipeLinesEditor
              title="Embalagem"
              lines={packagingLines}
              setLines={setPackagingLines}
              available={availablePackaging}
              idField="packagingItemId"
              emptyLabel="Nenhuma embalagem adicionada."
            />
          </div>
        )}

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

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
      {label}
      {children}
    </label>
  );
}
