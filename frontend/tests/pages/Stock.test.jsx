import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render.jsx";

const { mockIng, mockPkg } = vi.hoisted(() => ({
  mockIng: {
    fetchAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    adjust: vi.fn(),
  },
  mockPkg: {
    fetchAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    adjust: vi.fn(),
  },
}));
vi.mock("../../src/api/stock", () => ({
  ingredientsApi: mockIng,
  packagingApi: mockPkg,
  fetchStockMovements: vi.fn(),
}));
vi.mock("../../src/api/menu", () => ({
  createCategory: vi.fn(),
  fetchCategories: vi.fn(),
  fetchMenuItems: vi.fn(),
  fetchMenuItemRecipe: vi.fn(),
  saveMenuItemRecipe: vi.fn(),
}));
vi.mock("../../src/components/MenuItemForm", () => ({
  MenuItemForm: ({ onClose, onSaved, onCreateCategory }) => (
    <div>
      <span>STUB MenuItemForm</span>
      <button onClick={() => onCreateCategory("C")}>stub-cat</button>
      <button onClick={() => onSaved({ id: "novo-item" })}>stub-saved</button>
      <button onClick={onClose}>stub-close</button>
    </div>
  ),
}));

import { fetchStockMovements } from "../../src/api/stock";
import {
  fetchCategories,
  fetchMenuItems,
  fetchMenuItemRecipe,
  saveMenuItemRecipe,
  createCategory,
} from "../../src/api/menu";
import { Stock } from "../../src/pages/Stock";

const ingredients = [
  { id: "i1", name: "Farinha", unit: "kg", currentStock: "10", minStock: "2" },
  { id: "i2", name: "Sal", unit: "kg", currentStock: "1", minStock: "2" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockIng.fetchAll.mockResolvedValue(ingredients);
  mockPkg.fetchAll.mockResolvedValue([
    { id: "p1", name: "Caixa", unit: "un", currentStock: "50", minStock: "10" },
  ]);
  for (const fn of [
    mockIng.create,
    mockIng.update,
    mockIng.remove,
    mockIng.adjust,
    mockPkg.create,
    mockPkg.update,
    mockPkg.remove,
    mockPkg.adjust,
  ])
    fn.mockResolvedValue({});
  fetchStockMovements.mockResolvedValue([]);
  fetchCategories.mockResolvedValue([{ id: "c1", name: "Pratos" }]);
  fetchMenuItems.mockResolvedValue([{ id: "m1", name: "Pizza" }]);
  fetchMenuItemRecipe.mockResolvedValue({
    ingredients: [
      { ingredientId: "i1", name: "Farinha", unit: "kg", quantityPerUnit: "2" },
    ],
    packaging: [],
  });
  saveMenuItemRecipe.mockResolvedValue();
  createCategory.mockResolvedValue({});
});

