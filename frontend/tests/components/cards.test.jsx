import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Layout } from "../../src/components/Layout";
import { TableCard } from "../../src/components/TableCard";
import { MenuItemCard, FALLBACK_IMG } from "../../src/components/MenuItemCard";
import { OrderCard } from "../../src/components/OrderCard";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../src/context/AuthContext", async (importActual) => {
  const actual = await importActual();
  return { ...actual, useAuth: () => ({ user: null, logout: vi.fn() }) };
});

describe("Layout", () => {
  it("renderiza a Navbar e a área de conteúdo (Outlet)", () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );
    expect(screen.getByText("🍽️ Bella Cucina")).toBeInTheDocument();
    expect(document.querySelector("main")).toBeInTheDocument();
  });
});

describe("TableCard", () => {
  const baseTable = { id: "t1", number: 3, capacity: 4, status: "FREE", orders: [] };

  it("mostra número, capacidade e status; sem pedido não mostra o rodapé", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<TableCard table={baseTable} onClick={onClick} />);

    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("4 lugares")).toBeInTheDocument();
    expect(screen.getByText("Livre")).toBeInTheDocument();
    expect(screen.queryByText(/Pedido em andamento/)).not.toBeInTheDocument();

    await user.click(screen.getByText("#3"));
    expect(onClick).toHaveBeenCalled();
  });

  it("com pedido ativo soma os itens e mostra o total no rodapé", () => {
    const table = {
      ...baseTable,
      status: "OCCUPIED",
      orders: [{ items: [{ unitPrice: "10.00", quantity: 2 }, { unitPrice: "5.5", quantity: 1 }] }],
    };
    render(<TableCard table={table} onClick={vi.fn()} />);
    expect(screen.getByText(/Pedido em andamento/)).toHaveTextContent("R$ 25,50");
  });

  it("lida com table.orders indefinido", () => {
    const { number, capacity, status, id } = baseTable;
    render(<TableCard table={{ id, number, capacity, status }} onClick={vi.fn()} />);
    expect(screen.getByText("#3")).toBeInTheDocument();
  });
});

describe("MenuItemCard", () => {
  const item = {
    id: "m1",
    name: "Pizza",
    description: "Deliciosa",
    price: "30",
    photoUrl: "https://x/pizza.jpg",
    available: true,
    category: { name: "Pratos" },
  };

  it("renderiza nome, preço, categoria e imagem resolvida", () => {
    render(<MenuItemCard item={item} />);
    expect(screen.getByText("Pizza")).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
    expect(screen.getByText("Pratos")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://x/pizza.jpg");
  });

  it("sem foto usa o FALLBACK_IMG; onError troca para o fallback", () => {
    render(<MenuItemCard item={{ ...item, photoUrl: null }} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", FALLBACK_IMG);
    img.dispatchEvent(new Event("error"));
    expect(img.src).toContain("data:image/svg+xml");
  });

  it("mostra a tarja Indisponível quando available é falso e desabilita Adicionar", async () => {
    const onAdd = vi.fn();
    render(<MenuItemCard item={{ ...item, available: false }} onAddToOrder={onAdd} />);
    expect(screen.getByText("Indisponível")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Adicionar" });
    expect(btn).toBeDisabled();
  });

  it("clique no card chama onClick; clique em Adicionar não propaga", async () => {
    const onClick = vi.fn();
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<MenuItemCard item={item} onClick={onClick} onAddToOrder={onAdd} />);

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    await user.click(screen.getByText("Deliciosa"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renderiza o slot de ações e impede a propagação do clique nele", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <MenuItemCard item={item} onClick={onClick} actions={<button>AçãoX</button>} />,
    );
    await user.click(screen.getByText("AçãoX"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("sem onClick não recebe classe cursor-pointer", () => {
    const { container } = render(<MenuItemCard item={item} />);
    expect(container.firstChild.className).not.toContain("cursor-pointer");
  });
});

describe("OrderCard", () => {
  const baseItem = { id: "i1", menuItem: { name: "Pizza" }, quantity: 2, unitPrice: "30", status: "PENDING" };
  const base = {
    id: "o1",
    type: "DINE_IN",
    status: "PENDING",
    table: { number: 5 },
    items: [baseItem],
    total: "60",
    createdAt: "2026-09-10T12:00:00Z",
  };

  it("pedido no salão com mesa: título 'Mesa N', tipo e status", () => {
    render(<OrderCard order={base} />);
    expect(screen.getByText("Mesa 5")).toBeInTheDocument();
    expect(screen.getAllByText("Pendente").length).toBeGreaterThan(0);
    expect(screen.getByText("Total R$ 60,00")).toBeInTheDocument();
  });

  it("pedido no salão sem mesa mostra 'Pedido no salão'", () => {
    render(<OrderCard order={{ ...base, table: null }} />);
    expect(screen.getByText("Pedido no salão")).toBeInTheDocument();
  });

  it("entrega usa customerName ou rótulo padrão; mostra endereço e observações e entregador", () => {
    render(
      <OrderCard
        order={{
          ...base,
          type: "DELIVERY",
          table: null,
          customerName: "João",
          deliveryAddress: "Rua 1",
          notes: "sem pimenta",
          driver: { name: "Léo" },
        }}
      />,
    );
    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.getByText(/Rua 1/)).toBeInTheDocument();
    expect(screen.getByText(/sem pimenta/)).toBeInTheDocument();
    expect(screen.getByText(/Entregador\(a\): Léo/)).toBeInTheDocument();
  });

  it("entrega sem customerName cai no rótulo 'Pedido de entrega'", () => {
    render(<OrderCard order={{ ...base, type: "DELIVERY", table: null, customerName: null }} />);
    expect(screen.getByText("Pedido de entrega")).toBeInTheDocument();
  });

  it("para viagem usa customerName ou 'Pedido para viagem'", () => {
    const { rerender } = render(
      <OrderCard order={{ ...base, type: "TAKEAWAY", table: null, customerName: "Ana" }} />,
    );
    expect(screen.getByText("Ana")).toBeInTheDocument();
    rerender(<OrderCard order={{ ...base, type: "TAKEAWAY", table: null, customerName: null }} />);
    expect(screen.getByText("Pedido para viagem")).toBeInTheDocument();
  });

  it("modo leitura (não editável) lista 'qtd× nome' sem botões de quantidade", () => {
    render(<OrderCard order={base} />);
    expect(screen.getByText("Pizza")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Aumentar quantidade/)).not.toBeInTheDocument();
  });

  it("modo editável expõe +/−/Remover e dispara os callbacks", async () => {
    const onInc = vi.fn();
    const onDec = vi.fn();
    const onRem = vi.fn();
    const user = userEvent.setup();
    render(
      <OrderCard
        order={base}
        editableItems
        onIncreaseItem={onInc}
        onDecreaseItem={onDec}
        onRemoveItem={onRem}
      />,
    );
    await user.click(screen.getByLabelText("Aumentar quantidade de Pizza"));
    await user.click(screen.getByLabelText("Diminuir quantidade de Pizza"));
    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(onInc).toHaveBeenCalledWith(baseItem);
    expect(onDec).toHaveBeenCalledWith(baseItem);
    expect(onRem).toHaveBeenCalledWith(baseItem);
  });

  it("renderiza children e footer quando fornecidos", () => {
    render(
      <OrderCard order={base} footer={<button>RodapéX</button>}>
        <div>filho-x</div>
      </OrderCard>,
    );
    expect(screen.getByText("filho-x")).toBeInTheDocument();
    expect(screen.getByText("RodapéX")).toBeInTheDocument();
  });
});
