import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const mockUseAuth = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import { Navbar } from "../../src/components/Navbar";

function renderNavbar(route = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Navbar />
    </MemoryRouter>,
  );
}

describe("Navbar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sem usuário: mostra apenas o botão Entrar", () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    renderNavbar();
    expect(screen.getByRole("link", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByText("Painel")).not.toBeInTheDocument();
  });

  it("ADMIN vê todos os itens de navegação e pode sair", async () => {
    const logout = vi.fn();
    mockUseAuth.mockReturnValue({ user: { name: "Ana", role: "ADMIN" }, logout });
    const user = userEvent.setup();
    renderNavbar();

    for (const label of ["Painel", "Cardápio", "Mesas", "Pedidos", "Cozinha", "Entregas", "Estoque", "Equipe"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Administrador(a)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(logout).toHaveBeenCalled();
  });

  it("KITCHEN vê só os itens do seu papel", () => {
    mockUseAuth.mockReturnValue({ user: { name: "Kai", role: "KITCHEN" }, logout: vi.fn() });
    renderNavbar("/kitchen");
    expect(screen.getAllByText("Cozinha").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cardápio").length).toBeGreaterThan(0);
    expect(screen.queryByText("Painel")).not.toBeInTheDocument();
    expect(screen.queryByText("Mesas")).not.toBeInTheDocument();
  });

  it("aplica classe ativa ao link da rota atual", () => {
    mockUseAuth.mockReturnValue({ user: { name: "Ana", role: "ADMIN" }, logout: vi.fn() });
    renderNavbar("/tables");
    const activeLinks = screen.getAllByText("Mesas").map((el) => el.closest("a"));
    expect(activeLinks.some((a) => a.className.includes("bg-brand-500"))).toBe(true);
  });
});
