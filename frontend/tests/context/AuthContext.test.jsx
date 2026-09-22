import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth, HOME_ROUTE_BY_ROLE } from "../../src/context/AuthContext";
import * as authApi from "../../src/api/auth";
import { setToken, getToken } from "../../src/api/client";

vi.mock("../../src/api/auth", () => ({ login: vi.fn(), fetchMe: vi.fn() }));

function Consumer() {
  const { user, loading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.name : "anon"}</span>
      <button onClick={() => login("a@b.com", "pw")}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("sem token: termina o loading sem chamar fetchMe", async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(authApi.fetchMe).not.toHaveBeenCalled();
    expect(screen.getByTestId("user")).toHaveTextContent("anon");
  });

  it("com token válido: carrega o usuário via fetchMe", async () => {
    setToken("tok");
    authApi.fetchMe.mockResolvedValue({ id: "1", name: "Ana", role: "ADMIN" });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Ana"));
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("com token inválido: limpa o token e segue anônimo", async () => {
    setToken("ruim");
    authApi.fetchMe.mockRejectedValue(new Error("401"));
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("anon");
    expect(getToken()).toBeNull();
  });

  it("login guarda o token e o usuário; logout limpa os dois", async () => {
    authApi.login.mockResolvedValue({ token: "novo-tok", user: { id: "1", name: "Bia", role: "WAITER" } });
    const user = userEvent.setup();
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await user.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Bia"));
    expect(getToken()).toBe("novo-tok");

    await user.click(screen.getByText("logout"));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("anon"));
    expect(getToken()).toBeNull();
  });

  it("useAuth fora do provider lança erro", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(/useAuth must be used within an AuthProvider/);
    spy.mockRestore();
  });

  it("HOME_ROUTE_BY_ROLE mapeia cada papel", () => {
    expect(HOME_ROUTE_BY_ROLE).toEqual({
      ADMIN: "/dashboard",
      WAITER: "/tables",
      KITCHEN: "/kitchen",
      DELIVERY: "/delivery",
    });
  });
});