describe("Stock — CatalogTab (ingredientes)", () => {
  it("lista itens, destaca estoque baixo e conta o alerta no plural/singular", async () => {
    renderWithProviders(<Stock />);
    expect(await screen.findByText("Farinha")).toBeInTheDocument();
    expect(screen.getByText("Sal")).toBeInTheDocument();
    expect(screen.getAllByText("Estoque baixo").length).toBe(1);
    expect(screen.getByText(/1 item está/)).toBeInTheDocument();
  });

  it("mensagem de estoque saudável quando nada está baixo", async () => {
    mockIng.fetchAll.mockResolvedValue([
      {
        id: "i1",
        name: "Farinha",
        unit: "kg",
        currentStock: "10",
        minStock: "2",
      },
    ]);
    renderWithProviders(<Stock />);
    expect(
      await screen.findByText("Todos os itens estão com estoque saudável."),
    ).toBeInTheDocument();
  });

  it("carregando e tabela vazia", async () => {
    mockIng.fetchAll.mockResolvedValueOnce(new Promise(() => {}));
    const { unmount } = renderWithProviders(<Stock />);
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
    unmount();

    mockIng.fetchAll.mockResolvedValue([]);
    renderWithProviders(<Stock />);
    expect(
      await screen.findByText("Nenhum item cadastrado ainda."),
    ).toBeInTheDocument();
  });

  it("cria um ingrediente novo (campo de estoque inicial visível)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Stock />);
    await screen.findByText("Farinha");

    await user.click(
      screen.getByRole("button", { name: "+ Novo ingrediente" }),
    );
    expect(screen.getByText("Novo ingrediente")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nome"), "Açúcar");
    await user.type(screen.getByLabelText(/Unidade/), "kg");
    await user.type(screen.getByLabelText("Estoque inicial"), "5");
    await user.type(screen.getByLabelText(/Estoque mínimo/), "1");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mockIng.create.mock.calls[0][0]).toEqual({
      name: "Açúcar",
      unit: "kg",
      currentStock: 5,
      minStock: 1,
    });
    await waitFor(() =>
      expect(screen.queryByText("Novo ingrediente")).not.toBeInTheDocument(),
    );
  });

  it("edita um ingrediente (sem campo de estoque inicial) e trata erro", async () => {
    mockIng.update.mockRejectedValueOnce({
      response: { data: { error: "nome duplicado" } },
    });
    const user = userEvent.setup();
    renderWithProviders(<Stock />);
    await screen.findByText("Farinha");

    await user.click(screen.getAllByTitle("Ações")[0]);
    await user.click(screen.getByText("Editar"));
    expect(screen.getByText("Editar ingrediente")).toBeInTheDocument();
    expect(screen.queryByLabelText("Estoque inicial")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(mockIng.update.mock.calls[0][0]).toBe("i1");
    expect(await screen.findByText("nome duplicado")).toBeInTheDocument();

    mockIng.update.mockRejectedValueOnce(new Error("x"));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(
      await screen.findByText("Não foi possível salvar este ingrediente."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Editar ingrediente")).not.toBeInTheDocument();
  });

  it("ajusta o estoque: Reposição soma, Perda subtrai", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Stock />);
    await screen.findByText("Farinha");

    await user.click(screen.getAllByTitle("Ações")[0]);
    await user.click(screen.getByText("Ajustar estoque"));
    await user.type(screen.getByLabelText("Quantidade"), "4");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(mockIng.adjust.mock.calls[0]).toEqual(["i1", 4, "RESTOCK"]);
    await waitFor(() =>
      expect(screen.queryByText(/Ajustar estoque/)).not.toBeInTheDocument(),
    );

    await user.click(screen.getAllByTitle("Ações")[0]);
    await user.click(screen.getByText("Ajustar estoque"));
    await user.type(screen.getByLabelText("Quantidade"), "3");
    await user.selectOptions(screen.getByLabelText("Motivo"), "ADJUSTMENT");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(mockIng.adjust.mock.calls[1]).toEqual(["i1", -3, "ADJUSTMENT"]);
  });

  it("ajuste com erro exibe a mensagem", async () => {
    mockIng.adjust.mockRejectedValueOnce({
      response: { data: { error: "ficaria negativo" } },
    });
    const user = userEvent.setup();
    renderWithProviders(<Stock />);
    await screen.findByText("Farinha");
    await user.click(screen.getAllByTitle("Ações")[0]);
    await user.click(screen.getByText("Ajustar estoque"));
    await user.type(screen.getByLabelText("Quantidade"), "99");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("ficaria negativo")).toBeInTheDocument();

    mockIng.adjust.mockRejectedValueOnce(new Error("x"));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText("Não foi possível ajustar o estoque."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText(/Ajustar estoque/)).not.toBeInTheDocument();
  });

  it("exclui um item com confirm; erro dispara alert", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockIng.remove.mockRejectedValueOnce({
      response: { data: { error: "em receita" } },
    });
    const user = userEvent.setup();
    renderWithProviders(<Stock />);
    await screen.findByText("Farinha");

    await user.click(screen.getAllByTitle("Ações")[0]);
    await user.click(screen.getByText("Excluir"));
    expect(mockIng.remove.mock.calls[0][0]).toBe("i1");
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("em receita"));

    mockIng.remove.mockRejectedValueOnce(new Error("x"));
    await user.click(screen.getAllByTitle("Ações")[0]);
    await user.click(screen.getByText("Excluir"));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Não foi possível excluir este ingrediente.",
      ),
    );

    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it("cancelar o confirm de exclusão não chama a API", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    renderWithProviders(<Stock />);
    await screen.findByText("Farinha");
    await user.click(screen.getAllByTitle("Ações")[0]);
    await user.click(screen.getByText("Excluir"));
    expect(mockIng.remove).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("exclusão bem-sucedida (onSuccess, sem alerta)", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    renderWithProviders(<Stock />);
    await screen.findByText("Farinha");
    await user.click(screen.getAllByTitle("Ações")[0]);
    await user.click(screen.getByText("Excluir"));
    await waitFor(() => expect(mockIng.remove).toHaveBeenCalledTimes(1));
    expect(mockIng.remove.mock.calls[0][0]).toBe("i1");
    expect(alertSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it("alerta de estoque baixo no plural quando 2+ itens estão baixos", async () => {
    mockIng.fetchAll.mockResolvedValue([
      {
        id: "i1",
        name: "Farinha",
        unit: "kg",
        currentStock: "1",
        minStock: "2",
      },
      { id: "i2", name: "Sal", unit: "kg", currentStock: "0", minStock: "2" },
    ]);
    renderWithProviders(<Stock />);
    expect(await screen.findByText(/2 itens estão/)).toBeInTheDocument();
  });
});

describe("Stock — aba Embalagens", () => {
  it("troca de aba e usa a API de embalagens", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Stock />);
    await user.click(screen.getByRole("button", { name: "Embalagens" }));
    expect(await screen.findByText("Caixa")).toBeInTheDocument();
    expect(mockPkg.fetchAll).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "+ Nova embalagem" }));
    expect(screen.getByText("Novo embalagem")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nome"), "Sacola");
    await user.type(screen.getByLabelText(/Unidade/), "un");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(mockPkg.create).toHaveBeenCalled();
  });
});

