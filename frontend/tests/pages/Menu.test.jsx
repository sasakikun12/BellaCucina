import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render.jsx";

vi.mock("../../src/api/menu", () => ({
  fetchMenuItems: vi.fn(),
  fetchCategories: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  deleteMenuItem: vi.fn(),
}));
const mockUseAuth = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("../../src/components/MenuItemForm", () => ({
  MenuItemForm: ({ item, onClose, onCreateCategory }) => (
    <div>
      <span>STUB MenuItemForm {item ? `editando ${item.name}` : "novo"}</span>
      <button onClick={() => onCreateCategory("Nova Cat")}>stub-create-cat</button>
      <button onClick={onClose}>stub-close</button>
    </div>
  ),
}));

import {
  fetchMenuItems,
  fetchCategories,
  createCategory,
  deleteCategory,
  deleteMenuItem,
} from "../../src/api/menu";
import { Menu } from "../../src/pages/Menu";

const CATS = [
  { id: "c1", name: "Pratos" },
  { id: "c2", name: "Bebidas" },
];
const ITEMS = [
  { id: "m1", name: "Pizza", description: "d1", price: "30", photoUrl: "https://x/p.jpg", available: true, categoryId: "c1", category: { name: "Pratos" } },
  { id: "m2", name: "Água", description: "d2", price: "5", photoUrl: null, available: false, categoryId: "c2", category: { name: "Bebidas" } },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { role: "ADMIN" } });
  fetchMenuItems.mockResolvedValue(ITEMS);
  fetchCategories.mockResolvedValue(CATS);
  createCategory.mockResolvedValue({ id: "c3" });
  deleteCategory.mockResolvedValue();
  deleteMenuItem.mockResolvedValue();
});

describe("Menu", () => {
  it("mostra carregando e depois os itens; filtra por categoria", async () => {
    fetchMenuItems.mockResolvedValueOnce(new Promise(() => {}));
    const { unmount } = renderWithProviders(<Menu />);
    expect(screen.getByText("Carregando cardápio…")).toBeInTheDocument();
    unmount();

    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    expect(await screen.findByText("Pizza")).toBeInTheDocument();
    expect(screen.getByText("Água")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bebidas" }));
    expect(screen.queryByText("Pizza")).not.toBeInTheDocument();
    expect(screen.getByText("Água")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Todos" }));
    expect(screen.getByText("Pizza")).toBeInTheDocument();
  });

  it("não-admin não vê botões de gestão", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "WAITER" } });
    renderWithProviders(<Menu />);
    await screen.findByText("Pizza");
    expect(screen.queryByRole("button", { name: "+ Adicionar item" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("admin cria item pelo formulário (stub) e o fecha", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    await screen.findByText("Pizza");

    await user.click(screen.getByRole("button", { name: "+ Adicionar item" }));
    expect(screen.getByText("STUB MenuItemForm novo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "stub-create-cat" }));
    expect(createCategory).toHaveBeenCalledWith("Nova Cat");

    await user.click(screen.getByRole("button", { name: "stub-close" }));
    expect(screen.queryByText(/STUB MenuItemForm/)).not.toBeInTheDocument();
  });

  it("admin edita um item pelas ações do card", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    await screen.findByText("Pizza");
    const pizzaCard = screen.getByText("Pizza").closest("div.flex.flex-col");
    await user.click(within(pizzaCard).getByRole("button", { name: "Editar" }));
    expect(screen.getByText("STUB MenuItemForm editando Pizza")).toBeInTheDocument();
  });

  it("admin exclui item (com confirm) — e mostra alerta em erro", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    deleteMenuItem.mockRejectedValueOnce({ response: { data: { error: "em uso" } } });
    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    await screen.findByText("Pizza");

    const pizzaCard = screen.getByText("Pizza").closest("div.flex.flex-col");
    await user.click(within(pizzaCard).getByRole("button", { name: "Excluir" }));
    expect(deleteMenuItem.mock.calls[0][0]).toBe("m1");
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("em uso"));

    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it("exclusão de item bem-sucedida (onSuccess) e erro sem corpo usa texto padrão", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    await screen.findByText("Pizza");

    const pizzaCard = screen.getByText("Pizza").closest("div.flex.flex-col");
    await user.click(within(pizzaCard).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(deleteMenuItem).toHaveBeenCalledTimes(1));
    expect(alertSpy).not.toHaveBeenCalled();

    deleteMenuItem.mockRejectedValueOnce(new Error("boom"));
    const aguaCard = screen.getByText("Água").closest("div.flex.flex-col");
    await user.click(within(aguaCard).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Não foi possível excluir este item."));

    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it("formulário recebe [] quando as categorias ainda não carregaram", async () => {
    fetchCategories.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    await screen.findByText("Pizza");
    await user.click(screen.getByRole("button", { name: "+ Adicionar item" }));
    expect(screen.getByText("STUB MenuItemForm novo")).toBeInTheDocument();
  });

  it("cancelar o confirm de exclusão de item não chama a API", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    await screen.findByText("Pizza");
    const pizzaCard = screen.getByText("Pizza").closest("div.flex.flex-col");
    await user.click(within(pizzaCard).getByRole("button", { name: "Excluir" }));
    expect(deleteMenuItem).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("exclui a categoria filtrada: sucesso volta o filtro para Todos", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    await screen.findByText("Pizza");

    await user.click(screen.getByRole("button", { name: "Bebidas" }));
    await user.click(screen.getByTitle('Excluir categoria "Bebidas"'));
    expect(deleteCategory.mock.calls[0][0]).toBe("c2");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Todos" }).className).toContain("bg-brand-500"),
    );
    confirmSpy.mockRestore();
  });

  it("exclui outra categoria: filtro atual é preservado", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    await screen.findByText("Pizza");

    await user.click(screen.getByRole("button", { name: "Bebidas" }));
    await user.click(screen.getByTitle('Excluir categoria "Pratos"'));
    expect(deleteCategory.mock.calls[0][0]).toBe("c1");
    await waitFor(() => expect(createCategory).toHaveBeenCalledTimes(0));
    expect(screen.getByRole("button", { name: "Bebidas" }).className).toContain("bg-brand-500");
    confirmSpy.mockRestore();
  });

  it("exclui categoria: erro dispara alert com mensagem padrão", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    deleteCategory.mockRejectedValue(new Error("x"));
    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    await screen.findByText("Pizza");
    await user.click(screen.getByTitle('Excluir categoria "Pratos"'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Não foi possível excluir esta categoria."));
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it("cancelar confirm de categoria não chama a API", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    await screen.findByText("Pizza");
    await user.click(screen.getByTitle('Excluir categoria "Pratos"'));
    expect(deleteCategory).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("abre o modal de detalhe do item; imagem cai no fallback ao errar; edita a partir dele", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    await screen.findByText("Água");

    await user.click(screen.getByText("Água"));
    const dialog = screen.getByRole("button", { name: "Fechar" }).closest(".shadow-xl");
    const img = within(dialog).getByRole("img");
    img.dispatchEvent(new Event("error"));
    expect(img.src).toContain("data:image/svg+xml");
    expect(within(dialog).getByText("Indisponível")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Editar item" }));
    expect(screen.getByText("STUB MenuItemForm editando Água")).toBeInTheDocument();
  });

  it("detalhe do item para não-admin não tem botão de editar; fecha no Fechar", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "WAITER" } });
    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    await screen.findByText("Pizza");
    await user.click(screen.getByText("Pizza"));
    expect(screen.queryByRole("button", { name: "Editar item" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("button", { name: "Fechar" })).not.toBeInTheDocument();
  });
});
