import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render.jsx";

vi.mock("../../src/api/menu", () => ({ fetchMenuItems: vi.fn() }));
vi.mock("../../src/api/tables", () => ({ fetchTables: vi.fn() }));
vi.mock("../../src/api/orders", () => ({ createOrder: vi.fn() }));

import { fetchMenuItems } from "../../src/api/menu";
import { fetchTables } from "../../src/api/tables";
import { createOrder } from "../../src/api/orders";
import { NewOrderForm } from "../../src/components/NewOrderForm";

const MENU = [
  { id: "m1", name: "Pizza", price: "30", available: true },
  { id: "m2", name: "Suco", price: "8", available: true },
  { id: "m3", name: "Fora de menu", price: "1", available: false },
];
const TABLES = [
  { id: "t1", number: 1, capacity: 4, status: "FREE" },
  { id: "t2", number: 2, capacity: 2, status: "OCCUPIED" },
];

beforeEach(() => {
  vi.clearAllMocks();
  fetchMenuItems.mockResolvedValue(MENU);
  fetchTables.mockResolvedValue(TABLES);
  createOrder.mockResolvedValue({ id: "o1" });
});

async function open(props = {}) {
  const onClose = vi.fn();
  const utils = renderWithProviders(<NewOrderForm onClose={onClose} {...props} />);
  await screen.findByRole("button", { name: /^Pizza/ });
  return { onClose, ...utils };
}

describe("NewOrderForm", () => {
  it("valida: carrinho vazio", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("button", { name: "Fazer pedido" }));
    expect(screen.getByText("Adicione pelo menos um item ao pedido.")).toBeInTheDocument();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("valida: no salão sem mesa selecionada", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("button", { name: /^Pizza/ }));
    await user.click(screen.getByRole("button", { name: "Fazer pedido" }));
    expect(screen.getByText("Selecione uma mesa para este pedido.")).toBeInTheDocument();
  });

  it("só mesas livres (ou a mesa pré-selecionada) aparecem no select", async () => {
    await open();
    const select = screen.getByRole("combobox");
    expect(within(select).getByRole("option", { name: /Mesa 1/ })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: /Mesa 2/ })).not.toBeInTheDocument();
  });

  it("fluxo no salão completo: adiciona itens, ajusta quantidade e envia", async () => {
    const user = userEvent.setup();
    const { onClose } = await open();

    await user.click(screen.getByRole("button", { name: /^Pizza/ }));
    await user.click(screen.getByRole("button", { name: /^Pizza/ }));
    await user.click(screen.getByRole("button", { name: /^Suco/ }));

    const cart = screen.getByText("Total").closest(".bg-stone-50");
    const sucoLine = within(cart).getByText("Suco").closest("div");
    await user.click(within(sucoLine).getAllByRole("button")[0]);
    expect(within(cart).queryByText("Suco")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox"), "t1");
    await user.type(screen.getByLabelText("Observações (opcional)"), "sem cebola");
    await user.click(screen.getByRole("button", { name: "Fazer pedido" }));

    expect(createOrder.mock.calls[0][0]).toEqual({
      type: "DINE_IN",
      tableId: "t1",
      customerName: undefined,
      customerPhone: undefined,
      deliveryAddress: undefined,
      notes: "sem cebola",
      items: [{ menuItemId: "m1", quantity: 2 }],
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("troca para Entrega: exige endereço e envia os campos de cliente", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(screen.getByRole("button", { name: "Entrega" }));
    await user.click(screen.getByRole("button", { name: /^Pizza/ }));
    await user.click(screen.getByRole("button", { name: "Fazer pedido" }));
    expect(screen.getByText("O endereço de entrega é obrigatório.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nome do cliente"), "João");
    await user.type(screen.getByLabelText("Telefone"), "999");
    await user.type(screen.getByLabelText("Endereço de entrega"), "Rua 1, 100");
    await user.click(screen.getByRole("button", { name: "Fazer pedido" }));

    expect(createOrder.mock.calls[0][0]).toMatchObject({
      type: "DELIVERY",
      tableId: undefined,
      customerName: "João",
      customerPhone: "999",
      deliveryAddress: "Rua 1, 100",
      items: [{ menuItemId: "m1", quantity: 1 }],
    });
  });

  it("Para viagem não exige mesa nem endereço", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("button", { name: "Para viagem" }));
    await user.click(screen.getByRole("button", { name: /^Pizza/ }));
    await user.click(screen.getByRole("button", { name: "Fazer pedido" }));
    expect(createOrder.mock.calls[0][0]).toMatchObject({ type: "TAKEAWAY", tableId: undefined });
  });

  it("mostra a mensagem de erro do backend e mantém o modal aberto", async () => {
    createOrder.mockRejectedValue({ response: { data: { error: "Estoque insuficiente" } } });
    const user = userEvent.setup();
    const { onClose } = await open();
    await user.click(screen.getByRole("button", { name: "Para viagem" }));
    await user.click(screen.getByRole("button", { name: /^Pizza/ }));
    await user.click(screen.getByRole("button", { name: "Fazer pedido" }));
    expect(await screen.findByText("Estoque insuficiente")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("erro sem corpo do backend usa a mensagem padrão", async () => {
    createOrder.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("button", { name: "Para viagem" }));
    await user.click(screen.getByRole("button", { name: /^Pizza/ }));
    await user.click(screen.getByRole("button", { name: "Fazer pedido" }));
    expect(await screen.findByText("Não foi possível criar o pedido")).toBeInTheDocument();
  });

  it("com presetType/presetTableId: sem botões de tipo e mesa pré-selecionada", async () => {
    fetchTables.mockResolvedValue([
      { id: "t2", number: 2, capacity: 2, status: "OCCUPIED" },
    ]);
    const user = userEvent.setup();
    await open({ presetType: "DINE_IN", presetTableId: "t2" });

    expect(screen.queryByRole("button", { name: "Para viagem" })).not.toBeInTheDocument();
    const select = screen.getByRole("combobox");
    expect(within(select).getByRole("option", { name: /Mesa 2/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Pizza/ }));
    await user.click(screen.getByRole("button", { name: "Fazer pedido" }));
    expect(createOrder.mock.calls[0][0]).toMatchObject({ type: "DINE_IN", tableId: "t2" });
  });

  it("botão Cancelar chama onClose", async () => {
    const user = userEvent.setup();
    const { onClose } = await open();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("incrementa e decrementa pelo controle do carrinho mantendo a linha", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("button", { name: /^Suco/ }));
    const cart = screen.getByText("Total").closest(".bg-stone-50");
    const line = within(cart).getByText("Suco").closest("div");
    const [dec, inc] = within(line).getAllByRole("button");
    await user.click(inc);
    expect(within(line).getByText("2")).toBeInTheDocument();
    await user.click(dec);
    expect(within(line).getByText("1")).toBeInTheDocument();
  });
});
