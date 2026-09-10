import { useState } from "react";

// Editor de uma lista de receita (ingredientes ou embalagem): usado tanto na
// aba Receitas do Estoque quanto no formulário de novo item do Cardápio.
export function RecipeLinesEditor({ title, lines, setLines, available, idField, emptyLabel }) {
  const [selectedId, setSelectedId] = useState("");
  const [qty, setQty] = useState("");

  function addLine() {
    if (!selectedId || !qty || Number(qty) <= 0) return;
    const catalogItem = available.find((c) => c.id === selectedId);
    setLines((prev) => [
      ...prev,
      {
        [idField]: selectedId,
        name: catalogItem.name,
        unit: catalogItem.unit,
        quantityPerUnit: qty,
      },
    ]);
    setSelectedId("");
    setQty("");
  }

  function removeLine(id) {
    setLines((prev) => prev.filter((l) => l[idField] !== id));
  }

  function updateQty(id, value) {
    setLines((prev) => prev.map((l) => (l[idField] === id ? { ...l, quantityPerUnit: value } : l)));
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-stone-800">{title}</h3>

      {lines.length === 0 && <p className="mb-3 text-sm text-stone-500">{emptyLabel}</p>}

      <ul className="mb-3 flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line[idField]} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-stone-700" title={line.name}>
              {line.name}
            </span>
            <input
              type="number"
              min="0"
              step="0.001"
              value={line.quantityPerUnit}
              onChange={(e) => updateQty(line[idField], e.target.value)}
              className="w-20 shrink-0 rounded-md border border-stone-300 px-2 py-1 text-right text-sm"
            />
            <span className="w-8 shrink-0 text-xs text-stone-400">{line.unit}</span>
            <button
              type="button"
              onClick={() => removeLine(line[idField])}
              className="shrink-0 text-xs font-medium text-red-600 hover:underline"
            >
              Remover
            </button>
          </li>
        ))}
      </ul>

      {available.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="input min-w-[10rem] flex-1"
          >
            <option value="">Adicionar item…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.unit})
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.001"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Qtd."
            className="w-20 shrink-0 rounded-md border border-stone-300 px-2 py-1.5 text-sm"
          />
          <button type="button" onClick={addLine} className="btn-secondary shrink-0 whitespace-nowrap">
            + Adicionar
          </button>
        </div>
      )}
    </div>
  );
}
