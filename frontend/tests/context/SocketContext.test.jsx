import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

const fakeSocket = {
  on: vi.fn(),
  off: vi.fn(),
  disconnect: vi.fn(),
};
const ioMock = vi.fn(() => fakeSocket);
vi.mock("socket.io-client", () => ({ io: (...args) => ioMock(...args) }));

const mockUseAuth = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

vi.mock("../../src/api/client", () => ({
  API_BASE_URL: "http://api.test",
  getToken: () => "socket-token",
}));

import { SocketProvider, useSocket } from "../../src/context/SocketContext";

function Consumer({ onReady }) {
  const socket = useSocket();
  onReady?.(socket);
  return <div data-testid="ready">ok</div>;
}

function renderWithUser(user, onReady) {
  mockUseAuth.mockReturnValue({ user });
  return render(
    <SocketProvider>
      <Consumer onReady={onReady} />
    </SocketProvider>,
  );
}

describe("SocketContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sem usuário: não abre socket; subscribe vira no-op seguro", () => {
    let api;
    renderWithUser(null, (s) => (api = s));
    expect(ioMock).not.toHaveBeenCalled();

    const unsub = api.onOrderNew(vi.fn());
    expect(typeof unsub).toBe("function");
    expect(() => unsub()).not.toThrow();
    expect(fakeSocket.off).not.toHaveBeenCalled();
  });

  it("com usuário: conecta com token e registra/desregistra listeners", () => {
    let api;
    renderWithUser({ id: "1" }, (s) => (api = s));

    expect(ioMock).toHaveBeenCalledWith("http://api.test", { auth: { token: "socket-token" } });

    const cbNew = vi.fn();
    const cbUpd = vi.fn();
    const cbTable = vi.fn();
    const unsubs = [api.onOrderNew(cbNew), api.onOrderUpdated(cbUpd), api.onTableUpdated(cbTable)];

    expect(fakeSocket.on).toHaveBeenCalledWith("order:new", cbNew);
    expect(fakeSocket.on).toHaveBeenCalledWith("order:updated", cbUpd);
    expect(fakeSocket.on).toHaveBeenCalledWith("table:updated", cbTable);

    unsubs.forEach((u) => u());
    expect(fakeSocket.off).toHaveBeenCalledWith("order:new", cbNew);
    expect(fakeSocket.off).toHaveBeenCalledWith("order:updated", cbUpd);
    expect(fakeSocket.off).toHaveBeenCalledWith("table:updated", cbTable);
  });

  it("desconecta o socket ao desmontar", () => {
    mockUseAuth.mockReturnValue({ user: { id: "1" } });
    const { unmount } = render(
      <SocketProvider>
        <Consumer />
      </SocketProvider>,
    );
    expect(ioMock).toHaveBeenCalledTimes(1);
    unmount();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });

  it("ao sair (user vira null) desconecta e zera a ref", () => {
    mockUseAuth.mockReturnValue({ user: { id: "1" } });
    const { rerender } = render(
      <SocketProvider>
        <Consumer />
      </SocketProvider>,
    );
    expect(ioMock).toHaveBeenCalledTimes(1);

    mockUseAuth.mockReturnValue({ user: null });
    act(() => {
      rerender(
        <SocketProvider>
          <Consumer />
        </SocketProvider>,
      );
    });
    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });

  it("useSocket fora do provider lança erro", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(/useSocket must be used within a SocketProvider/);
    spy.mockRestore();
  });
});
