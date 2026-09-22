import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "../lib/status";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Painel", roles: ["ADMIN"] },
  { to: "/menu", label: "Cardápio", roles: ["ADMIN", "WAITER", "KITCHEN"] },
  { to: "/tables", label: "Mesas", roles: ["ADMIN", "WAITER"] },
  { to: "/orders", label: "Pedidos", roles: ["ADMIN", "WAITER"] },
  { to: "/kitchen", label: "Cozinha", roles: ["ADMIN", "KITCHEN"] },
  { to: "/delivery", label: "Entregas", roles: ["ADMIN", "DELIVERY"] },
  { to: "/stock", label: "Estoque", roles: ["ADMIN"] },
  { to: "/staff", label: "Equipe", roles: ["ADMIN"] },
];

export function Navbar() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-lg font-bold tracking-tight text-brand-700">🍽️ Bella Cucina</span>
          <Link
            to="/login"
            className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Entrar
          </Link>
        </div>
      </header>
    );
  }

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold tracking-tight text-brand-700">🍽️ Bella Cucina</span>
          <nav className="hidden gap-1 sm:flex">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-brand-500 text-white" : "text-stone-600 hover:bg-stone-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm leading-tight">
            <div className="font-medium text-stone-800">{user.name}</div>
            <div className="text-xs text-stone-500">{ROLE_LABEL[user.role]}</div>
          </div>
          <button
            onClick={logout}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Sair
          </button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-stone-100 px-4 py-1.5 sm:hidden">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ${
                isActive ? "bg-brand-500 text-white" : "text-stone-600 hover:bg-stone-100"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
