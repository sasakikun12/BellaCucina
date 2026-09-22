import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mockUseAuth = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

import { ProtectedRoute } from "../../src/components/ProtectedRoute";

function renderAt(route, roles) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<ProtectedRoute roles={roles} />}>
          <Route path="/secret" element={<div>conteúdo secreto</div>} />
        </Route>
        <Route path="/login" element={<div>tela de login</div>} />
        <Route path="/unauthorized" element={<div>sem acesso</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enquanto carrega, mostra 'Carregando…'", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderAt("/secret");
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
  });

  it("sem usuário redireciona para /login", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderAt("/secret");
    expect(screen.getByText("tela de login")).toBeInTheDocument();
  });

  it("usuário sem o papel exigido vai para /unauthorized", () => {
    mockUseAuth.mockReturnValue({ user: { role: "WAITER" }, loading: false });
    renderAt("/secret", ["ADMIN"]);
    expect(screen.getByText("sem acesso")).toBeInTheDocument();
  });

  it("usuário autenticado sem restrição de papel vê o conteúdo (Outlet)", () => {
    mockUseAuth.mockReturnValue({ user: { role: "WAITER" }, loading: false });
    renderAt("/secret");
    expect(screen.getByText("conteúdo secreto")).toBeInTheDocument();
  });

  it("usuário com o papel certo vê o conteúdo", () => {
    mockUseAuth.mockReturnValue({ user: { role: "ADMIN" }, loading: false });
    renderAt("/secret", ["ADMIN", "WAITER"]);
    expect(screen.getByText("conteúdo secreto")).toBeInTheDocument();
  });
});
