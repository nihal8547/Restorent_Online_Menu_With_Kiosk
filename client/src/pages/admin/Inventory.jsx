import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api, money } from "../../api.js";
import { Spinner, Empty, Toast } from "../../components/ui.jsx";
import {
  Boxes,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Plus,
  Minus,
  RotateCcw,
  Sliders,
  History,
  Grid,
  List,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Tag,
  Package,
} from "lucide-react";

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Filters and Views
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | OUT_OF_STOCK | LOW_STOCK | IN_STOCK | UNTRACKED
  const [viewMode, setViewMode] = useState("grid"); // grid | table

  // Modals
  const [adjustItem, setAdjustItem] = useState(null); // { item, change, reason, note }
  const [configItem, setConfigItem] = useState(null); // { item, lowStockAt, trackStock }
  const [historyItem, setHistoryItem] = useState(null); // { item, movements: [] }
  const [submitting, setSubmitting] = useState(false);

  // Fetch Inventory
  const load = useCallback(async () => {
    try {
      const inv = await api.get("/inventory");
      setItems(inv.data.items || []);
    } catch (e) {
      setToast(e.response?.data?.error || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = items.length;
    const tracked = items.filter((i) => i.trackStock).length;
    const outOfStock = items.filter((i) => i.out).length;
    const lowStock = items.filter((i) => i.low && !i.out).length;
    const inStock = items.filter((i) => i.trackStock && !i.low && !i.out).length;
    const untracked = items.filter((i) => !i.trackStock).length;
    return { total, tracked, outOfStock, lowStock, inStock, untracked };
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      // Category filter
      if (categoryFilter !== "ALL" && it.category !== categoryFilter) {
        return false;
      }
      // Status filter
      if (statusFilter === "OUT_OF_STOCK" && !it.out) return false;
      if (statusFilter === "LOW_STOCK" && (!it.low || it.out)) return false;
      if (statusFilter === "IN_STOCK" && (!it.trackStock || it.low || it.out)) return false;
      if (statusFilter === "UNTRACKED" && it.trackStock) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = it.name.toLowerCase().includes(q);
        const matchCat = (it.category || "").toLowerCase().includes(q);
        if (!matchName && !matchCat) return false;
      }
      return true;
    });
  }, [items, categoryFilter, statusFilter, search]);

  // One-click Toggle Status (In Stock vs Out of Stock)
  const toggleStockStatus = async (it) => {
    try {
      await api.put(`/inventory/${it.id}/toggle-status`);
      const nextStatus = it.out ? "In Stock (Available on Menu)" : "Out of Stock (Hidden from Menu)";
      setToast(`"${it.name}" marked as ${nextStatus} ✓`);
      load();
    } catch (e) {
      setToast(e.response?.data?.error || "Failed to update item status");
    }
  };

  // Toggle Tracking
  const toggleTracking = async (it) => {
    try {
      const willTrack = !it.trackStock;
      await api.put(`/inventory/${it.id}/config`, {
        trackStock: willTrack,
        stockQty: willTrack ? (it.stockQty || 10) : it.stockQty,
      });
      setToast(
        willTrack
          ? `Stock tracking enabled for "${it.name}"`
          : `Stock tracking disabled for "${it.name}"`
      );
      load();
    } catch (e) {
      setToast(e.message || "Failed to update tracking");
    }
  };

  // Save Stock Adjustment (Restock, Waste, Count)
  const handleSaveAdjust = async (e) => {
    e?.preventDefault();
    if (!adjustItem) return;
    const n = parseInt(adjustItem.change, 10);
    if (!n || isNaN(n)) {
      return setToast("Please enter a non-zero quantity change");
    }

    setSubmitting(true);
    try {
      await api.post(`/inventory/${adjustItem.item.id}/adjust`, {
        change: n,
        reason: adjustItem.reason || "RESTOCK",
        note: adjustItem.note || null,
      });
      setToast(`Stock updated for "${adjustItem.item.name}" ✓`);
      setAdjustItem(null);
      load();
    } catch (e) {
      setToast(e.response?.data?.error || e.message || "Failed to adjust stock");
    } finally {
      setSubmitting(false);
    }
  };

  // Save Item Threshold Configuration
  const handleSaveConfig = async (e) => {
    e?.preventDefault();
    if (!configItem) return;

    setSubmitting(true);
    try {
      await api.put(`/inventory/${configItem.item.id}/config`, {
        trackStock: configItem.trackStock,
        lowStockAt: Number(configItem.lowStockAt) || 5,
        stockQty: Number(configItem.stockQty) || 0,
      });
      setToast(`Settings saved for "${configItem.item.name}" ✓`);
      setConfigItem(null);
      load();
    } catch (e) {
      setToast(e.response?.data?.error || e.message || "Failed to save settings");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Movement History
  const openHistory = async (it) => {
    try {
      const res = await api.get(`/inventory/${it.id}/movements`);
      setHistoryItem({ item: it, movements: res.data.movements || [] });
    } catch (e) {
      setToast("Failed to fetch movement history");
    }
  };

  if (loading && items.length === 0) return <Spinner />;

  return (
    <div className="space-y-6 pb-12">
      <Toast message={toast} onClose={() => setToast("")} />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. HEADER & CONTROLS                                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Boxes className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Inventory & Stock Management
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time stock control synchronized automatically with customer menu, Kiosk, and Cashier POS.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle and Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
          </div>

          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition"
            title="Refresh Stock"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. KPI STATUS SUMMARY CARDS (Understandable Model)            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Menu Items */}
        <div
          onClick={() => setStatusFilter("ALL")}
          className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${
            statusFilter === "ALL"
              ? "border-slate-800 bg-slate-900 text-white"
              : "border-slate-200/80 bg-white text-slate-900"
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className={statusFilter === "ALL" ? "text-slate-300" : "text-slate-500"}>
              Total Menu Items
            </span>
            <Boxes className={`h-4 w-4 ${statusFilter === "ALL" ? "text-slate-300" : "text-slate-400"}`} />
          </div>
          <div className="mt-2 text-2xl font-black">{metrics.total}</div>
          <div
            className={`mt-1 text-[11px] ${
              statusFilter === "ALL" ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {metrics.tracked} tracked with inventory
          </div>
        </div>

        {/* Healthy In Stock */}
        <div
          onClick={() => setStatusFilter("IN_STOCK")}
          className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${
            statusFilter === "IN_STOCK"
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-200/80 bg-white text-slate-900"
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className={statusFilter === "IN_STOCK" ? "text-emerald-100" : "text-slate-500"}>
              Healthy In Stock
            </span>
            <CheckCircle2
              className={`h-4 w-4 ${
                statusFilter === "IN_STOCK" ? "text-emerald-200" : "text-emerald-600"
              }`}
            />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 group-hover:text-emerald-700">
            <span className={statusFilter === "IN_STOCK" ? "text-white" : "text-emerald-600"}>
              {metrics.inStock}
            </span>
          </div>
          <div
            className={`mt-1 text-[11px] ${
              statusFilter === "IN_STOCK" ? "text-emerald-100" : "text-slate-500"
            }`}
          >
            Above low threshold
          </div>
        </div>

        {/* Low Stock Warning */}
        <div
          onClick={() => setStatusFilter("LOW_STOCK")}
          className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${
            statusFilter === "LOW_STOCK"
              ? "border-amber-600 bg-amber-600 text-white"
              : "border-slate-200/80 bg-white text-slate-900"
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className={statusFilter === "LOW_STOCK" ? "text-amber-100" : "text-slate-500"}>
              Low Stock Alert
            </span>
            <AlertTriangle
              className={`h-4 w-4 ${
                statusFilter === "LOW_STOCK" ? "text-amber-200" : "text-amber-500"
              }`}
            />
          </div>
          <div className="mt-2 text-2xl font-black">
            <span className={statusFilter === "LOW_STOCK" ? "text-white" : "text-amber-600"}>
              {metrics.lowStock}
            </span>
          </div>
          <div
            className={`mt-1 text-[11px] ${
              statusFilter === "LOW_STOCK" ? "text-amber-100" : "text-slate-500"
            }`}
          >
            Needs restock soon
          </div>
        </div>

        {/* Out of Stock (Disabled on Menu) */}
        <div
          onClick={() => setStatusFilter("OUT_OF_STOCK")}
          className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${
            statusFilter === "OUT_OF_STOCK"
              ? "border-rose-600 bg-rose-600 text-white"
              : "border-slate-200/80 bg-white text-slate-900"
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className={statusFilter === "OUT_OF_STOCK" ? "text-rose-100" : "text-slate-500"}>
              Out of Stock
            </span>
            <XCircle
              className={`h-4 w-4 ${
                statusFilter === "OUT_OF_STOCK" ? "text-rose-200" : "text-rose-600"
              }`}
            />
          </div>
          <div className="mt-2 text-2xl font-black">
            <span className={statusFilter === "OUT_OF_STOCK" ? "text-white" : "text-rose-600"}>
              {metrics.outOfStock}
            </span>
          </div>
          <div
            className={`mt-1 text-[11px] font-semibold ${
              statusFilter === "OUT_OF_STOCK" ? "text-rose-100" : "text-rose-600"
            }`}
          >
            Hidden on customer menu
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. SEARCH & CATEGORY FILTER RAILS                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search item name or category..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-brand transition"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Quick Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: "ALL", label: "All Items" },
              { id: "OUT_OF_STOCK", label: `Out of Stock (${metrics.outOfStock})`, color: "text-rose-600" },
              { id: "LOW_STOCK", label: `Low Stock (${metrics.lowStock})`, color: "text-amber-600" },
              { id: "IN_STOCK", label: `In Stock (${metrics.inStock})`, color: "text-emerald-600" },
              { id: "UNTRACKED", label: `Always Available (${metrics.untracked})` },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition ${
                  statusFilter === st.id
                    ? "bg-brand text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span className={statusFilter === st.id ? "text-white" : st.color || ""}>
                  {st.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Category Pills Rail */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-slate-100">
          <button
            onClick={() => setCategoryFilter("ALL")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
              categoryFilter === "ALL"
                ? "bg-slate-900 text-white font-bold"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                categoryFilter === cat
                  ? "bg-slate-900 text-white font-bold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. ITEMS LISTING (GRID OR TABLE VIEW)                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {filteredItems.length === 0 ? (
        <Empty>No items found matching the selected search or filter criteria.</Empty>
      ) : viewMode === "grid" ? (
        /* ──── GRID CARDS VIEW ──── */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((it) => {
            const isOut = it.out;
            const isLow = it.low && !isOut;
            const isHealthy = it.trackStock && !isLow && !isOut;

            return (
              <div
                key={it.id}
                className={`rounded-2xl border p-4 bg-white shadow-sm flex flex-col justify-between transition hover:shadow-md ${
                  isOut
                    ? "border-rose-200 bg-rose-50/20"
                    : isLow
                    ? "border-amber-200 bg-amber-50/20"
                    : "border-slate-200/80"
                }`}
              >
                <div>
                  {/* Top Badges: Category & Stock Status */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 truncate">
                      {it.category}
                    </span>

                    {/* Stock Status Badge */}
                    {isOut ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                        Out of Stock
                      </span>
                    ) : isLow ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                        Low Stock ({it.stockQty} left)
                      </span>
                    ) : it.trackStock ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        In Stock ({it.stockQty})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        Always Available
                      </span>
                    )}
                  </div>

                  {/* Item Title & Price */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                      {it.name}
                    </h3>
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                      {money(it.price)}
                    </span>
                  </div>

                  {/* Stock Quantity Level Visual */}
                  {it.trackStock ? (
                    <div className="mt-3 bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Quantity on Hand</span>
                        <span
                          className={`text-lg font-black ${
                            isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-900"
                          }`}
                        >
                          {it.stockQty}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOut
                              ? "bg-rose-500"
                              : isLow
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(8, (it.stockQty / (it.lowStockAt * 3 || 30)) * 100))}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Threshold: {it.lowStockAt}</span>
                        <span>{it.available ? "Visible on menu" : "Hidden from menu"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 bg-slate-50/60 rounded-xl p-2.5 border border-dashed border-slate-200 text-center">
                      <span className="text-[11px] text-slate-500">
                        Stock limit untracked (Unlimited orders)
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Actions: Toggle Live Menu & Restock Controls */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  {/* One-click Live Menu Switch */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Menu Status:</span>
                    <button
                      onClick={() => toggleStockStatus(it)}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border transition ${
                        !it.out
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      }`}
                      title="Click to toggle availability on customer menu and POS"
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          !it.out ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      />
                      <span>{!it.out ? "Live (In Stock)" : "Out of Stock"}</span>
                    </button>
                  </div>

                  {/* Restock & Configuration Action Buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() =>
                        setAdjustItem({
                          item: it,
                          change: "10",
                          reason: "RESTOCK",
                          note: "",
                        })
                      }
                      className="flex-1 btn-primary !py-1.5 !text-xs font-bold shadow-xs active:scale-95 flex items-center justify-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Restock</span>
                    </button>

                    <button
                      onClick={() =>
                        setAdjustItem({
                          item: it,
                          change: "-1",
                          reason: "WASTE",
                          note: "",
                        })
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95"
                      title="Waste or Adjust Down"
                    >
                      <Minus className="h-3.5 w-3.5 text-rose-600" />
                    </button>

                    <button
                      onClick={() =>
                        setConfigItem({
                          item: it,
                          trackStock: it.trackStock,
                          lowStockAt: it.lowStockAt,
                          stockQty: it.stockQty,
                        })
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95"
                      title="Configure Threshold & Tracking"
                    >
                      <Sliders className="h-3.5 w-3.5 text-slate-500" />
                    </button>

                    <button
                      onClick={() => openHistory(it)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95"
                      title="View Movement History"
                    >
                      <History className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ──── TABLE VIEW ──── */
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[700px]">
              <thead className="bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Menu Item</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Tracking</th>
                  <th className="py-3 px-4 text-center">Stock On Hand</th>
                  <th className="py-3 px-4 text-center">Low Threshold</th>
                  <th className="py-3 px-4">Menu Status</th>
                  <th className="py-3 px-4 text-right">Quick Restock / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredItems.map((it) => {
                  const isOut = it.out;
                  const isLow = it.low && !isOut;

                  return (
                    <tr key={it.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {it.name}
                        <span className="block text-[11px] font-normal text-slate-400">
                          {money(it.price)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-semibold">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px]">
                          {it.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleTracking(it)}
                          className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                            it.trackStock
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {it.trackStock ? "Tracked" : "Untracked"}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {it.trackStock ? (
                          <span
                            className={`text-sm font-black ${
                              isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-900"
                            }`}
                          >
                            {it.stockQty}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500 font-semibold">
                        {it.trackStock ? it.lowStockAt : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleStockStatus(it)}
                          className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border transition ${
                            !it.out
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              !it.out ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          <span>{!it.out ? "In Stock (Live)" : "Out of Stock"}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() =>
                              setAdjustItem({
                                item: it,
                                change: "10",
                                reason: "RESTOCK",
                                note: "",
                              })
                            }
                            className="btn-primary !py-1 !px-2.5 !text-xs font-bold"
                          >
                            + Restock
                          </button>
                          <button
                            onClick={() =>
                              setAdjustItem({
                                item: it,
                                change: "-1",
                                reason: "WASTE",
                                note: "",
                              })
                            }
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                            title="Waste / Adjust"
                          >
                            − Waste
                          </button>
                          <button
                            onClick={() =>
                              setConfigItem({
                                item: it,
                                trackStock: it.trackStock,
                                lowStockAt: it.lowStockAt,
                                stockQty: it.stockQty,
                              })
                            }
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            title="Configure"
                          >
                            ⚙
                          </button>
                          <button
                            onClick={() => openHistory(it)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            title="History"
                          >
                            🕒
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. RESTOCK / ADJUST MODAL                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {adjustItem.reason === "RESTOCK" ? "Restock Inventory" : "Adjust / Record Waste"}
                </h3>
                <p className="text-xs text-slate-500">{adjustItem.item.name}</p>
              </div>
              <button
                onClick={() => setAdjustItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="p-5 space-y-4">
              {/* Current Stock Banner */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs">
                <span className="text-slate-600">Current Stock on Hand:</span>
                <span className="text-base font-black text-slate-900">
                  {adjustItem.item.stockQty} units
                </span>
              </div>

              {/* Quick Preset Buttons for Restock */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Quick Quantity Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[5, 10, 20, 50, 100].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() =>
                        setAdjustItem({
                          ...adjustItem,
                          change: adjustItem.reason === "WASTE" ? `-${qty}` : `${qty}`,
                        })
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-brand hover:text-brand"
                    >
                      {adjustItem.reason === "WASTE" ? `-${qty}` : `+${qty}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity Change {adjustItem.reason === "RESTOCK" ? "(to add +)" : "(use − to deduct)"} *
                </label>
                <input
                  type="number"
                  required
                  placeholder={adjustItem.reason === "RESTOCK" ? "e.g. 25" : "e.g. -5"}
                  value={adjustItem.change}
                  onChange={(e) => setAdjustItem({ ...adjustItem, change: e.target.value })}
                  className="input !py-2 text-base font-bold text-brand"
                />
              </div>

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Adjustment Reason</label>
                <select
                  value={adjustItem.reason}
                  onChange={(e) => setAdjustItem({ ...adjustItem, reason: e.target.value })}
                  className="input !py-2 text-xs font-semibold cursor-pointer"
                >
                  <option value="RESTOCK">Restock (Received new batch from supplier)</option>
                  <option value="ADJUST">Inventory Count Correction (Physical count adjustment)</option>
                  <option value="WASTE">Wastage / Spoilage / Expired / Damaged</option>
                </select>
              </div>

              {/* Note / Supplier */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reference Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Invoice #9021, Al-Quds Foods"
                  value={adjustItem.note}
                  onChange={(e) => setAdjustItem({ ...adjustItem, note: e.target.value })}
                  className="input !py-2 text-xs"
                />
              </div>

              {/* Result Preview */}
              {adjustItem.change && !isNaN(parseInt(adjustItem.change, 10)) && (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50/70 p-3 text-xs border border-emerald-100">
                  <span className="font-semibold text-emerald-800">Resulting Stock Balance:</span>
                  <span className="font-bold text-emerald-900 text-sm">
                    {Math.max(0, adjustItem.item.stockQty + parseInt(adjustItem.change, 10))} units
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustItem(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary !py-2 !px-5 !text-xs font-bold shadow-md shadow-brand/20 active:scale-95"
                >
                  {submitting ? "Saving..." : "Confirm & Update Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. CONFIGURE ITEM THRESHOLD MODAL                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {configItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Inventory Settings</h3>
                <p className="text-xs text-slate-500">{configItem.item.name}</p>
              </div>
              <button
                onClick={() => setConfigItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-5 space-y-4">
              {/* Track Stock Toggle */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 border border-slate-200/80">
                <div>
                  <div className="text-xs font-bold text-slate-800">Track Inventory Quantity</div>
                  <div className="text-[11px] text-slate-500">
                    Enforce stock deduction upon customer orders.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={configItem.trackStock}
                  onChange={(e) => setConfigItem({ ...configItem, trackStock: e.target.checked })}
                  className="h-5 w-5 rounded border-slate-300 text-brand focus:ring-brand cursor-pointer"
                />
              </div>

              {/* Direct Stock Quantity */}
              {configItem.trackStock && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Current Stock Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={configItem.stockQty}
                      onChange={(e) => setConfigItem({ ...configItem, stockQty: e.target.value })}
                      className="input !py-2 text-sm font-bold text-slate-900"
                    />
                  </div>

                  {/* Low Stock Alert Threshold */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Low-Stock Alert Threshold
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={configItem.lowStockAt}
                      onChange={(e) => setConfigItem({ ...configItem, lowStockAt: e.target.value })}
                      className="input !py-2 text-sm"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Show warning when quantity drops to or below this count.
                    </p>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfigItem(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary !py-2 !px-5 !text-xs font-bold shadow-md shadow-brand/20 active:scale-95"
                >
                  {submitting ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 7. STOCK MOVEMENT HISTORY MODAL                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {historyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Stock Movement Audit Log</h3>
                <p className="text-xs text-slate-500">{historyItem.item.name}</p>
              </div>
              <button
                onClick={() => setHistoryItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="p-5 max-h-[420px] overflow-y-auto space-y-3">
              {historyItem.movements.length === 0 ? (
                <Empty>No movement history logged for this item yet.</Empty>
              ) : (
                <div className="divide-y divide-slate-100">
                  {historyItem.movements.map((m) => (
                    <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              m.reason === "RESTOCK"
                                ? "bg-emerald-100 text-emerald-800"
                                : m.reason === "SALE"
                                ? "bg-blue-100 text-blue-800"
                                : m.reason === "WASTE"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {m.reason}
                          </span>
                          <span>{m.note || "Inventory change"}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`font-black text-sm ${
                            m.change > 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {m.change > 0 ? `+${m.change}` : m.change}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Balance: {m.balance}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end p-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setHistoryItem(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
