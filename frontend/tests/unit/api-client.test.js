import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { api, getToken, setToken, clearToken, API_BASE_URL } from "../../src/api/client";

const requestFulfilled = api.interceptors.request.handlers[0].fulfilled;
const responseFulfilled = api.interceptors.response.handlers[0].fulfilled;
const responseRejected = api.interceptors.response.handlers[0].rejected;

describe("api/client — token helpers", () => {
  beforeEach(() => localStorage.clear());

  it("set/get/clear no localStorage", () => {
    expect(getToken()).toBeNull();
    setToken("abc123");
    expect(getToken()).toBe("abc123");
    expect(localStorage.getItem("restaurant_token")).toBe("abc123");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("API_BASE_URL cai no padrão local quando VITE_API_URL não está definido", () => {
    expect(API_BASE_URL).toBe("http://localhost:4000");
    expect(api.defaults.baseURL).toBe("http://localhost:4000/api");
  });
});

describe("api/client — interceptor de request", () => {
  beforeEach(() => localStorage.clear());

  it("injeta o header Authorization quando há token", () => {
    setToken("meu-token");
    const config = requestFulfilled({ headers: {} });
    expect(config.headers.Authorization).toBe("Bearer meu-token");
  });

  it("não injeta header quando não há token", () => {
    const config = requestFulfilled({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe("api/client — interceptor de response", () => {
  const realLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    setToken("t");
  });
  afterEach(() => {
    Object.defineProperty(window, "location", { value: realLocation, writable: true, configurable: true });
  });

  function stubLocation(pathname) {
    Object.defineProperty(window, "location", {
      value: { pathname, href: pathname },
      writable: true,
      configurable: true,
    });
  }

  it("respostas de sucesso passam direto", () => {
    const res = { status: 200, data: 1 };
    expect(responseFulfilled(res)).toBe(res);
  });

  it("em 401 fora de /login: limpa o token e redireciona para /login", async () => {
    stubLocation("/pedidos");
    await expect(responseRejected({ response: { status: 401 } })).rejects.toBeDefined();
    expect(getToken()).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("em 401 já em /login: limpa o token mas não redireciona de novo", async () => {
    stubLocation("/login");
    await expect(responseRejected({ response: { status: 401 } })).rejects.toBeDefined();
    expect(getToken()).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("erros que não são 401 são apenas repropagados", async () => {
    stubLocation("/pedidos");
    const err = { response: { status: 500 } };
    await expect(responseRejected(err)).rejects.toBe(err);
    expect(getToken()).toBe("t");
  });

  it("erro sem response (rede) é repropagado", async () => {
    const err = new Error("Network Error");
    await expect(responseRejected(err)).rejects.toBe(err);
  });
});
