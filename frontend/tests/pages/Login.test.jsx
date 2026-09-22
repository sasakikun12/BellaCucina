import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../../src/context/AuthContext";
import { Login } from "../../src/pages/Login";
import * as authApi from "../../src/api/auth";

vi.mock("../../src/api/auth", () => ({
  login: vi.fn(),
  fetchMe: vi.fn(),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Login", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("faz login com sucesso, chamando a API com as credenciais informadas", async () => {
    authApi.login.mockResolvedValue({
      token: "fake-token",
      user: {
        id: "1",
        name: "Ana",
        email: "admin@restaurant.com",
        role: "ADMIN",
      },
    });
    const user = userEvent.setup();

    renderLogin();
    await user.type(
      screen.getByPlaceholderText("voce@restaurant.com"),
      "admin@restaurant.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(authApi.login).toHaveBeenCalledWith(
      "admin@restaurant.com",
      "password123",
    );
  });

  it("mostra uma mensagem de erro quando o login falha", async () => {
    authApi.login.mockRejectedValue(new Error("credenciais inválidas"));
    const user = userEvent.setup();

    renderLogin();
    await user.type(
      screen.getByPlaceholderText("voce@restaurant.com"),
      "errado@restaurant.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "senha-errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByText("E-mail ou senha inválidos"),
    ).toBeInTheDocument();
  });

  it("preenche e-mail e senha ao clicar em uma conta de demonstração", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(
      screen.getByRole("button", { name: "admin@restaurant.com" }),
    );

    expect(screen.getByPlaceholderText("voce@restaurant.com")).toHaveValue(
      "admin@restaurant.com",
    );
    expect(screen.getByPlaceholderText("••••••••")).toHaveValue("password123");
  });
});