describe("Stock — aba Movimentações", () => {
  it("mostra o estado de carregando", async () => {
    fetchStockMovements.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<Stock />);
    await user.click(screen.getByRole("button", { name: "Movimentações" }));
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
  });

  it("lista com sinais, item removido e motivo sem rótulo", async () => {
    fetchStockMovements.mockResolvedValue([
      {
        id: "mv1",
        createdAt: "2026-09-10T12:00:00Z",
        ingredient: { name: "Farinha", unit: "kg" },
        delta: "5",
        reason: "RESTOCK",
      },
      {
        id: "mv2",
        createdAt: "2026-09-10T12:00:00Z",
        packagingItem: { name: "Caixa", unit: "un" },
        delta: "-2",
        reason: "SALE",
      },
      {
        id: "mv3",
        createdAt: "2026-09-10T12:00:00Z",
        ingredient: null,
        packagingItem: null,
        delta: "-1",
        reason: "MISTERIO",
      },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<Stock />);
    await user.click(screen.getByRole("button", { name: "Movimentações" }));
    expect(await screen.findByText("Farinha")).toBeInTheDocument();
    expect(screen.getByText("(item removido)")).toBeInTheDocument();
    expect(screen.getByText("MISTERIO")).toBeInTheDocument();
    expect(screen.getByText("Venda")).toBeInTheDocument();
    expect(screen.getByText(/\+\s*5\s*kg/)).toBeInTheDocument();
  });

  it("mostra a mensagem de lista vazia", async () => {
    fetchStockMovements.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithProviders(<Stock />);
    await user.click(screen.getByRole("button", { name: "Movimentações" }));
    expect(
      await screen.findByText("Nenhuma movimentação registrada ainda."),
    ).toBeInTheDocument();
  });
});

