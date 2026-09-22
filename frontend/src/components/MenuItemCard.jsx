import { money, resolvePhotoUrl } from "../lib/status";

export const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='#e7e5e4'/><text x='50%' y='50%' font-size='20' fill='#a8a29e' text-anchor='middle' dominant-baseline='middle'>Sem foto</text></svg>`
  );

export function MenuItemCard({ item, actions, onAddToOrder, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="relative h-40 w-full bg-stone-200">
        <img
          src={resolvePhotoUrl(item.photoUrl) || FALLBACK_IMG}
          alt={item.name}
          className="h-full w-full object-cover"
          onError={(e) => {
            e.target.src = FALLBACK_IMG;
          }}
        />
        {!item.available && (
          <span className="absolute right-2 top-2 rounded-full bg-stone-900/80 px-2 py-0.5 text-xs font-medium text-white">
            Indisponível
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="font-semibold text-stone-800">{item.name}</h3>
          <span className="whitespace-nowrap font-bold text-brand-700">{money(item.price)}</span>
        </div>
        <p className="mb-3 line-clamp-2 flex-1 text-sm text-stone-500">{item.description}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-400">{item.category.name}</span>
          {onAddToOrder && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToOrder();
              }}
              disabled={!item.available}
              className="rounded-md bg-brand-500 px-3 py-1 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              Adicionar
            </button>
          )}
        </div>
        {actions && (
          <div className="mt-3 flex gap-2 border-t border-stone-100 pt-3" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
