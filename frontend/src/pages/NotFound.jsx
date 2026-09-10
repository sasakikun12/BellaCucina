import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-center">
      <div className="text-4xl">🍽️</div>
      <h1 className="text-xl font-bold text-stone-800">Página não encontrada</h1>
      <Link to="/" className="text-brand-600 hover:underline">
        Voltar para o início
      </Link>
    </div>
  );
}

export function Unauthorized() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-center">
      <div className="text-4xl">🔒</div>
      <h1 className="text-xl font-bold text-stone-800">Você não tem acesso a esta página</h1>
      <Link to="/" className="text-brand-600 hover:underline">
        Voltar para o início
      </Link>
    </div>
  );
}
