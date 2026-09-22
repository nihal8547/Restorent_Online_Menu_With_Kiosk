import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useSettings } from "./store/settings.js";

import StaffLayout, { RequireRole } from "./components/StaffLayout.jsx";

// Customer (public)
import Menu from "./pages/customer/Menu.jsx";
import Checkout from "./pages/customer/Checkout.jsx";
import BillView from "./pages/customer/BillView.jsx";
import OrderSlip from "./pages/customer/OrderSlip.jsx";
import History from "./pages/customer/History.jsx";
import Landing from "./pages/customer/Landing.jsx";

// Staff
import Login from "./pages/Login.jsx";
import Kitchen from "./pages/kitchen/Kitchen.jsx";
import WaiterOrder from "./pages/waiter/WaiterOrder.jsx";
import WaiterOrders from "./pages/waiter/WaiterOrders.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import AdminMenu from "./pages/admin/AdminMenu.jsx";
import Tables from "./pages/admin/Tables.jsx";
import Billing from "./pages/admin/Billing.jsx";
import Customers from "./pages/admin/Customers.jsx";
import Expenses from "./pages/admin/Expenses.jsx";
import Reports from "./pages/admin/Reports.jsx";
import Waiters from "./pages/admin/Waiters.jsx";
import Inventory from "./pages/admin/Inventory.jsx";
import Accounting from "./pages/admin/Accounting.jsx";
import AdminSettings from "./pages/admin/AdminSettings.jsx";

export default function App() {
  const fetchSettings = useSettings(s => s.fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <Routes>
      {/* Public / customer */}
      <Route path="/" element={<Landing />} />
      <Route path="/menu" element={<Menu />} />
      <Route path="/t/:qrToken" element={<Menu />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/order/:orderToken" element={<BillView />} />
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

      {/* Waiter */}
      <Route
        element={
          <RequireRole roles={["WAITER", "ADMIN"]}>
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
        <Route path="/admin/accounting" element={<Accounting />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
