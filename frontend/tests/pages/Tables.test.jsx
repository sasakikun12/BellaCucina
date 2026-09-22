import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render.jsx";
import { resetSocketBus, emitSocket } from "../helpers/mockSocket.js";

vi.mock("../../src/api/tables", () => ({ fetchTables: vi.fn(), setTableStatus: vi.fn() }));
vi.mock("../../src/api/orders", () => ({
  addOrderItem: vi.fn(),
  removeOrderItem: vi.fn(),
  setOrderItemQuantity: vi.fn(),
  setOrderStatus: vi.fn(),
}));
vi.mock("../../src/api/menu", () => ({ fetchCategories: vi.fn(), fetchMenuItems: vi.fn() }));
vi.mock("../../src/context/SocketContext", async () => {
  const actual = await vi.importActual("../helpers/mockSocket.js");
  return { useSocket: actual.useSocketMock };
});
vi.mock("../../src/components/NewOrderForm", () => ({
  NewOrderForm: ({ onClose, presetType, presetTableId }) => (
    <div>
      <span>STUB NewOrderForm type={String(presetType)} table={String(presetTableId)}</span>
      <button onClick={onClose}>stub-close</button>
    </div>
  ),
}));

import { fetchTables, setTableStatus } from "../../src/api/tables";
import { addOrderItem, removeOrderItem, setOrderItemQuantity, setOrderStatus } from "../../src/api/orders";
import { fetchCategories, fetchMenuItems } from "../../src/api/menu";
import { Tables } from "../../src/pages/Tables";

const MENU = [
  { id: "m1", name: "Pizza", price: "30", available: true, categoryId: "c1" },
  { id: "m2", name: "Indisp", price: "1", available: false, categoryId: "c1" },
];
const CATS = [{ id: "c1", name: "Pratos" }, { id: "c2", name: "Vazia" }];

const orderItem = (over) => ({ id: "it1", menuItem: { name: "Pizza" }, quantity: 2, unitPrice: "30", status: "PENDING", ...over });
const tableWithOrder = {
  id: "t1",
  number: 1,
  capacity: 4,
  status: "OCCUPIED",
  orders: [{ id: "o1", status: "PREPARING", type: "DINE_IN", table: { number: 1 }, items: [orderItem()], total: "60", createdAt: "2026-09-10T12:00:00Z" }],
};
const freeTable = { id: "t2", number: 2, capacity: 2, status: "FREE", orders: [] };
const reservedTable = { id: "t3", number: 3, capacity: 2, status: "RESERVED", orders: [] };

beforeEach(() => {
  vi.clearAllMocks();
  resetSocketBus();
  fetchTables.mockResolvedValue([tableWithOrder, freeTable, reservedTable]);
  fetchMenuItems.mockResolvedValue(MENU);
  fetchCategories.mockResolvedValue(CATS);
  for (const m of [addOrderItem, removeOrderItem, setOrderItemQuantity, setOrderStatus, setTableStatus]) m.mockResolvedValue({});
});

async function openTable(name) {
  const user = userEvent.setup();
  renderWithProviders(<Tables />);
  await screen.findByText(`#${name}`);
  await user.click(screen.getByText(`#${name}`));
  return user;
}

