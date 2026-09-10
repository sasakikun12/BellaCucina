import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render.jsx";
import { resetSocketBus, emitSocket } from "../helpers/mockSocket.js";

vi.mock("../../src/api/orders", () => ({ fetchOrders: vi.fn(), setOrderItemStatus: vi.fn() }));
vi.mock("../../src/context/SocketContext", async () => {
  const actual = await vi.importActual("../helpers/mockSocket.js");
  return { useSocket: actual.useSocketMock };
});

import { fetchOrders, setOrderItemStatus } from "../../src/api/orders";
import { Kitchen } from "../../src/pages/Kitchen";

const item = (over) => ({ id: "i1", menuItem: { name: "Pizza" }, quantity: 2, status: "PENDING", notes: null, ...over });
const order = (over) => ({
  id: "o1",
  type: "DINE_IN",
  status: "PREPARING",
  table: { number: 3 },
  customerName: null,
  notes: null,
  createdAt: "2026-09-10T12:00:00Z",
  items: [item()],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetSocketBus();
  setOrderItemStatus.mockResolvedValue({});
});

describe("Kitchen", () => {
  it("mostra o estado de carregando", () => {
    fetchOrders.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Kitchen />);
    expect(screen.getByText("Carregando fila…")).toBeInTheDocument();
  });

  it("fila vazia mostra a mensagem de tudo em dia", async () => {
    fetchOrders.mockResolvedValue([{ ...order(), status: "COMPLETED" }]);
    renderWithProviders(<Kitchen />);
    expect(await screen.findByText(/Nenhum pedido ativo na cozinha/)).toBeInTheDocument();
  });

  it("ordena a fila do mais antigo para o mais novo e cobre os rótulos", async () => {
    fetchOrders.mockResolvedValue([
      order({ id: "novo", createdAt: "2026-09-10T13:00:00Z", table: null, type: "TAKEAWAY", customerName: "Zé" }),
      order({ id: "antigo", createdAt: "2026-09-10T11:00:00Z" }),
      order({ id: "semnome", createdAt: "2026-09-10T12:00:00Z", table: null, type: "DELIVERY", customerName: null }),
    ]);
    renderWithProviders(<Kitchen />);

    await screen.findByText("Mesa 3");
    const titles = screen.getAllByText(/^(Mesa 3|Para viagem · Zé|Entrega)$/);
    expect(titles[0]).toHaveTextContent("Mesa 3");
    expect(screen.getByText("Para viagem · Zé")).toBeInTheDocument();
    expect(screen.getByText("Entrega")).toBeInTheDocument();
  });

  it("mostra observações do pedido e do item, e avança o status do item", async () => {
    fetchOrders.mockResolvedValue([
      order({ notes: "sem glúten", items: [item({ notes: "bem passada" })] }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<Kitchen />);

    expect(await screen.findByText("📝 sem glúten")).toBeInTheDocument();
    expect(screen.getByText("(bem passada)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Em preparo" }));
    expect(setOrderItemStatus).toHaveBeenCalledWith("o1", "i1", "PREPARING");
  });

  it("item PREPARING mostra botão 'Pronto'; item READY não mostra botão", async () => {
    fetchOrders.mockResolvedValue([
      order({
        items: [item({ id: "a", status: "PREPARING" }), item({ id: "b", status: "READY", menuItem: { name: "Suco" } })],
      }),
    ]);
    renderWithProviders(<Kitchen />);
    expect(await screen.findByRole("button", { name: "Pronto" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Em preparo|Pronto/ })).toHaveLength(1);
  });

  it("evento de socket revalida a fila (refaz o fetch)", async () => {
    fetchOrders.mockResolvedValue([]);
    renderWithProviders(<Kitchen />);
    await screen.findByText(/Nenhum pedido ativo/);
    expect(fetchOrders).toHaveBeenCalledTimes(1);

    emitSocket("order:new");
    emitSocket("order:updated");
    await waitFor(() => expect(fetchOrders.mock.calls.length).toBeGreaterThan(1));
  });
});
