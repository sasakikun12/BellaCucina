import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { API_BASE_URL, getToken } from "../api/client";

const SocketContext = createContext(undefined);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [, forceRerender] = useState(0);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(API_BASE_URL, { auth: { token: getToken() } });
    socketRef.current = socket;
    forceRerender((n) => n + 1);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  function subscribe(event, cb) {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on(event, cb);
    return () => {
      socket.off(event, cb);
    };
  }

  const value = {
    onOrderNew: (cb) => subscribe("order:new", cb),
    onOrderUpdated: (cb) => subscribe("order:updated", cb),
    onTableUpdated: (cb) => subscribe("table:updated", cb),
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within a SocketProvider");
  return ctx;
}
