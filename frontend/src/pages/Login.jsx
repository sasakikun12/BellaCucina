import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, HOME_ROUTE_BY_ROLE } from "../context/AuthContext";

const DEMO_ACCOUNTS = [
  { role: "Administrador(a)", email: "admin@restaurant.com" },
  { role: "Garçom/Garçonete", email: "waiter@restaurant.com" },
  { role: "Cozinha", email: "kitchen@restaurant.com" },
  { role: "Entregador(a)", email: "delivery@restaurant.com" },
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(HOME_ROUTE_BY_ROLE[user.role]);
    } catch {
      setError("E-mail ou senha inválidos");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl">🍽️</div>
          <h1 className="mt-2 text-xl font-bold text-stone-800">Bella Cucina</h1>
          <p className="text-sm text-stone-500">Entre no sistema do restaurante</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="voce@restaurant.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="mt-6 rounded-lg bg-stone-50 p-3 text-xs text-stone-500">
          <div className="mb-1 font-semibold text-stone-600">Contas de demonstração (senha: password123)</div>
          <ul className="flex flex-col gap-0.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <li key={acc.email} className="flex justify-between">
                <span>{acc.role}</span>
                <button
                  type="button"
                  className="text-brand-600 hover:underline"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword("password123");
                  }}
                >
                  {acc.email}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
