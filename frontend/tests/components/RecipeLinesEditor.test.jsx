import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecipeLinesEditor } from "../../src/components/RecipeLinesEditor";

const CATALOG = [
  { id: "flour", name: "Farinha", unit: "kg" },
  { id: "salt", name: "Sal", unit: "g" },
];
const EMPTY_LABEL = "Nenhum ingrediente na receita.";

function EditorHarness({ initialLines = [], available = CATALOG }) {
  const [lines, setLines] = useState(initialLines);
  return (
    <RecipeLinesEditor
      title="Ingredientes"
      lines={lines}
      setLines={setLines}
      available={available}
      idField="ingredientId"
      emptyLabel={EMPTY_LABEL}
    />
  );
}

describe("RecipeLinesEditor", () => {
  it("mostra a mensagem vazia quando não há linhas", () => {
    render(<EditorHarness />);
    expect(screen.getByText(EMPTY_LABEL)).toBeInTheDocument();
  });

  it("adiciona uma linha ao selecionar um item, digitar a quantidade e clicar em Adicionar", async () => {
    const user = userEvent.setup();
    render(<EditorHarness />);

    await user.selectOptions(screen.getByRole("combobox"), "flour");
    await user.type(screen.getByPlaceholderText("Qtd."), "2");
    await user.click(screen.getByRole("button", { name: "+ Adicionar" }));

    expect(screen.getByText("Farinha")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_LABEL)).not.toBeInTheDocument();
  });

  it("remove uma linha existente ao clicar em Remover", async () => {
    const user = userEvent.setup();
    render(
      <EditorHarness
        initialLines={[{ ingredientId: "flour", name: "Farinha", unit: "kg", quantityPerUnit: 2 }]}
        available={[]}
      />,
    );

    expect(screen.getByText("Farinha")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remover" }));

    expect(screen.getByText(EMPTY_LABEL)).toBeInTheDocument();
  });

  it("não adiciona linha quando falta seleção ou quantidade (guarda do addLine)", async () => {
    const user = userEvent.setup();
    render(<EditorHarness />);

    await user.click(screen.getByRole("button", { name: "+ Adicionar" }));
    expect(screen.getByText(EMPTY_LABEL)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox"), "flour");
    await user.type(screen.getByPlaceholderText("Qtd."), "0");
    await user.click(screen.getByRole("button", { name: "+ Adicionar" }));
    expect(screen.getByText(EMPTY_LABEL)).toBeInTheDocument();
  });

  it("edita a quantidade de uma linha sem afetar as outras (updateQty)", async () => {
    const user = userEvent.setup();
    render(
      <EditorHarness
        initialLines={[
          { ingredientId: "flour", name: "Farinha", unit: "kg", quantityPerUnit: "2" },
          { ingredientId: "salt", name: "Sal", unit: "g", quantityPerUnit: "5" },
        ]}
        available={[]}
      />,
    );

    const inputs = screen.getAllByRole("spinbutton");
    await user.clear(inputs[0]);
    await user.type(inputs[0], "9");

    expect(inputs[0]).toHaveValue(9);
    expect(inputs[1]).toHaveValue(5);
  });

  it("sem itens disponíveis, não renderiza a linha de adicionar", () => {
    render(<EditorHarness available={[]} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Adicionar" })).not.toBeInTheDocument();
  });
});
