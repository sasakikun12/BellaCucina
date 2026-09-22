import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth, HOME_ROUTE_BY_ROLE } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Menu } from "./pages/Menu";
import { Tables } from "./pages/Tables";
import { Orders } from "./pages/Orders";
import { Kitchen } from "./pages/Kitchen";
import { Delivery } from "./pages/Delivery";
import { Staff } from "./pages/Staff";
import { Stock } from "./pages/Stock";
import { NotFound, Unauthorized } from "./pages/NotFound";

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/menu" replace />;
  return <Navigate to={HOME_ROUTE_BY_ROLE[user.role]} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />

        <Route path="/menu" element={<Menu />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/staff" element={<Staff />} />
          </Route>
          <Route element={<ProtectedRoute roles={["ADMIN", "WAITER"]} />}>
            <Route path="/tables" element={<Tables />} />
            <Route path="/orders" element={<Orders />} />
          </Route>
          <Route element={<ProtectedRoute roles={["ADMIN", "KITCHEN"]} />}>
            <Route path="/kitchen" element={<Kitchen />} />
          </Route>
          <Route element={<ProtectedRoute roles={["ADMIN", "DELIVERY"]} />}>
            <Route path="/delivery" element={<Delivery />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
