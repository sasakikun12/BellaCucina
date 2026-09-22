import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render.jsx";

vi.mock("../../src/api/users", () => ({ fetchUsers: vi.fn(), createUser: vi.fn(), deleteUser: vi.fn() }));
const mockUseAuth = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

import { fetchUsers, createUser, deleteUser } from "../../src/api/users";
import { Staff } from "../../src/pages/Staff";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: "me", role: "ADMIN" } });
  fetchUsers.mockResolvedValue([
    { id: "me", name: "Eu Mesmo", email: "me@r.com", role: "ADMIN" },
    { id: "u2", name: "Bruno", email: "bruno@r.com", role: "KITCHEN" },
  ]);
  createUser.mockResolvedValue({ id: "new" });
  deleteUser.mockResolvedValue();
});

describe("Staff", () => {
  it("carregando e depois a tabela com os cargos traduzidos", async () => {
    fetchUsers.mockResolvedValueOnce(new Promise(() => {}));
    const { unmount } = renderWithProviders(<Staff />);
    expect(screen.getByText("Carregando equipe…")).toBeInTheDocument();
    unmount();

    fetchUsers.mockResolvedValue([{ id: "u2", name: "Bruno", email: "bruno@r.com", role: "KITCHEN" }]);
    renderWithProviders(<Staff />);
    expect(await screen.findByText("Bruno")).toBeInTheDocument();
    expect(screen.getByText("Cozinha")).toBeInTheDocument();
  });

  it("não mostra 'Remover' na própria linha; remove outro após confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderWithProviders(<Staff />);

    await screen.findByText("Bruno");
    const removeButtons = screen.getAllByRole("button", { name: "Remover" });
    expect(removeButtons).toHaveLength(1);

    await user.click(removeButtons[0]);
    expect(confirmSpy).toHaveBeenCalledWith("Remover Bruno?");
    expect(deleteUser.mock.calls[0][0]).toBe("u2");
    confirmSpy.mockRestore();
  });

  it("cancelar o confirm não remove", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    renderWithProviders(<Staff />);
    await screen.findByText("Bruno");
    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(deleteUser).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("abre o formulário, cria um membro e fecha no sucesso", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Staff />);
    await screen.findByText("Bruno");

    await user.click(screen.getByRole("button", { name: "+ Adicionar membro" }));
    expect(screen.getByText("Adicionar membro da equipe")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nome"), "Nova Pessoa");
    await user.type(screen.getByLabelText("E-mail"), "nova@r.com");
    await user.type(screen.getByLabelText("Senha"), "segredo123");
    await user.selectOptions(screen.getByLabelText("Cargo"), "DELIVERY");
    await user.click(screen.getByRole("button", { name: "Criar" }));

    expect(createUser.mock.calls[0][0]).toEqual({
      name: "Nova Pessoa",
      email: "nova@r.com",
      password: "segredo123",
      role: "DELIVERY",
    });
    await waitFor(() => expect(screen.queryByText("Adicionar membro da equipe")).not.toBeInTheDocument());
  });

  it("mostra a mensagem de erro do backend ao falhar a criação", async () => {
    createUser.mockRejectedValue({ response: { data: { error: "E-mail já usado" } } });
    const user = userEvent.setup();
    renderWithProviders(<Staff />);
    await screen.findByText("Bruno");
    await user.click(screen.getByRole("button", { name: "+ Adicionar membro" }));
    await user.type(screen.getByLabelText("Nome"), "X");
    await user.type(screen.getByLabelText("E-mail"), "x@r.com");
    await user.type(screen.getByLabelText("Senha"), "segredo123");
    await user.click(screen.getByRole("button", { name: "Criar" }));
    expect(await screen.findByText("E-mail já usado")).toBeInTheDocument();
  });

  it("erro sem mensagem do backend usa o texto padrão", async () => {
    createUser.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    renderWithProviders(<Staff />);
    await screen.findByText("Bruno");
    await user.click(screen.getByRole("button", { name: "+ Adicionar membro" }));
    await user.type(screen.getByLabelText("Nome"), "X");
    await user.type(screen.getByLabelText("E-mail"), "x@r.com");
    await user.type(screen.getByLabelText("Senha"), "segredo123");
    await user.click(screen.getByRole("button", { name: "Criar" }));
    expect(await screen.findByText("Não foi possível criar o usuário")).toBeInTheDocument();
  });

  it("botão Cancelar fecha o formulário", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Staff />);
    await screen.findByText("Bruno");
    await user.click(screen.getByRole("button", { name: "+ Adicionar membro" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Adicionar membro da equipe")).not.toBeInTheDocument();
  });
});
