import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NotFound, Unauthorized } from "../../src/pages/NotFound";

describe("NotFound / Unauthorized", () => {
  it("NotFound mostra a mensagem e o link de voltar", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByText("Página não encontrada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para o início" })).toHaveAttribute("href", "/");
  });

  it("Unauthorized mostra a mensagem de acesso negado", () => {
    render(
      <MemoryRouter>
        <Unauthorized />
      </MemoryRouter>,
    );
    expect(screen.getByText("Você não tem acesso a esta página")).toBeInTheDocument();
  });
});