describe("Tables", () => {
  it("carregando e grade de mesas", () => {
    fetchTables.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Tables />);
    expect(screen.getByText("Carregando mesas…")).toBeInTheDocument();
  });

  it("mesa livre: marcar como livre (some quando já livre) e iniciar pedido", async () => {
    const user = await openTable("3");
    expect(screen.getByText("Esta mesa está livre no momento.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Marcar como livre" }));
    expect(setTableStatus.mock.calls[0]).toEqual(["t3", "FREE"]);

    await user.click(screen.getByRole("button", { name: "Receber clientes e iniciar pedido" }));
    expect(screen.getByText(/STUB NewOrderForm type=DINE_IN table=t3/)).toBeInTheDocument();
  });

  it("mesa já livre não mostra 'Marcar como livre'", async () => {
    await openTable("2");
    expect(screen.queryByRole("button", { name: "Marcar como livre" })).not.toBeInTheDocument();
  });

  it("mesa com pedido: aumenta, diminui (para remoção e para -1) e remove item", async () => {
    const user = await openTable("1");

    await user.click(screen.getByLabelText("Aumentar quantidade de Pizza"));
    expect(setOrderItemQuantity.mock.calls[0]).toEqual(["o1", "it1", 3]);

    await user.click(screen.getByLabelText("Diminuir quantidade de Pizza"));
    expect(setOrderItemQuantity.mock.calls[1]).toEqual(["o1", "it1", 1]);

    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(removeOrderItem.mock.calls[0]).toEqual(["o1", "it1"]);
  });

  it("diminuir item com quantidade 1 remove o item", async () => {
    fetchTables.mockResolvedValue([
      { ...tableWithOrder, orders: [{ ...tableWithOrder.orders[0], items: [orderItem({ quantity: 1 })] }] },
      freeTable,
    ]);
    const user = await openTable("1");
    await user.click(screen.getByLabelText("Diminuir quantidade de Pizza"));
    expect(removeOrderItem.mock.calls[0]).toEqual(["o1", "it1"]);
  });

  it("AddItemForm: seleciona item, ajusta quantidade e adiciona (reseta depois)", async () => {
    const user = await openTable("1");

    const addForm = screen.getByText("Selecione um item…").closest("div");
    const select = within(addForm).getByRole("combobox");
    await user.selectOptions(select, "m1");
    const qtyInput = within(addForm).getByRole("spinbutton");
    await user.clear(qtyInput);
    await user.type(qtyInput, "3");
    await user.click(within(addForm).getByRole("button", { name: "Adicionar" }));

    expect(addOrderItem.mock.calls[0][0]).toBe("o1");
    expect(addOrderItem.mock.calls[0][1]).toEqual({ menuItemId: "m1", quantity: 3 });
    expect(select).toHaveValue("");
  });

  it("AddItemForm: botão desabilitado sem item selecionado", async () => {
    await openTable("1");
    const addForm = screen.getByText("Selecione um item…").closest("div");
    expect(within(addForm).getByRole("button", { name: "Adicionar" })).toBeDisabled();
  });

  it("erro ao mutar item mostra a mensagem; sucesso limpa", async () => {
    addOrderItem.mockRejectedValueOnce({ response: { data: { error: "Sem estoque" } } });
    const user = await openTable("1");
    const addForm = screen.getByText("Selecione um item…").closest("div");
    await user.selectOptions(within(addForm).getByRole("combobox"), "m1");
    await user.click(within(addForm).getByRole("button", { name: "Adicionar" }));
    expect(await screen.findByText("Sem estoque")).toBeInTheDocument();

    await user.selectOptions(within(addForm).getByRole("combobox"), "m1");
    await user.click(within(addForm).getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(screen.queryByText("Sem estoque")).not.toBeInTheDocument());
  });

  it("erro sem corpo do backend usa mensagem padrão", async () => {
    setOrderItemQuantity.mockRejectedValueOnce(new Error("x"));
    const user = await openTable("1");
    await user.click(screen.getByLabelText("Aumentar quantidade de Pizza"));
    expect(await screen.findByText("Não foi possível atualizar o pedido.")).toBeInTheDocument();
  });

  it("ações de status do pedido: servir, concluir e cancelar", async () => {
    setOrderStatus.mockReturnValue(new Promise(() => {}));
    const user = await openTable("1");
    await user.click(screen.getByRole("button", { name: /Marcar como servido/i }));
    expect(setOrderStatus.mock.calls[0]).toEqual(["o1", "SERVED"]);

    await user.click(screen.getByRole("button", { name: "Concluir e liberar mesa" }));
    expect(setOrderStatus.mock.calls[1]).toEqual(["o1", "COMPLETED"]);

    await user.click(screen.getByRole("button", { name: "Cancelar pedido" }));
    expect(setOrderStatus.mock.calls[2]).toEqual(["o1", "CANCELLED"]);
  });

  it("onSuccess de status fecha o modal", async () => {
    const user = await openTable("1");
    await user.click(screen.getByRole("button", { name: "Cancelar pedido" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancelar pedido" })).not.toBeInTheDocument());
  });

  it("pedido já servido não mostra o botão 'Marcar como servido'", async () => {
    fetchTables.mockResolvedValue([
      { ...tableWithOrder, orders: [{ ...tableWithOrder.orders[0], status: "SERVED" }] },
      freeTable,
    ]);
    await openTable("1");
    expect(screen.queryByRole("button", { name: /Marcar como servido/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir e liberar mesa" })).toBeInTheDocument();
  });

  it("fecha o modal pelo X do Modal", async () => {
    const user = await openTable("2");
    await user.click(screen.getByRole("button", { name: "✕" }));
    expect(screen.queryByText("Esta mesa está livre no momento.")).not.toBeInTheDocument();
  });

  it("botão do topo '+ Novo pedido' abre o formulário sem mesa", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Tables />);
    await screen.findByText("#1");
    await user.click(screen.getByRole("button", { name: "+ Novo pedido" }));
    expect(screen.getByText(/STUB NewOrderForm type=undefined table=undefined/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "stub-close" }));
    expect(screen.queryByText(/STUB NewOrderForm/)).not.toBeInTheDocument();
  });

  it("mantém a mesa selecionada mesmo se ela sumir da lista após um refetch", async () => {
    await openTable("2");
    expect(screen.getByText("Esta mesa está livre no momento.")).toBeInTheDocument();

    fetchTables.mockResolvedValue([tableWithOrder, reservedTable]);
    emitSocket("table:updated");

    await waitFor(() => expect(screen.queryByText("#2")).not.toBeInTheDocument());
    expect(screen.getByText("Mesa 2")).toBeInTheDocument();
    expect(screen.getByText("Esta mesa está livre no momento.")).toBeInTheDocument();
  });

  it("AddItemForm lida com o cardápio ainda não carregado", async () => {
    fetchMenuItems.mockReturnValue(new Promise(() => {}));
    await openTable("1");
    const addForm = screen.getByText("Selecione um item…").closest("div");
    expect(within(addForm).getByRole("button", { name: "Adicionar" })).toBeDisabled();
  });

  it("AddItemForm mostra 'Adicionando…' enquanto a mutação está pendente", async () => {
    addOrderItem.mockReturnValue(new Promise(() => {}));
    const user = await openTable("1");
    const addForm = screen.getByText("Selecione um item…").closest("div");
    await user.selectOptions(within(addForm).getByRole("combobox"), "m1");
    await user.click(within(addForm).getByRole("button", { name: "Adicionar" }));
    expect(await screen.findByText("Adicionando…")).toBeInTheDocument();
  });

  it("eventos de socket revalidam", async () => {
    renderWithProviders(<Tables />);
    await screen.findByText("#1");
    emitSocket("table:updated");
    emitSocket("order:updated");
    emitSocket("order:new");
    await waitFor(() => expect(fetchTables.mock.calls.length).toBeGreaterThan(1));
  });
});
