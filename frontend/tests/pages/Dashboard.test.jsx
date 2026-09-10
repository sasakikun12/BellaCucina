import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render.jsx";

vi.mock("../../src/api/orders", () => ({ fetchOrders: vi.fn() }));
vi.mock("../../src/api/tables", () => ({ fetchTables: vi.fn() }));
vi.mock("../../src/api/menu", () => ({ fetchMenuItems: vi.fn() }));
vi.mock("../../src/api/stock", () => ({
  ingredientsApi: { fetchAll: vi.fn() },
  packagingApi: { fetchAll: vi.fn() },
}));
const mockUseAuth = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

import { fetchOrders } from "../../src/api/orders";
import { fetchTables } from "../../src/api/tables";
import { fetchMenuItems } from "../../src/api/menu";
import { ingredientsApi, packagingApi } from "../../src/api/stock";
import { Dashboard } from "../../src/pages/Dashboard";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { name: "Ana Maria Souza", role: "ADMIN" } });
  fetchOrders.mockResolvedValue([
    { status: "PENDING" },
    { status: "COMPLETED" },
    { status: "PREPARING" },
  ]);
  fetchTables.mockResolvedValue([
    { status: "OCCUPIED" },
    { status: "FREE" },
    { status: "OCCUPIED" },
  ]);
  fetchMenuItems.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
  ingredientsApi.fetchAll.mockResolvedValue([{ name: "Farinha", currentStock: 1, minStock: 5 }]);
  packagingApi.fetchAll.mockResolvedValue([{ name: "Caixa", currentStock: 0, minStock: 2 }]);
});

describe("Dashboard", () => {
  const tileValue = (label) => screen.getByText(label).parentElement.textContent;

  it("saúda pelo primeiro nome e mostra os KPIs calculados", async () => {
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("Olá de novo, Ana")).toBeInTheDocument();
    await screen.findByText("2 / 3");
    expect(tileValue("Pedidos ativos")).toContain("2");
    expect(tileValue("Mesas ocupadas")).toContain("2 / 3");
    expect(tileValue("Itens no cardápio")).toContain("4");
    expect(tileValue("Total de mesas")).toContain("3");
  });

  it("mostra o alerta de estoque baixo no plural com os nomes dos itens", async () => {
    renderWithProviders(<Dashboard />);
    expect(await screen.findByText(/2 itens estão com estoque baixo:/)).toBeInTheDocument();
    expect(screen.getByText("Farinha, Caixa")).toBeInTheDocument();
  });

  it("usa o singular quando só um item está baixo", async () => {
    ingredientsApi.fetchAll.mockResolvedValue([{ name: "Farinha", currentStock: 1, minStock: 5 }]);
    packagingApi.fetchAll.mockResolvedValue([{ name: "Caixa", currentStock: 10, minStock: 2 }]);
    renderWithProviders(<Dashboard />);
    expect(await screen.findByText(/1 item está com estoque baixo:/)).toBeInTheDocument();
  });

  it("sem itens baixos, não renderiza o alerta", async () => {
    ingredientsApi.fetchAll.mockResolvedValue([{ name: "Farinha", currentStock: 10, minStock: 5 }]);
    packagingApi.fetchAll.mockResolvedValue([{ name: "Caixa", currentStock: 10, minStock: 2 }]);
    renderWithProviders(<Dashboard />);
    await screen.findByText("Olá de novo, Ana");
    expect(screen.queryByText(/estoque baixo/)).not.toBeInTheDocument();
  });

  it("lida com dados ainda não carregados (contagens caem para 0)", () => {
    fetchOrders.mockReturnValue(new Promise(() => {}));
    fetchTables.mockReturnValue(new Promise(() => {}));
    fetchMenuItems.mockReturnValue(new Promise(() => {}));
    ingredientsApi.fetchAll.mockReturnValue(new Promise(() => {}));
    packagingApi.fetchAll.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Dashboard />);
    expect(screen.getByText("Pedidos ativos")).toBeInTheDocument();
    expect(screen.getByText("0 / 0")).toBeInTheDocument();
  });

  it("os 7 cartões de atalho aparecem", async () => {
    renderWithProviders(<Dashboard />);
    for (const t of ["Cardápio", "Mesas", "Pedidos", "Cozinha", "Entregas", "Estoque", "Equipe"]) {
      expect(await screen.findByText(t)).toBeInTheDocument();
    }
  });
});
