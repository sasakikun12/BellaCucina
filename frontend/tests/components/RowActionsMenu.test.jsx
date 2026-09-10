import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RowActionsMenu } from "../../src/components/RowActionsMenu";

describe("RowActionsMenu", () => {
  it("abre a lista ao clicar no ícone, executa a ação escolhida e fecha o menu", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();

    render(
      <RowActionsMenu
        actions={[
          { label: "Editar", onClick: onEdit },
          { label: "Excluir", danger: true, onClick: vi.fn() },
        ]}
      />,
    );

    expect(screen.queryByText("Editar")).not.toBeInTheDocument();

    await user.click(screen.getByTitle("Ações"));
    expect(screen.getByText("Editar")).toBeInTheDocument();

    await user.click(screen.getByText("Editar"));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Editar")).not.toBeInTheDocument();
  });

  it("fecha o menu ao clicar fora dele", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <RowActionsMenu actions={[{ label: "Editar", onClick: vi.fn() }]} />
        <button type="button">Fora</button>
      </div>,
    );

    await user.click(screen.getByTitle("Ações"));
    expect(screen.getByText("Editar")).toBeInTheDocument();

    await user.click(screen.getByText("Fora"));
    expect(screen.queryByText("Editar")).not.toBeInTheDocument();
  });
});
