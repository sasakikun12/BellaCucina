import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render.jsx";
import { resetSocketBus, emitSocket } from "../helpers/mockSocket.js";

vi.mock("../../src/api/orders", () => ({
  fetchOrders: vi.fn(),
  assignDriver: vi.fn(),
  setOrderStatus: vi.fn(),
}));
vi.mock("../../src/context/SocketContext", async () => {
  const actual = await vi.importActual("../helpers/mockSocket.js");
  return { useSocket: actual.useSocketMock };
});
const mockUseAuth = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

import { fetchOrders, assignDriver, setOrderStatus } from "../../src/api/orders";
import { Delivery } from "../../src/pages/Delivery";

const ord = (over) => ({
  id: "o1",
  type: "DELIVERY",
  status: "READY",
  customerName: "Cliente",
  items: [{ id: "i1", menuItem: { name: "Pizza" }, quantity: 1, unitPrice: "30", status: "READY" }],
  total: "30",
  createdAt: "2026-09-10T12:00:00Z",
  driverId: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetSocketBus();
  mockUseAuth.mockReturnValue({ user: { id: "d1", role: "DELIVERY" } });
  assignDriver.mockResolvedValue({});
  setOrderStatus.mockResolvedValue({});
});

describe("Delivery", () => {
  it("carregando + três seções vazias", async () => {
    fetchOrders.mockResolvedValueOnce(new Promise(() => {}));
    const { unmount } = renderWithProviders(<Delivery />);
    expect(screen.getByText("Carregando entregas…")).toBeInTheDocument();
    unmount();

    fetchOrders.mockResolvedValue([]);
    renderWithProviders(<Delivery />);
    expect(await screen.findByText("Nenhum pedido de entrega pronto ainda.")).toBeInTheDocument();
    expect(screen.getByText("Nada na rua no momento.")).toBeInTheDocument();
    expect(screen.getByText("Nada na cozinha para entrega.")).toBeInTheDocument();
  });

  it("pronto para retirada: botão 'Assumir e sair' chama assignDriver", async () => {
    fetchOrders.mockResolvedValue([ord({ status: "READY" })]);
    const user = userEvent.setup();
    renderWithProviders(<Delivery />);
    await user.click(await screen.findByRole("button", { name: "Assumir e sair" }));
    expect(assignDriver).toHaveBeenCalledWith("o1");
  });

  it("saiu para entrega: mostra 'Marcar como entregue' para o próprio entregador", async () => {
    fetchOrders.mockResolvedValue([ord({ status: "OUT_FOR_DELIVERY", driverId: "d1" })]);
    const user = userEvent.setup();
    renderWithProviders(<Delivery />);
    await user.click(await screen.findByRole("button", { name: "Marcar como entregue" }));
    expect(setOrderStatus).toHaveBeenCalledWith("o1", "DELIVERED");
  });

  it("saiu para entrega de outro entregador (não-admin): sem botão", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "outro", role: "DELIVERY" } });
    fetchOrders.mockResolvedValue([ord({ status: "OUT_FOR_DELIVERY", driverId: "d1" })]);
    renderWithProviders(<Delivery />);
    await screen.findByText("Cliente");
    expect(screen.queryByRole("button", { name: "Marcar como entregue" })).not.toBeInTheDocument();
  });

  it("admin pode marcar entregue qualquer pedido na rua", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin", role: "ADMIN" } });
    fetchOrders.mockResolvedValue([ord({ status: "OUT_FOR_DELIVERY", driverId: "d1" })]);
    renderWithProviders(<Delivery />);
    expect(await screen.findByRole("button", { name: "Marcar como entregue" })).toBeInTheDocument();
  });

  it("pedidos ainda em preparo aparecem na terceira seção (sem rodapé de ação)", async () => {
    fetchOrders.mockResolvedValue([ord({ id: "k1", status: "PREPARING" })]);
    renderWithProviders(<Delivery />);
    await screen.findByText("Cliente");
    expect(screen.getByText("Ainda em preparo")).toBeInTheDocument();
  });

  it("evento de socket revalida", async () => {
    fetchOrders.mockResolvedValue([]);
    renderWithProviders(<Delivery />);
    await screen.findByText(/Nenhum pedido de entrega pronto/);
    emitSocket("order:new");
    emitSocket("order:updated");
    await waitFor(() => expect(fetchOrders.mock.calls.length).toBeGreaterThan(1));
  });
});
