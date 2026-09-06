import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import { useAuth } from "./context/AuthContext";
import { Spinner } from "./components/ui";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Dealers from "./pages/Dealers";
import DealerDetail from "./pages/DealerDetail";
import Transactions from "./pages/Transactions";
import TransactionDetail from "./pages/TransactionDetail";
import NewTransaction from "./pages/NewTransaction";
import Ledger from "./pages/Ledger";
import Officers from "./pages/Officers";

function RequireAuth({ children }: { children: ReactElement }) {
  const { officer, loading } = useAuth();
  if (loading) return <div className="p-10 flex justify-center"><Spinner size={6} /></div>;
  if (!officer) return <Navigate to="/login" replace />;
  return children;
}

// Officer-only routes: admins are always sent to the Officers management page.
function OfficerOnly({ children }: { children: ReactElement }) {
  const { officer } = useAuth();
  if (officer?.role === "admin") return <Navigate to="/officers" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/officers" element={<Officers />} />
        {/* Business tabs are officer-only; admin is redirected to /officers */}
        <Route
          path="/"
          element={
            <OfficerOnly>
              <Dashboard />
            </OfficerOnly>
          }
        />
        <Route
          path="/dealers"
          element={
            <OfficerOnly>
              <Dealers />
            </OfficerOnly>
          }
        />
        <Route
          path="/dealers/:id"
          element={
            <OfficerOnly>
              <DealerDetail />
            </OfficerOnly>
          }
        />
        <Route
          path="/transactions"
          element={
            <OfficerOnly>
              <Transactions />
            </OfficerOnly>
          }
        />
        <Route
          path="/transactions/new"
          element={
            <OfficerOnly>
              <NewTransaction />
            </OfficerOnly>
          }
        />
        <Route
          path="/transactions/:id"
          element={
            <OfficerOnly>
              <TransactionDetail />
            </OfficerOnly>
          }
        />
        <Route
          path="/ledger"
          element={
            <OfficerOnly>
              <Ledger />
            </OfficerOnly>
          }
        />
      </Route>
      <Route
        path="*"
        element={
          <AdminAwareWildcard />
        }
      />
    </Routes>
  );
}

function AdminAwareWildcard() {
  const { officer, loading } = useAuth();
  if (loading) return <div className="p-10 flex justify-center"><Spinner size={6} /></div>;
  return <Navigate to={officer?.role === "admin" ? "/officers" : "/"} replace />;
}

