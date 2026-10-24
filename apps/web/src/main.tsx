import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useMe } from "./hooks/data";
import { Layout } from "./components/common/Layout";
import { Loading } from "./components/common/primitives";
import { Access } from "./pages/Access";
const Overview = lazy(() =>
  import("./pages/Overview").then((m) => ({ default: m.Overview })),
);
const Accounts = lazy(() =>
  import("./pages/Accounts").then((m) => ({ default: m.Accounts })),
);
const Transactions = lazy(() =>
  import("./pages/Transactions").then((m) => ({ default: m.Transactions })),
);
const Imports = lazy(() =>
  import("./pages/Imports").then((m) => ({ default: m.Imports })),
);
const Plan = lazy(() =>
  import("./pages/Plan").then((m) => ({ default: m.Plan })),
);
const AssetDetail = lazy(() =>
  import("./pages/AssetDetail").then((m) => ({ default: m.AssetDetail })),
);
const Expenses = lazy(() =>
  import("./pages/Expenses").then((m) => ({ default: m.Expenses })),
);
const CategoriesPage = lazy(() =>
  import("./pages/Categories").then((m) => ({ default: m.CategoriesPage })),
);
const Assets = lazy(() =>
  import("./pages/Assets").then((m) => ({ default: m.Assets })),
);
const AccountDetail = lazy(() =>
  import("./pages/AccountDetail").then((m) => ({ default: m.AccountDetail })),
);
const StatementImport = lazy(() =>
  import("./pages/StatementImport").then((m) => ({
    default: m.StatementImport,
  })),
);
const NetWorth = lazy(() =>
  import("./pages/NetWorth").then((m) => ({ default: m.NetWorth })),
);
const SettingsPage = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.SettingsPage })),
);
const Documentation = lazy(() =>
  import("./pages/Documentation").then((m) => ({ default: m.Documentation })),
);
import "./index.css";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: true },
  },
});
function App() {
  const me = useMe();
  if (me.isPending) return <Loading />;
  if (!me.data) return <Access />;
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout user={me.data} />}>
          <Route index element={<Overview />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="accounts/:id" element={<AccountDetail />} />
          <Route path="accounts/:id/statement" element={<StatementImport />} />
          <Route
            path="accounts/:id/statement/:statementId"
            element={<StatementImport />}
          />
          <Route path="assets" element={<Assets />} />
          <Route path="assets/:id" element={<AssetDetail />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route
            path="settings/categories"
            element={<Navigate to="/categories" replace />}
          />
          <Route path="transactions" element={<Transactions />} />
          <Route path="imports" element={<Imports />} />
          <Route path="plan" element={<Plan />} />
          <Route path="net-worth" element={<NetWorth />} />
          <Route path="settings/*" element={<SettingsPage user={me.data} />} />
          <Route path="documentation" element={<Documentation />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </React.StrictMode>,
);
