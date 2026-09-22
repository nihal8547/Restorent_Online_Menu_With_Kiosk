import React from "react";
import { NavLink, Outlet, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../store/auth.js";
import { BRAND } from "../config.js";

// Which nav links each role sees.
const NAV = {
  ADMIN: [
    { to: "/admin", label: "Dashboard", end: true },
    { to: "/admin/menu", label: "Menu" },
    { to: "/admin/tables", label: "Tables & QR" },
    { to: "/admin/billing", label: "Billing" },
    { to: "/admin/customers", label: "Customers" },
    { to: "/admin/expenses", label: "Daily Cost" },
    { to: "/admin/reports", label: "Reports" },
    { to: "/kitchen", label: "Kitchen" },
  ],
  CASHIER: [
    { to: "/admin/billing", label: "Billing" },
    { to: "/admin/customers", label: "Customers" },
    { to: "/admin/reports", label: "Reports" },
  ],
  KITCHEN: [{ to: "/kitchen", label: "Kitchen" }],
  WAITER: [
    { to: "/waiter", label: "New Order", end: true },
    { to: "/waiter/orders", label: "My Orders" },
  ],
};

export function RequireRole({ roles, children }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
}

export default function StaffLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return <Navigate to="/login" replace />;

  const links = NAV[user.role] || [];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <span className="display shrink-0 text-base font-semibold text-brand sm:text-lg">
            {BRAND.name}
          </span>
          <nav className="no-scrollbar flex flex-1 flex-nowrap gap-1 overflow-x-auto">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isActive ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-100"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <span className="hidden text-gray-500 lg:inline">
              {user.name} · {user.role}
            </span>
            <button
              className="btn-outline btn-sm"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
