import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { io as ioClient } from "socket.io-client";

const require = createRequire(import.meta.url);
const socketModule = require("../../src/socket");
const { initSocket, emitOrderNew, emitOrderUpdated, emitTableUpdated } = socketModule;
const { signToken } = require("../../src/utils/jwt");

describe("socket.js — antes de initSocket", () => {
  it("um emitter lança se o socket ainda não foi inicializado", () => {
    expect(() => emitOrderNew({ id: "x" })).toThrow("Socket.io not initialized yet");
  });
});

describe("socket.js", () => {
  let httpServer;
  let io;
  let port;
  let logSpy;

  beforeAll(async () => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    httpServer = createServer();
    io = initSocket(httpServer);
    await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    port = httpServer.address().port;
  });

  afterAll(async () => {
    io.close();
    await new Promise((resolve) => httpServer.close(resolve));
    logSpy.mockRestore();
  });

  function connect(auth) {
    return ioClient(`http://127.0.0.1:${port}`, {
      auth,
      transports: ["websocket"],
      reconnection: false,
    });
  }

  it("recusa a conexão sem token", async () => {
    const client = connect({});
    const err = await new Promise((resolve) => client.on("connect_error", resolve));
    expect(err.message).toBe("Missing auth token");
    client.close();
  });

  it("recusa a conexão com token inválido", async () => {
    const client = connect({ token: "nao-e-um-jwt" });
    const err = await new Promise((resolve) => client.on("connect_error", resolve));
    expect(err.message).toBe("Invalid auth token");
    client.close();
  });

  it("aceita a conexão com token válido e trata connect/disconnect", async () => {
    const token = signToken({ sub: "u1", role: "ADMIN", name: "Ana" });
    const client = connect({ token });

    await new Promise((resolve) => client.on("connect", resolve));
    expect(client.connected).toBe(true);

    await vi.waitFor(() =>
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("connected: Ana (ADMIN)")),
    );

    client.close();
    await vi.waitFor(() =>
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("disconnected: Ana")),
    );
  });

  it("os emitters de domínio entregam o payload aos clientes conectados", async () => {
    const token = signToken({ sub: "u2", role: "WAITER", name: "Bia" });
    const client = connect({ token });
    await new Promise((resolve) => client.on("connect", resolve));

    const received = {};
    client.on("order:new", (p) => (received.orderNew = p));
    client.on("order:updated", (p) => (received.orderUpdated = p));
    client.on("table:updated", (p) => (received.tableUpdated = p));

    emitOrderNew({ id: "o1" });
    emitOrderUpdated({ id: "o1", status: "READY" });
    emitTableUpdated({ id: "t1", status: "FREE" });

    await vi.waitFor(() => {
      expect(received.orderNew).toEqual({ id: "o1" });
      expect(received.orderUpdated).toEqual({ id: "o1", status: "READY" });
      expect(received.tableUpdated).toEqual({ id: "t1", status: "FREE" });
    });

    client.close();
  });
});
