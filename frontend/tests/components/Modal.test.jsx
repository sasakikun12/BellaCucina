import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "../../src/components/Modal";

describe("Modal", () => {
  it("renderiza título e conteúdo; largura estreita por padrão", () => {
    render(
      <Modal title="Meu título" onClose={vi.fn()}>
        <p>conteúdo</p>
      </Modal>,
    );
    expect(screen.getByText("Meu título")).toBeInTheDocument();
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("fecha ao clicar no backdrop e no botão ✕, mas não ao clicar no corpo", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal title="T" onClose={onClose} wide>
        <p>corpo</p>
      </Modal>,
    );

    await user.click(screen.getByText("corpo"));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "✕" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText("T").closest(".fixed"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
