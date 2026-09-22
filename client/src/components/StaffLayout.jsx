import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth.js";
import { BRAND } from "../config.js";

// Clean SVG Icons for fast, zero-dependency, ultra-crisp rendering across all devices & POS
function Icon({ name, className = "w-5 h-5" }) {
  const icons = {
    dashboard: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    menu: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    tables: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    billing: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8h4" />
      </svg>
    ),
    customers: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    expenses: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    reports: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    kitchen: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
      </svg>
    ),
    waiterOrder: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    waiterOrders: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    logout: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
    menuBurger: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
    close: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    chevronLeft: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    ),
    chevronRight: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    ),
    fullscreen: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0 0l-5-5m-6 16H4m0 0v-4m0 4l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
    ),
    external: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    ),
    waiters: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  };

  return icons[name] || null;
}

// Navigation schema with semantic icons and category tags
const NAV_CONFIG = {
  ADMIN: [
    { to: "/admin", label: "Dashboard", icon: "dashboard", end: true, badge: "Main" },
    { to: "/admin/billing", label: "Billing / POS", icon: "billing", badge: "POS" },
    { to: "/admin/waiters", label: "Waiters Staff", icon: "waiters", badge: "Staff" },
    { to: "/admin/tables", label: "Tables & QR", icon: "tables" },
    { to: "/admin/menu", label: "Menu Items", icon: "menu" },
    { to: "/admin/customers", label: "Customers", icon: "customers" },
    { to: "/admin/expenses", label: "Daily Cost", icon: "expenses" },
    { to: "/admin/reports", label: "Reports", icon: "reports" },
    { to: "/kitchen", label: "Kitchen Live", icon: "kitchen", badge: "Live" },
  ],
  CASHIER: [
    { to: "/admin/billing", label: "Billing / POS", icon: "billing", badge: "POS" },
    { to: "/admin/customers", label: "Customers", icon: "customers" },
    { to: "/admin/reports", label: "Reports", icon: "reports" },
  ],
  KITCHEN: [
    { to: "/kitchen", label: "Kitchen Display (KDS)", icon: "kitchen", badge: "Live" },
  ],
  WAITER: [
    { to: "/waiter", label: "New Order", icon: "waiterOrder", end: true, badge: "Quick" },
    { to: "/waiter/orders", label: "My Orders", icon: "waiterOrders" },
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
  const location = useLocation();

  // Responsive state
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile drawer
  const [collapsed, setCollapsed] = useState(false); // Desktop & POS collapse mode
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  if (!user) return <Navigate to="/login" replace />;

  const links = NAV_CONFIG[user.role] || [];

  // Live time ticker for POS and staff terminals
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Fullscreen toggle for POS Terminals & Tablets
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Find active page title for the top header
  const currentLink = links.find((l) => (l.end ? location.pathname === l.to : location.pathname.startsWith(l.to)));
  const pageTitle = currentLink?.label || "Admin Console";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP RESPONSIVE HEADER BAR (Mobile, Tablet, Desktop & POS)   */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-3 sm:px-6 backdrop-blur-md transition-all">
        {/* Left Side: Brand & Toggle */}
        <div className="flex items-center gap-3">
          {/* Mobile & POS Hamburger Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition lg:hidden"
            aria-label="Toggle Mobile Menu"
            title="Menu"
          >
            <Icon name={sidebarOpen ? "close" : "menuBurger"} className="w-5 h-5" />
          </button>

          {/* Desktop & POS Sidebar Collapse Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-95 transition shadow-sm"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <Icon name={collapsed ? "chevronRight" : "chevronLeft"} className="w-4 h-4" />
          </button>

          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white font-black shadow-md shadow-brand/25">
              {BRAND.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="display font-bold text-base sm:text-lg tracking-tight text-slate-900">
                  {BRAND.name}
                </span>
                <span className="hidden sm:inline-block rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                  {user.role}
                </span>
              </div>
              <p className="hidden md:block text-[11px] text-slate-400 font-medium">
                {BRAND.tagline || "Restaurant Management ERP"}
              </p>
            </div>
          </div>

          {/* Current Section / Breadcrumb aligned to the SIDE */}
          <div className="hidden md:flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-100/80 px-3 py-1 text-xs font-semibold text-slate-700 ml-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{pageTitle}</span>
          </div>
        </div>

        {/* Right Side: POS Actions & User Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Clock for POS Terminals */}
          {currentTime && (
            <div className="hidden sm:flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-600">
              {currentTime}
            </div>
          )}

          {/* Fullscreen Button (Essential for POS / Tablet screens) */}
          <button
            onClick={toggleFullscreen}
            className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-95 transition shadow-sm"
            title="Toggle POS Fullscreen"
          >
            <Icon name="fullscreen" className="w-4 h-4" />
          </button>

          {/* Quick Link to Customer Menu */}
          <a
            href="/menu"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden xl:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-brand transition shadow-sm"
            title="Open Customer Live Menu"
          >
            <span>Customer View</span>
            <Icon name="external" className="w-3.5 h-3.5" />
          </a>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-slate-900 text-white font-semibold text-xs sm:text-sm shadow-sm">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="hidden lg:block text-left leading-tight">
                <p className="text-xs font-semibold text-slate-800">{user.name}</p>
                <p className="text-[10px] text-slate-400 font-medium capitalize">{user.role.toLowerCase()}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex h-8 sm:h-9 items-center justify-center gap-1.5 rounded-lg bg-rose-50 px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700 active:scale-95 transition"
              title="Logout"
            >
              <Icon name="logout" className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. BODY LAYOUT: RESPONSIVE SIDEBAR + FLUID MAIN CONTENT       */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-1 relative overflow-x-hidden">
        {/* Backdrop for Mobile Drawer */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ----------------------------------------------------------- */}
        {/* SIDEBAR NAVIGATION (Desktop, POS, and Mobile Drawer)        */}
        {/* ----------------------------------------------------------- */}
        <aside
          className={`
            fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#141013] text-white shadow-2xl transition-all duration-300 ease-in-out
            lg:top-16 lg:z-20 lg:shadow-none lg:border-r lg:border-slate-800/80
            ${sidebarOpen ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0"}
            ${collapsed ? "lg:w-20" : "lg:w-64"}
          `}
        >
          {/* Mobile Drawer Top Brand Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-4 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white font-bold text-sm">
                {BRAND.name.charAt(0)}
              </div>
              <div>
                <span className="display font-bold text-base text-white">{BRAND.name}</span>
                <span className="ml-2 rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold text-brand-light uppercase">
                  {user.role}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>

          {/* Sidebar Section Title (Desktop) */}
          <div className={`pt-4 pb-2 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 ${collapsed ? "lg:hidden" : ""}`}>
            Operations & Control
          </div>

          {/* Nav Links List */}
          <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
            {links.map((link) => {
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => `
                    group relative flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-150 select-none
                    ${collapsed ? "lg:justify-center lg:px-2" : ""}
                    ${
                      isActive
                        ? "bg-gradient-to-r from-brand to-brand-dark text-white shadow-lg shadow-brand/30 ring-1 ring-white/20"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }
                  `}
                  title={collapsed ? link.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      {/* Icon */}
                      <span className={`shrink-0 transition-transform duration-150 group-hover:scale-110 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`}>
                        <Icon name={link.icon} className="w-5 h-5" />
                      </span>

                      {/* Label */}
                      <span className={`truncate ${collapsed ? "lg:hidden" : "block"}`}>
                        {link.label}
                      </span>

                      {/* Badge if available */}
                      {link.badge && !collapsed && (
                        <span className={`ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          isActive ? "bg-white/25 text-white" : "bg-white/10 text-slate-300 group-hover:bg-white/20"
                        }`}>
                          {link.badge}
                        </span>
                      )}

                      {/* Active Indicator Strip on Left */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gold shadow-sm" />
                      )}

                      {/* Floating Tooltip for Collapsed Desktop Mode */}
                      {collapsed && (
                        <div className="absolute left-full ml-3 hidden rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-xl group-hover:lg:block whitespace-nowrap z-50 border border-slate-700 pointer-events-none">
                          {link.label}
                        </div>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* POS & Terminal Status Banner (Bottom of Sidebar) */}
          <div className="p-3 border-t border-white/10 bg-black/20">
            <div className={`rounded-xl bg-white/5 p-3 flex items-center gap-3 ${collapsed ? "lg:justify-center lg:p-2" : ""}`}>
              <div className="relative shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400">
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold">POS</span>
              </div>
              <div className={`overflow-hidden ${collapsed ? "lg:hidden" : "block"}`}>
                <p className="text-xs font-bold text-white truncate">System Ready</p>
                <p className="text-[11px] text-slate-400 truncate">Connected to Database</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ----------------------------------------------------------- */}
        {/* 3. MAIN CONTENT CONTAINER (Responsive for all models)       */}
        {/* ----------------------------------------------------------- */}
        <main
          className={`
            flex-1 transition-all duration-300 ease-in-out w-full
            ${collapsed ? "lg:ml-20" : "lg:ml-64"}
            p-3.5 sm:p-6 lg:p-8 max-w-full overflow-y-auto min-h-[calc(100vh-4rem)]
          `}
        >
          <div className="mx-auto max-w-7xl w-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. MOBILE / POS QUICK BOTTOM ACTION BAR (Touchscreens)         */}
      {/* ------------------------------------------------------------- */}
      <div className="sticky bottom-0 z-20 flex h-14 w-full items-center justify-around border-t border-slate-200 bg-white/95 px-2 py-1 backdrop-blur-md md:hidden shadow-lg">
        {links.slice(0, 4).map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `
              flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-bold transition
              ${isActive ? "text-brand" : "text-slate-500 hover:text-slate-800"}
            `}
          >
            <Icon name={link.icon} className="w-5 h-5 mb-0.5" />
            <span className="truncate max-w-[64px]">{link.label.split(" ")[0]}</span>
          </NavLink>
        ))}
        {/* Menu drawer button on bottom bar */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-bold text-slate-500 hover:text-slate-800"
        >
          <Icon name="menuBurger" className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </div>
    </div>
  );
}