describe("Stock — aba Receitas", () => {
  async function openRecipes() {
    const user = userEvent.setup();
    renderWithProviders(<Stock />);
    await user.click(screen.getByRole("button", { name: "Receitas" }));
    return user;
  }

  it("sem item selecionado mostra o texto de instrução", async () => {
    await openRecipes();
    expect(
      await screen.findByText("Escolha um item para ver e editar sua receita."),
    ).toBeInTheDocument();
  });

  it("seleciona um item, carrega a receita, edita e salva com sucesso", async () => {
    const user = await openRecipes();

    await user.selectOptions(await screen.findByRole("combobox"), "m1");
    expect(await screen.findByText("Farinha")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar receita" }));
    expect(saveMenuItemRecipe).toHaveBeenCalledWith("m1", {
      ingredients: [{ ingredientId: "i1", quantityPerUnit: 2 }],
      packaging: [],
    });
    expect(await screen.findByText("Receita salva.")).toBeInTheDocument();
  });

  it("mostra 'Carregando receita…' enquanto busca", async () => {
    fetchMenuItemRecipe.mockReturnValue(new Promise(() => {}));
    const user = await openRecipes();
    await user.selectOptions(await screen.findByRole("combobox"), "m1");
    expect(await screen.findByText("Carregando receita…")).toBeInTheDocument();
  });

  it("erro ao salvar a receita mostra a mensagem", async () => {
    saveMenuItemRecipe.mockRejectedValueOnce(new Error("x"));
    const user = await openRecipes();
    await user.selectOptions(await screen.findByRole("combobox"), "m1");
    await screen.findByText("Farinha");
    await user.click(screen.getByRole("button", { name: "Salvar receita" }));
    expect(
      await screen.findByText("Não foi possível salvar a receita."),
    ).toBeInTheDocument();
  });

  it("cria um novo item pelo formulário e ele vira o selecionado", async () => {
    const user = await openRecipes();
    await user.click(
      screen.getByRole("button", { name: "+ Novo item do cardápio" }),
    );
    expect(screen.getByText("STUB MenuItemForm")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "stub-cat" }));
    expect(createCategory).toHaveBeenCalledWith("C");

    await user.click(screen.getByRole("button", { name: "stub-saved" }));
    await user.click(screen.getByRole("button", { name: "stub-close" }));
    expect(screen.queryByText("STUB MenuItemForm")).not.toBeInTheDocument();
  });

  it("receita com linhas de embalagem: mapeia embalagem ao carregar e ao salvar", async () => {
    fetchMenuItemRecipe.mockResolvedValue({
      ingredients: [
        {
          ingredientId: "i1",
          name: "Farinha",
          unit: "kg",
          quantityPerUnit: "2",
        },
      ],
      packaging: [
        {
          packagingItemId: "p1",
          name: "Caixa",
          unit: "un",
          quantityPerUnit: "1",
        },
      ],
    });
    const user = await openRecipes();
    await user.selectOptions(await screen.findByRole("combobox"), "m1");
    expect(await screen.findByText("Caixa")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar receita" }));
    expect(saveMenuItemRecipe).toHaveBeenCalledWith("m1", {
      ingredients: [{ ingredientId: "i1", quantityPerUnit: 2 }],
      packaging: [{ packagingItemId: "p1", quantityPerUnit: 1 }],
    });
  });

  it("botão de salvar mostra 'Salvando…' enquanto a mutação está pendente", async () => {
    saveMenuItemRecipe.mockReturnValue(new Promise(() => {}));
    const user = await openRecipes();
    await user.selectOptions(await screen.findByRole("combobox"), "m1");
    await screen.findByText("Farinha");
    await user.click(screen.getByRole("button", { name: "Salvar receita" }));
    expect(await screen.findByText("Salvando…")).toBeInTheDocument();
  });

  it("catálogos ainda não carregados caem para lista vazia sem quebrar", async () => {
    mockIng.fetchAll.mockReturnValue(new Promise(() => {}));
    mockPkg.fetchAll.mockReturnValue(new Promise(() => {}));
    fetchCategories.mockReturnValue(new Promise(() => {}));
    const user = await openRecipes();
    await user.selectOptions(await screen.findByRole("combobox"), "m1");
    expect(await screen.findByText("Farinha")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "+ Novo item do cardápio" }),
    );
    expect(screen.getByText("STUB MenuItemForm")).toBeInTheDocument();
  });
});
