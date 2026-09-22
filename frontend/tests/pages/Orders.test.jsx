import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render.jsx";
import { resetSocketBus, emitSocket } from "../helpers/mockSocket.js";

vi.mock("../../src/api/orders", () => ({
  fetchOrders: vi.fn(),
  setOrderStatus: vi.fn(),
}));
vi.mock("../../src/context/SocketContext", async () => {
  const actual = await vi.importActual("../helpers/mockSocket.js");
  return { useSocket: actual.useSocketMock };
});

vi.mock("../../src/components/NewOrderForm", () => ({
  NewOrderForm: ({ onClose }) => (
    <div>
      <span>STUB NewOrderForm</span>
      <button onClick={onClose}>fechar-stub</button>
    </div>
  ),
}));

import { fetchOrders, setOrderStatus } from "../../src/api/orders";
import { Orders } from "../../src/pages/Orders";

const ord = (over) => ({
  id: "o1",
  type: "DINE_IN",
  status: "READY",
  table: { number: 2 },
  items: [
    {
      id: "i1",
      menuItem: { name: "Pizza" },
      quantity: 1,
      unitPrice: "30",
      status: "READY",
    },
  ],
  total: "30",
  createdAt: "2026-09-10T12:00:00Z",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetSocketBus();
  setOrderStatus.mockResolvedValue({});
});

describe("Orders", () => {
  it("carregando e depois vazio", async () => {
    fetchOrders.mockResolvedValueOnce(new Promise(() => {}));
    const { unmount } = renderWithProviders(<Orders />);
    expect(screen.getByText("Carregando pedidos…")).toBeInTheDocument();
    unmount();

    fetchOrders.mockResolvedValue([]);
    renderWithProviders(<Orders />);
    expect(await screen.findByText("Nenhum pedido aqui.")).toBeInTheDocument();
  });

  it("aba Ativos: READY no salão -> 'Marcar como servido'; cancela", async () => {
    fetchOrders.mockResolvedValue([ord({ status: "READY", type: "DINE_IN" })]);
    const user = userEvent.setup();
    renderWithProviders(<Orders />);

    await user.click(
      await screen.findByRole("button", { name: /Marcar como servido/i }),
    );
    expect(setOrderStatus).toHaveBeenCalledWith("o1", "SERVED");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(setOrderStatus).toHaveBeenCalledWith("o1", "CANCELLED");
  });

  it("READY para viagem -> 'Marcar como concluído'", async () => {
    fetchOrders.mockResolvedValue([
      ord({ status: "READY", type: "TAKEAWAY", table: null }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<Orders />);
    await user.click(
      await screen.findByRole("button", { name: /Marcar como concluído/i }),
    );
    expect(setOrderStatus).toHaveBeenCalledWith("o1", "COMPLETED");
  });

  it("READY de entrega não mostra botão de servir/concluir (só cancelar)", async () => {
    fetchOrders.mockResolvedValue([
      ord({ status: "READY", type: "DELIVERY", table: null }),
    ]);
    renderWithProviders(<Orders />);
    await screen.findByText("Cancelar");
    expect(
      screen.queryByRole("button", { name: /Marcar como/i }),
    ).not.toBeInTheDocument();
  });

  it("alterna para a aba Encerrados (sem rodapé de ações)", async () => {
    fetchOrders.mockResolvedValue([
      ord({ id: "ativo", status: "READY" }),
      ord({ id: "fechado", status: "COMPLETED", table: { number: 9 } }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<Orders />);

    await screen.findByText("Mesa 2");
    await user.click(screen.getByRole("button", { name: "Encerrados" }));
    expect(await screen.findByText("Mesa 9")).toBeInTheDocument();
    expect(screen.queryByText("Mesa 2")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancelar" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ativos" }));
    expect(await screen.findByText("Mesa 2")).toBeInTheDocument();
  });

  it("abre e fecha o formulário de novo pedido", async () => {
    fetchOrders.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithProviders(<Orders />);
    await user.click(
      await screen.findByRole("button", { name: "+ Novo pedido" }),
    );
    expect(screen.getByText("STUB NewOrderForm")).toBeInTheDocument();
    await user.click(screen.getByText("fechar-stub"));
    expect(screen.queryByText("STUB NewOrderForm")).not.toBeInTheDocument();
  });

  it("evento de socket revalida", async () => {
    fetchOrders.mockResolvedValue([]);
    renderWithProviders(<Orders />);
    await screen.findByText("Nenhum pedido aqui.");
    emitSocket("order:new");
    emitSocket("order:updated");
    await waitFor(() =>
      expect(fetchOrders.mock.calls.length).toBeGreaterThan(1),
    );
  });
});
