import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render.jsx";

vi.mock("../../src/api/menu", () => ({
  createMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  saveMenuItemRecipe: vi.fn(),
}));
vi.mock("../../src/api/stock", () => ({
  ingredientsApi: { fetchAll: vi.fn() },
  packagingApi: { fetchAll: vi.fn() },
}));

import { createMenuItem, updateMenuItem, saveMenuItemRecipe } from "../../src/api/menu";
import { ingredientsApi, packagingApi } from "../../src/api/stock";
import { MenuItemForm } from "../../src/components/MenuItemForm";

const CATS = [
  { id: "c1", name: "Pratos" },
  { id: "c2", name: "Bebidas" },
];

beforeEach(() => {
  vi.clearAllMocks();
  ingredientsApi.fetchAll.mockResolvedValue([{ id: "ing1", name: "Farinha", unit: "kg" }]);
  packagingApi.fetchAll.mockResolvedValue([{ id: "pkg1", name: "Caixa", unit: "un" }]);
  createMenuItem.mockResolvedValue({ id: "new1" });
  updateMenuItem.mockResolvedValue({ id: "m1" });
  saveMenuItemRecipe.mockResolvedValue();
});

describe("MenuItemForm — criação", () => {
  it("cria um item simples (sem receita) e fecha", async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MenuItemForm item={null} categories={CATS} onClose={onClose} onCreateCategory={vi.fn()} onSaved={onSaved} />,
    );

    await user.type(screen.getByLabelText("Nome"), "Lasanha");
    await user.type(screen.getByLabelText("Descrição"), "à bolonhesa");
    await user.type(screen.getByLabelText("Preço (R$)"), "42");
    await user.type(screen.getByLabelText("URL da foto"), "https://x/l.jpg");
    await user.click(screen.getByLabelText("Disponível no cardápio"));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(createMenuItem.mock.calls[0][0]).toEqual({
      name: "Lasanha",
      description: "à bolonhesa",
      price: 42,
      categoryId: "c1",
      available: false,
      photoFile: null,
      photoUrl: "https://x/l.jpg",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalledWith({ id: "new1" });
  });

  it("bloqueia o envio sem categoria", async () => {
    renderWithProviders(
      <MenuItemForm item={null} categories={[]} onClose={vi.fn()} onCreateCategory={vi.fn()} />,
    );
    fireEvent.submit(document.querySelector("form"));
    expect(await screen.findByText("Escolha ou crie uma categoria primeiro.")).toBeInTheDocument();
    expect(createMenuItem).not.toHaveBeenCalled();
  });

  it("adiciona nova categoria (ignora entrada em branco)", async () => {
    const onCreateCategory = vi.fn().mockResolvedValue();
    const user = userEvent.setup();
    renderWithProviders(
      <MenuItemForm item={null} categories={CATS} onClose={vi.fn()} onCreateCategory={onCreateCategory} />,
    );

    const catField = screen.getByPlaceholderText("Nome da nova categoria").closest("label");
    const addCatBtn = within(catField).getByRole("button", { name: "+ Adicionar" });

    await user.click(addCatBtn);
    expect(onCreateCategory).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText("Nome da nova categoria"), "  Sobremesas  ");
    await user.click(addCatBtn);
    expect(onCreateCategory).toHaveBeenCalledWith("Sobremesas");
  });

  it("anexa arquivo de foto e monta receita; salva a receita após criar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <MenuItemForm item={null} categories={CATS} onClose={onClose} onCreateCategory={vi.fn()} />,
    );
    await screen.findByText("Ingredientes");

    await user.type(screen.getByLabelText("Nome"), "Pizza");
    await user.type(screen.getByLabelText("Descrição"), "d");
    await user.type(screen.getByLabelText("Preço (R$)"), "30");

    const file = new File(["x"], "pizza.png", { type: "image/png" });
    await user.upload(document.querySelector('input[type="file"]'), file);

    const ingBox = screen.getByText("Ingredientes").closest("div");
    await user.selectOptions(within(ingBox).getByRole("combobox"), "ing1");
    await user.type(within(ingBox).getByPlaceholderText("Qtd."), "2");
    await user.click(within(ingBox).getByRole("button", { name: "+ Adicionar" }));

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(createMenuItem.mock.calls[0][0].photoFile).toBe(file);
    await waitFor(() =>
      expect(saveMenuItemRecipe).toHaveBeenCalledWith("new1", {
        ingredients: [{ ingredientId: "ing1", quantityPerUnit: 2 }],
        packaging: [],
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("avisa (alert) se falhar ao salvar a receita, mas ainda fecha", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    saveMenuItemRecipe.mockRejectedValue(new Error("boom"));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MenuItemForm item={null} categories={CATS} onClose={onClose} onCreateCategory={vi.fn()} />,
    );
    await screen.findByText("Embalagem");
    await user.type(screen.getByLabelText("Nome"), "Pizza");
    await user.type(screen.getByLabelText("Descrição"), "d");
    await user.type(screen.getByLabelText("Preço (R$)"), "30");

    const pkgBox = screen.getByText("Embalagem").closest("div");
    await user.selectOptions(within(pkgBox).getByRole("combobox"), "pkg1");
    await user.type(within(pkgBox).getByPlaceholderText("Qtd."), "1");
    await user.click(within(pkgBox).getByRole("button", { name: "+ Adicionar" }));

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    alertSpy.mockRestore();
  });

  it("troca a categoria pelo select e limpar o campo de arquivo volta photoFile a null", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MenuItemForm item={null} categories={CATS} onClose={vi.fn()} onCreateCategory={vi.fn()} />,
    );
    await screen.findByText("Ingredientes");

    await user.type(screen.getByLabelText("Nome"), "X");
    await user.type(screen.getByLabelText("Descrição"), "d");
    await user.type(screen.getByLabelText("Preço (R$)"), "1");

    const catSelect = screen.getByPlaceholderText("Nome da nova categoria").closest("label").querySelector("select");
    await user.selectOptions(catSelect, "c2");

    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, new File(["x"], "a.png", { type: "image/png" }));
    fireEvent.change(fileInput, { target: { files: [] } });

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(createMenuItem.mock.calls[0][0]).toMatchObject({ categoryId: "c2", photoFile: null });
  });

  it("erro na criação exibe mensagem e mantém aberto", async () => {
    createMenuItem.mockRejectedValue(new Error("400"));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MenuItemForm item={null} categories={CATS} onClose={onClose} onCreateCategory={vi.fn()} />,
    );
    await user.type(screen.getByLabelText("Nome"), "X");
    await user.type(screen.getByLabelText("Descrição"), "d");
    await user.type(screen.getByLabelText("Preço (R$)"), "1");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(/Não foi possível salvar o item/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("MenuItemForm — edição", () => {
  const item = {
    id: "m1",
    name: "Pizza",
    description: "antiga",
    price: "30",
    categoryId: "c2",
    available: true,
    photoUrl: "https://x/p.jpg",
  };

  it("pré-preenche, não mostra a seção de receita e chama updateMenuItem", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MenuItemForm item={item} categories={CATS} onClose={onClose} onCreateCategory={vi.fn()} />,
    );

    expect(screen.getByLabelText("Nome")).toHaveValue("Pizza");
    expect(screen.getByText("Editar item do cardápio")).toBeInTheDocument();
    expect(screen.queryByText("Ingredientes")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Preço (R$)"));
    await user.type(screen.getByLabelText("Preço (R$)"), "35");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(updateMenuItem.mock.calls[0][0]).toBe("m1");
    expect(updateMenuItem.mock.calls[0][1]).toMatchObject({ price: 35, categoryId: "c2", available: true });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("sem onSaved, apenas fecha após salvar", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MenuItemForm item={item} categories={CATS} onClose={onClose} onCreateCategory={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("botão Cancelar chama onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MenuItemForm item={item} categories={CATS} onClose={onClose} onCreateCategory={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
  });
});
