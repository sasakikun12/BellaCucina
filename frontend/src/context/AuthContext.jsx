import { createContext, useContext, useEffect, useState } from "react";
import { fetchMe, login as loginRequest } from "../api/auth";
import { clearToken, getToken, setToken } from "../api/client";

const AuthContext = createContext(undefined);

export const HOME_ROUTE_BY_ROLE = {
  ADMIN: "/dashboard",
  WAITER: "/tables",
  KITCHEN: "/kitchen",
  DELIVERY: "/delivery",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { token, user: loggedInUser } = await loginRequest(email, password);
    setToken(token);
    setUser(loggedInUser);
    return loggedInUser;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
