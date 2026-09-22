import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockUseAuth = vi.fn();
vi.mock("../../src/context/AuthContext", async (importActual) => {
  const actual = await importActual();
  return { ...actual, useAuth: () => mockUseAuth() };
});
vi.mock("../../src/components/Layout", async () => {
  const { Outlet } = await vi.importActual("react-router-dom");
  return { Layout: () => <div data-testid="layout"><Outlet /></div> };
});
vi.mock("../../src/components/ProtectedRoute", async () => {
  const { Outlet } = await vi.importActual("react-router-dom");
  return { ProtectedRoute: () => <Outlet /> };
});
vi.mock("../../src/pages/Login", () => ({ Login: () => <div>STUB Login</div> }));
vi.mock("../../src/pages/Dashboard", () => ({ Dashboard: () => <div>STUB Dashboard</div> }));
vi.mock("../../src/pages/Menu", () => ({ Menu: () => <div>STUB Menu</div> }));
vi.mock("../../src/pages/Tables", () => ({ Tables: () => <div>STUB Tables</div> }));
vi.mock("../../src/pages/Orders", () => ({ Orders: () => <div>STUB Orders</div> }));
vi.mock("../../src/pages/Kitchen", () => ({ Kitchen: () => <div>STUB Kitchen</div> }));
vi.mock("../../src/pages/Delivery", () => ({ Delivery: () => <div>STUB Delivery</div> }));
vi.mock("../../src/pages/Staff", () => ({ Staff: () => <div>STUB Staff</div> }));
vi.mock("../../src/pages/Stock", () => ({ Stock: () => <div>STUB Stock</div> }));
vi.mock("../../src/pages/NotFound", () => ({
  NotFound: () => <div>STUB NotFound</div>,
  Unauthorized: () => <div>STUB Unauthorized</div>,
}));

import { App } from "../../src/App";

function renderAt(route) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App — roteamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, loading: false });
  });

  it("/login renderiza a tela de login", () => {
    renderAt("/login");
    expect(screen.getByText("STUB Login")).toBeInTheDocument();
  });

  it("/unauthorized renderiza a tela de acesso negado", () => {
    renderAt("/unauthorized");
    expect(screen.getByText("STUB Unauthorized")).toBeInTheDocument();
  });

  it("rota desconhecida renderiza NotFound", () => {
    renderAt("/rota-que-nao-existe");
    expect(screen.getByText("STUB NotFound")).toBeInTheDocument();
  });

  it("/menu é público", () => {
    renderAt("/menu");
    expect(screen.getByText("STUB Menu")).toBeInTheDocument();
  });

  it("Home: enquanto auth carrega, não redireciona (fica no layout vazio)", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderAt("/");
    expect(screen.getByTestId("layout")).toBeInTheDocument();
    expect(screen.queryByText(/STUB (Dashboard|Menu)/)).not.toBeInTheDocument();
  });

  it("Home: sem usuário redireciona para /menu", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderAt("/");
    expect(screen.getByText("STUB Menu")).toBeInTheDocument();
  });

  it("Home: com usuário redireciona para a home do papel", () => {
    mockUseAuth.mockReturnValue({ user: { role: "ADMIN" }, loading: false });
    renderAt("/");
    expect(screen.getByText("STUB Dashboard")).toBeInTheDocument();
  });

  it("Home: garçom vai para /tables", () => {
    mockUseAuth.mockReturnValue({ user: { role: "WAITER" }, loading: false });
    renderAt("/");
    expect(screen.getByText("STUB Tables")).toBeInTheDocument();
  });
});
