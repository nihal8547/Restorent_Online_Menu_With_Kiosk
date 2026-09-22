import React, { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useSettings } from "./store/settings.js";
import StaffLayout, { RequireRole } from "./components/StaffLayout.jsx";

// Route-based code splitting: each page is its own chunk, so the customer app
// never downloads admin/kitchen code (and vice versa). This is the single
// biggest reduction in first-load JS.

// Customer (public)
const Landing = lazy(() => import("./pages/customer/Landing.jsx"));
const Menu = lazy(() => import("./pages/customer/Menu.jsx"));
const Checkout = lazy(() => import("./pages/customer/Checkout.jsx"));
const BillView = lazy(() => import("./pages/customer/BillView.jsx"));
const OrderSlip = lazy(() => import("./pages/customer/OrderSlip.jsx"));
const History = lazy(() => import("./pages/customer/History.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));

// Staff (loaded only when a staff route is opened)
const Kitchen = lazy(() => import("./pages/kitchen/Kitchen.jsx"));
const WaiterOrder = lazy(() => import("./pages/waiter/WaiterOrder.jsx"));
const WaiterOrders = lazy(() => import("./pages/waiter/WaiterOrders.jsx"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard.jsx"));
const AdminMenu = lazy(() => import("./pages/admin/AdminMenu.jsx"));
const Tables = lazy(() => import("./pages/admin/Tables.jsx"));
const Billing = lazy(() => import("./pages/admin/Billing.jsx"));
const Customers = lazy(() => import("./pages/admin/Customers.jsx"));
const Expenses = lazy(() => import("./pages/admin/Expenses.jsx"));
const Reports = lazy(() => import("./pages/admin/Reports.jsx"));
const Waiters = lazy(() => import("./pages/admin/Waiters.jsx"));
const Inventory = lazy(() => import("./pages/admin/Inventory.jsx"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings.jsx"));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
    </div>
  );
}

export default function App() {
  const fetchSettings = useSettings((s) => s.fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public / customer */}
        <Route path="/" element={<Landing />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/t/:qrToken" element={<Menu />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order/:orderToken" element={<BillView />} />
        <Route path="/bill/:orderToken" element={<BillView />} />
        <Route path="/order-slip/:orderToken" element={<OrderSlip />} />
        <Route path="/history" element={<History />} />
        <Route path="/login" element={<Login />} />

        {/* Kitchen */}
        <Route
          element={
            <RequireRole roles={["KITCHEN", "ADMIN"]}>
              <StaffLayout />
            </RequireRole>
          }
        >
          <Route path="/kitchen" element={<Kitchen />} />
        </Route>

        {/* Waiter & Order Entry */}
        <Route
          element={
            <RequireRole roles={["WAITER", "ADMIN", "CASHIER"]}>
              <StaffLayout />
            </RequireRole>
          }
        >
          <Route path="/waiter" element={<WaiterOrder />} />
          <Route path="/waiter/orders" element={<WaiterOrders />} />
        </Route>

        {/* Admin + Cashier */}
        <Route
          element={
            <RequireRole roles={["ADMIN", "CASHIER"]}>
              <StaffLayout />
            </RequireRole>
          }
        >
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/menu" element={<AdminMenu />} />
          <Route path="/admin/tables" element={<Tables />} />
          <Route path="/admin/billing" element={<Billing />} />
          <Route path="/admin/customers" element={<Customers />} />
          <Route path="/admin/expenses" element={<Expenses />} />
          <Route path="/admin/reports" element={<Reports />} />
          <Route path="/admin/waiters" element={<Waiters />} />
          <Route path="/admin/inventory" element={<Inventory />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
