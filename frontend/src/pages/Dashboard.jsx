import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchOrders } from "../api/orders";
import { fetchTables } from "../api/tables";
import { fetchMenuItems } from "../api/menu";
import { ingredientsApi, packagingApi } from "../api/stock";
import { useAuth } from "../context/AuthContext";
import { isLowStock } from "../lib/status";

const CARDS = [
  { to: "/menu", icon: "📋", title: "Cardápio", desc: "Gerencie pratos, fotos, preços e categorias" },
  { to: "/tables", icon: "🍽️", title: "Mesas", desc: "Mapa do salão e ocupação das mesas" },
  { to: "/orders", icon: "🧾", title: "Pedidos", desc: "Crie e acompanhe cada pedido" },
  { to: "/kitchen", icon: "👨‍🍳", title: "Cozinha", desc: "Fila de preparo em tempo real" },
  { to: "/delivery", icon: "🚴", title: "Entregas", desc: "Despache e acompanhe as entregas" },
  { to: "/stock", icon: "📦", title: "Estoque", desc: "Ingredientes, embalagens e receitas" },
  { to: "/staff", icon: "👥", title: "Equipe", desc: "Gerencie as contas da equipe" },
];

export function Dashboard() {
  const { user } = useAuth();
  const { data: orders } = useQuery({ queryKey: ["orders"], queryFn: () => fetchOrders() });
  const { data: tables } = useQuery({ queryKey: ["tables"], queryFn: fetchTables });
  const { data: menu } = useQuery({ queryKey: ["menu"], queryFn: fetchMenuItems });
  const { data: ingredients } = useQuery({ queryKey: ["stock-ingredients"], queryFn: ingredientsApi.fetchAll });
  const { data: packaging } = useQuery({ queryKey: ["stock-packaging"], queryFn: packagingApi.fetchAll });

  const activeOrders = orders?.filter((o) => !["COMPLETED", "CANCELLED", "DELIVERED"].includes(o.status)).length ?? 0;
  const occupiedTables = tables?.filter((t) => t.status === "OCCUPIED").length ?? 0;
  const lowStockItems = [...(ingredients ?? []), ...(packaging ?? [])].filter(isLowStock);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Olá de novo, {user?.name.split(" ")[0]}</h1>
        <p className="text-sm text-stone-500">Veja o que está acontecendo no restaurante agora.</p>
      </div>

      {lowStockItems.length > 0 && (
        <Link
          to="/stock"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 hover:bg-red-100"
        >
          <span className="font-semibold">
            ⚠️ {lowStockItems.length} {lowStockItems.length === 1 ? "item está" : "itens estão"} com estoque baixo:
          </span>
          <span>{lowStockItems.map((i) => i.name).join(", ")}</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Pedidos ativos" value={activeOrders} />
        <StatTile label="Mesas ocupadas" value={`${occupiedTables} / ${tables?.length ?? 0}`} />
        <StatTile label="Itens no cardápio" value={menu?.length ?? 0} />
        <StatTile label="Total de mesas" value={tables?.length ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="flex flex-col gap-1 rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="text-2xl">{card.icon}</span>
            <span className="font-semibold text-stone-800">{card.title}</span>
            <span className="text-sm text-stone-500">{card.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-2xl font-bold text-brand-700">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}
