import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api, money } from "../../api.js";
import { Spinner, Empty, StatusBadge, TypeBadge, Toast } from "../../components/ui.jsx";
import {
  Calendar,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  UtensilsCrossed,
  CreditCard,
  Clock,
  ArrowUpRight,
  FileText,
  Search,
  RefreshCw,
  Layers,
  PieChart,
  BarChart3,
  Award,
  Receipt,
  HelpCircle,
} from "lucide-react";

export default function Reports() {
  const getTodayStr = () => new Date().toISOString().slice(0, 10);
  const getPastDateStr = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };
  const getMonthStartStr = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  };
  const getLastMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    return { from: firstDay, to: lastDay };
  };

  const [preset, setPreset] = useState("LAST_7_DAYS");
  const [from, setFrom] = useState(getPastDateStr(6));
  const [to, setTo] = useState(getTodayStr());
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState("overview");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [toast, setToast] = useState(null);

  // Search queries for inner tables
  const [itemSearch, setItemSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL");

  // Handle Preset selection
  const applyPreset = (key) => {
    setPreset(key);
    const today = getTodayStr();
    if (key === "TODAY") {
      setFrom(today);
      setTo(today);
    } else if (key === "YESTERDAY") {
      const y = getPastDateStr(1);
      setFrom(y);
      setTo(y);
    } else if (key === "LAST_7_DAYS") {
      setFrom(getPastDateStr(6));
      setTo(today);
    } else if (key === "THIS_MONTH") {
      setFrom(getMonthStartStr());
      setTo(today);
    } else if (key === "LAST_MONTH") {
      const { from: lmFrom, to: lmTo } = getLastMonthRange();
      setFrom(lmFrom);
      setTo(lmTo);
    }
  };

  // Fetch report data
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/reports/advanced", {
        params: {
          from,
          to,
          type: typeFilter,
          source: sourceFilter,
        },
      });
      setData(res.data);
    } catch (err) {
      setToast(err.response?.data?.error || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [from, to, typeFilter, sourceFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // CSV Export Trigger
  const handleExportCSV = async (endpoint, filename) => {
    try {
      setToast("Preparing CSV export...");
      const res = await api.get(`/reports/export/${endpoint}`, {
        params: { from, to },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setToast("Export downloaded successfully!");
    } catch (err) {
      setToast("Failed to download CSV: " + (err.message || "Unknown error"));
    }
  };

  // Trigger Print Mode
  const handlePrintReport = () => {
    document.body.classList.add("printing-report");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("printing-report");
    }, 1000);
  };

  // Filtered Items for Tab 2
  const filteredItems = useMemo(() => {
    if (!data?.topItems) return [];
    if (!itemSearch.trim()) return data.topItems;
    const q = itemSearch.toLowerCase();
    return data.topItems.filter(
      (it) => it.name.toLowerCase().includes(q) || (it.category && it.category.toLowerCase().includes(q))
    );
  }, [data?.topItems, itemSearch]);

  // Filtered Orders for Tab 5
  const filteredOrders = useMemo(() => {
    if (!data?.orders) return [];
    let list = data.orders;
    if (orderStatusFilter !== "ALL") {
      list = list.filter((o) => (orderStatusFilter === "PAID" ? o.paymentStatus === "PAID" : o.status === orderStatusFilter));
    }
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNo.toLowerCase().includes(q) ||
          (o.invoiceNo && o.invoiceNo.toLowerCase().includes(q)) ||
          (o.customerPhone && o.customerPhone.includes(q)) ||
          (o.placedBy && o.placedBy.toLowerCase().includes(q)) ||
          (o.itemsSummary && o.itemsSummary.toLowerCase().includes(q))
      );
    }
    return list;
  }, [data?.orders, orderStatusFilter, orderSearch]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <Spinner />
        <p className="mt-3 text-sm font-medium text-slate-500">Generating analytics report...</p>
      </div>
    );
  }

  const summary = data?.summary || {
    grossSales: 0,
    totalDiscount: 0,
    totalTax: 0,
    netSales: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
    totalOrders: 0,
    paidOrders: 0,
    cancelledOrders: 0,
    pendingOrders: 0,
    avgOrderValue: 0,
    totalItemsSold: 0,
  };

  const maxTimelineSales = Math.max(1, ...(data?.timeline || []).map((t) => Math.max(t.sales, t.expenses)));
  const maxHourlyCount = Math.max(1, ...(data?.hourly || []).map((h) => h.count));
  const peakHour = (data?.hourly || []).reduce(
    (max, cur) => (cur.sales > max.sales ? cur : max),
    { hour: 0, label: "None", sales: 0, count: 0 }
  );

  return (
    <div className="space-y-6 pb-12">
      <Toast message={toast} onClose={() => setToast(null)} />

      {/* ─── HEADER & DATE RANGE FILTER BAR ─── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <BarChart3 className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Advanced Analytics & Reports
                </h1>
                <p className="text-xs text-slate-500">
                  Real-time sales, profitability, product engineering, and operations intelligence.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchReport}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-brand" : "text-slate-500"}`} />
              Refresh
            </button>

            <button
              onClick={handlePrintReport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" />
              Print Report
            </button>

            {/* Export Dropdown Group */}
            <div className="relative inline-flex rounded-xl bg-slate-900 p-0.5 text-white shadow-sm">
              <button
                onClick={() => handleExportCSV("orders.csv", `orders_${from}_${to}.csv`)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5 text-emerald-400" />
                Export Orders CSV
              </button>
              <button
                onClick={() => handleExportCSV("items.csv", `items_${from}_${to}.csv`)}
                title="Export Itemized Sales CSV"
                className="border-l border-slate-700 px-2 py-1.5 text-xs hover:bg-slate-800"
              >
                Items
              </button>
              <button
                onClick={() => handleExportCSV("summary.csv", `summary_${from}_${to}.csv`)}
                title="Export Daily Financial Summary CSV"
                className="border-l border-slate-700 px-2 py-1.5 text-xs hover:bg-slate-800"
              >
                Summary
              </button>
            </div>
          </div>
        </div>

        {/* Date Presets and Custom Inputs */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "TODAY", label: "Today" },
              { id: "YESTERDAY", label: "Yesterday" },
              { id: "LAST_7_DAYS", label: "Last 7 Days" },
              { id: "THIS_MONTH", label: "This Month" },
              { id: "LAST_MONTH", label: "Last Month" },
              { id: "CUSTOM", label: "Custom Range" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  preset === p.id
                    ? "bg-brand text-white shadow-sm font-semibold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Picker Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>From:</span>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setPreset("CUSTOM");
                  setFrom(e.target.value);
                }}
                className="border-none bg-transparent p-0 text-xs font-semibold text-slate-900 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>To:</span>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setPreset("CUSTOM");
                  setTo(e.target.value);
                }}
                className="border-none bg-transparent p-0 text-xs font-semibold text-slate-900 focus:outline-none"
              />
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Order Types</option>
              <option value="DINE_IN">Dine-In</option>
              <option value="TAKEAWAY">Takeaway</option>
              <option value="DELIVERY">Delivery</option>
            </select>

            {/* Source Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Channels</option>
              <option value="IN_HOUSE">In-House POS / QR</option>
              <option value="TALABAT">Talabat</option>
              <option value="SNOONU">Snoonu</option>
              <option value="KEETA">Keeta</option>
              <option value="RAFEEQ">Rafeeq</option>
              <option value="DELIVEROO">Deliveroo</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── TOP EXECUTIVE KPI RIBBON ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Net Revenue */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Net Sales</span>
            <span className="rounded-md bg-emerald-50 p-1 text-emerald-600">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-slate-900">{money(summary.netSales)}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <span>Avg ticket:</span>
            <span className="font-semibold text-slate-700">{money(summary.avgOrderValue)}</span>
          </div>
        </div>

        {/* Net Profit & Margin */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Net Profit</span>
            <span
              className={`rounded-md p-1 ${
                summary.netProfit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              }`}
            >
              {summary.netProfit >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
            </span>
          </div>
          <div
            className={`mt-2 text-xl font-bold tracking-tight ${
              summary.netProfit >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {money(summary.netProfit)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <span className="rounded bg-slate-100 px-1 font-semibold text-slate-700">
              {summary.profitMargin}%
            </span>
            <span>net margin</span>
          </div>
        </div>

        {/* Expenses */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Expenses</span>
            <span className="rounded-md bg-rose-50 p-1 text-rose-600">
              <DollarSign className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-slate-900">
            {money(summary.totalExpenses)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            <span>
              {summary.netSales > 0
                ? `${((summary.totalExpenses / summary.netSales) * 100).toFixed(1)}% of sales`
                : "No sales"}
            </span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Orders</span>
            <span className="rounded-md bg-blue-50 p-1 text-blue-600">
              <ShoppingBag className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-slate-900">{summary.totalOrders}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
            <span className="text-emerald-600 font-semibold">{summary.paidOrders} paid</span>
            {summary.cancelledOrders > 0 && (
              <span className="text-red-500">({summary.cancelledOrders} void)</span>
            )}
          </div>
        </div>

        {/* Items Sold */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Items Sold</span>
            <span className="rounded-md bg-amber-50 p-1 text-amber-600">
              <UtensilsCrossed className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-slate-900">
            {summary.totalItemsSold}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            <span>Across paid checks</span>
          </div>
        </div>

        {/* Discounts & Tax */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Discounts / Tax</span>
            <span className="rounded-md bg-purple-50 p-1 text-purple-600">
              <Receipt className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-base font-bold tracking-tight text-slate-800">
            -{money(summary.totalDiscount)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            <span>Tax: +{money(summary.totalTax)}</span>
          </div>
        </div>
      </div>

      {/* ─── NAVIGATION SUB-TABS ─── */}
      <div className="flex border-b border-slate-200 bg-white px-2 rounded-t-xl overflow-x-auto no-scrollbar">
        {[
          { id: "overview", label: "Overview & Trends", icon: BarChart3 },
          { id: "menu", label: "Menu & Categories", icon: UtensilsCrossed },
          { id: "staff", label: "Staff & Operations", icon: Users },
          { id: "financials", label: "Financials & Expenses", icon: DollarSign },
          { id: "orders", label: `Order Audit Log (${data?.orders?.length || 0})`, icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-xs font-semibold transition whitespace-nowrap ${
                isActive
                  ? "border-brand text-brand"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-brand" : "text-slate-400"}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: OVERVIEW & TRENDS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Daily Sales vs Expenses Trend Chart */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Daily Revenue & Expenses Trend</h3>
                <p className="text-xs text-slate-500">Comparing day-to-day sales against daily overheads.</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-brand" />
                  <span className="text-slate-600">Sales</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-rose-400" />
                  <span className="text-slate-600">Expenses</span>
                </div>
              </div>
            </div>

            {(!data?.timeline || data.timeline.length === 0) ? (
              <Empty>No timeline data in selected range.</Empty>
            ) : (
              <div className="relative pt-6">
                <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ minHeight: 180 }}>
                  {data.timeline.map((d) => {
                    const salesHeight = Math.max(4, (d.sales / maxTimelineSales) * 130);
                    const expHeight = Math.max(4, (d.expenses / maxTimelineSales) * 130);
                    return (
                      <div
                        key={d.date}
                        className="group flex flex-1 min-w-[38px] flex-col items-center justify-end"
                      >
                        {/* Hover Tooltip Value */}
                        <div className="mb-1 text-center text-[10px] text-slate-400 group-hover:text-slate-900 font-semibold transition">
                          {money(d.sales)}
                        </div>

                        {/* Side-by-side or stacked bars */}
                        <div className="flex items-end gap-1 w-full justify-center">
                          <div
                            className="w-3 sm:w-4 rounded-t-md bg-brand transition-all hover:brightness-110"
                            style={{ height: `${salesHeight}px` }}
                            title={`Date: ${d.date}\nSales: ${money(d.sales)}\nOrders: ${d.orders}`}
                          />
                          {d.expenses > 0 && (
                            <div
                              className="w-2.5 sm:w-3 rounded-t-md bg-rose-400 transition-all hover:brightness-110"
                              style={{ height: `${expHeight}px` }}
                              title={`Expenses: ${money(d.expenses)}`}
                            />
                          )}
                        </div>

                        <span className="mt-2 text-[10px] text-slate-400 group-hover:text-slate-700 whitespace-nowrap">
                          {d.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Grid: 24-hr Hourly Rush Heatmap & Channels / Tender Breakdown */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* 24-Hour Peak Hours Distribution (8 Cols) */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Peak Rush Hours (00:00 - 23:00)</h3>
                  <p className="text-xs text-slate-500">
                    Order volume across time of day to optimize kitchen and front-of-house staff.
                  </p>
                </div>
                {peakHour.sales > 0 && (
                  <div className="rounded-xl bg-amber-50 px-3 py-1.5 text-right border border-amber-200/50">
                    <span className="text-[10px] text-amber-700 uppercase tracking-wider font-bold block">
                      Peak Rush Hour
                    </span>
                    <span className="text-xs font-bold text-amber-900">
                      {peakHour.label} ({money(peakHour.sales)})
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-end gap-1.5 pt-4 overflow-x-auto" style={{ minHeight: 140 }}>
                {data?.hourly?.map((h) => {
                  const barHeight = Math.max(3, (h.count / maxHourlyCount) * 90);
                  const isPeak = h.hour === peakHour.hour && peakHour.sales > 0;
                  return (
                    <div
                      key={h.hour}
                      className="group flex flex-1 min-w-[24px] flex-col items-center justify-end"
                    >
                      <div
                        className={`w-full rounded-t-sm transition-all ${
                          isPeak ? "bg-amber-500 ring-2 ring-amber-300" : h.count > 0 ? "bg-slate-700 hover:bg-brand" : "bg-slate-100"
                        }`}
                        style={{ height: `${barHeight}px` }}
                        title={`${h.label}: ${h.count} orders (${money(h.sales)})`}
                      />
                      <span className="mt-1 text-[9px] text-slate-400 rotate-[-45deg] origin-top-left group-hover:text-slate-900">
                        {h.hour % 2 === 0 ? h.label.replace(" ", "") : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Methods Breakdown (4 Cols) */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-4">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Tender / Payment Modes</h3>
              <p className="text-xs text-slate-500 mb-4">Cash, Card, & Online breakdown.</p>

              {(!data?.byPaymentMode || data.byPaymentMode.length === 0) ? (
                <Empty>No payment records in range.</Empty>
              ) : (
                <div className="space-y-3.5">
                  {data.byPaymentMode.map((pm) => (
                    <div key={pm.mode} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                          {pm.mode}
                        </span>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">{money(pm.amount)}</span>
                          <span className="ml-1.5 text-slate-400">({pm.percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            pm.mode === "CASH"
                              ? "bg-emerald-500"
                              : pm.mode === "CARD"
                              ? "bg-brand"
                              : "bg-purple-500"
                          }`}
                          style={{ width: `${pm.percentage}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 text-right">{pm.count} transactions</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row: Order Types (Dine-in/Takeaway/Delivery) & Order Sources (Aggregators) */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sales by Type */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Sales by Order Type</h3>
              <p className="text-xs text-slate-500 mb-4">Dine-In, Takeaway, and Direct Delivery split.</p>

              <div className="grid grid-cols-3 gap-3">
                {data?.byType?.map((t) => (
                  <div key={t.type} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                    <div className="text-xs font-semibold text-slate-600">
                      {t.type === "DINE_IN" ? "Dine-In" : t.type === "TAKEAWAY" ? "Takeaway" : "Delivery"}
                    </div>
                    <div className="mt-1 text-base font-bold text-slate-900">{money(t.sales)}</div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{t.count} orders</span>
                      <span className="font-semibold text-brand">{t.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sales by Channel / Platform */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Sales Channels & Delivery Partners</h3>
              <p className="text-xs text-slate-500 mb-4">
                In-House POS / QR vs External aggregators (Talabat, Snoonu, Keeta, etc).
              </p>

              {(!data?.bySource || data.bySource.length === 0) ? (
                <Empty>No channel sales records.</Empty>
              ) : (
                <div className="space-y-3">
                  {data.bySource.map((s) => (
                    <div key={s.source} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-brand" />
                        <span className="font-semibold text-slate-800">
                          {s.source === "IN_HOUSE" ? "In-House (POS / QR)" : s.source}
                        </span>
                        <span className="text-[11px] text-slate-400">({s.count} orders)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">{money(s.sales)}</span>
                        <span className="w-12 text-right text-[11px] font-semibold text-slate-500">
                          {s.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: MENU & CATEGORY PERFORMANCE
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "menu" && (
        <div className="space-y-6">
          {/* Category Share Breakdown */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Category Revenue Contribution</h3>
            <p className="text-xs text-slate-500 mb-4">
              Revenue and units sold partitioned by menu categories.
            </p>

            {(!data?.byCategory || data.byCategory.length === 0) ? (
              <Empty>No category data found.</Empty>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.byCategory.map((cat, idx) => (
                  <div key={cat.name} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 truncate pr-2">{cat.name}</span>
                      <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                        {cat.percentage}%
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-base font-bold text-slate-900">{money(cat.revenue)}</span>
                      <span className="text-xs text-slate-500">{cat.qty} units sold</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${Math.min(100, cat.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Best Sellers Leaderboard */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-amber-500" />
                  Top Best Sellers & Menu Engineering
                </h3>
                <p className="text-xs text-slate-500">
                  Top performing items ranked by total revenue generated.
                </p>
              </div>

              {/* Search input for items */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item or category..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-1.5 pl-8 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <Empty>No menu items matching search in this period.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-left font-semibold text-slate-500">
                      <th className="py-2.5 pl-2 w-10">#</th>
                      <th className="py-2.5">Item Name</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5 text-right">Avg Unit Price</th>
                      <th className="py-2.5 text-right">Sold Qty</th>
                      <th className="py-2.5 text-right pr-2">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((item, idx) => (
                      <tr key={item.name} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 pl-2 font-medium text-slate-400">
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                        </td>
                        <td className="py-2.5 font-bold text-slate-800">{item.name}</td>
                        <td className="py-2.5 text-slate-500">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px]">
                            {item.category || "General"}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-slate-600 font-medium">
                          {money(item.avgPrice)}
                        </td>
                        <td className="py-2.5 text-right font-semibold text-slate-900">{item.qty}</td>
                        <td className="py-2.5 text-right pr-2 font-bold text-brand">
                          {money(item.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: STAFF & OPERATIONS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "staff" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Waiter Leaderboard */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Waiter Service Leaderboard</h3>
              <p className="text-xs text-slate-500 mb-4">
                Orders created and total sales generated per waiter.
              </p>

              {(!data?.staff?.waiters || data.staff.waiters.length === 0) ? (
                <Empty>No waiter activity logged in this period.</Empty>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.staff.waiters.map((w, idx) => (
                    <div key={w.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-800 text-xs">{w.name}</div>
                          <div className="text-[11px] text-slate-400">{w.count} orders taken</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900 text-xs">{money(w.sales)}</div>
                        <div className="text-[11px] text-slate-500">Avg {money(w.avgTicket)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cashier Collections */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Cashier Collections Register</h3>
              <p className="text-xs text-slate-500 mb-4">
                Payments collected per cashier split by Cash and Card.
              </p>

              {(!data?.staff?.cashiers || data.staff.cashiers.length === 0) ? (
                <Empty>No cashier collection records in range.</Empty>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.staff.cashiers.map((c) => (
                    <div key={c.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 text-xs">{c.name}</span>
                          <span className="ml-2 text-[11px] text-slate-400">({c.count} collections)</span>
                        </div>
                        <span className="font-bold text-slate-900 text-xs">{money(c.total)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                        <span>Cash: <strong className="text-emerald-700">{money(c.cash)}</strong></span>
                        <span>Card: <strong className="text-brand">{money(c.card)}</strong></span>
                        {c.online > 0 && <span>Online: {money(c.online)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table Turnover & Performance */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Table Turnover & Productivity</h3>
            <p className="text-xs text-slate-500 mb-4">
              Number of checks billed and total revenue per dining table.
            </p>

            {(!data?.tables || data.tables.length === 0) ? (
              <Empty>No dine-in table orders logged in this range.</Empty>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {data.tables.map((t) => (
                  <div key={t.table} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <div className="text-xs font-bold text-slate-800">{t.table}</div>
                    <div className="mt-1 text-base font-bold text-slate-900">{money(t.sales)}</div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{t.count} orders</span>
                      <span>Avg {money(t.avgTicket)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: FINANCIALS & EXPENSES
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "financials" && (
        <div className="space-y-6">
          {/* Gross-to-Net Waterfall Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-1">P&L Waterfall: Gross to Net Profit</h3>
            <p className="text-xs text-slate-500 mb-6">
              Full reconciliation of gross menu sales, deductions, overheads, and restaurant bottom line.
            </p>

            <div className="max-w-2xl space-y-3 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="font-semibold text-slate-700">Gross Menu Sales</span>
                <span className="font-bold text-slate-900">{money(summary.grossSales)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-rose-600">
                <span>(-) Total Discounts Given</span>
                <span className="font-semibold">-{money(summary.totalDiscount)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-slate-700">
                <span>(+) Tax Collected (VAT/GST)</span>
                <span className="font-semibold">+{money(summary.totalTax)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 font-bold text-slate-900">
                <span>(=) Net Realized Sales</span>
                <span className="text-sm text-brand">{money(summary.netSales)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-rose-50/60 p-3 text-rose-700">
                <span className="font-semibold">(-) Operating Expenses</span>
                <span className="font-bold">-{money(summary.totalExpenses)}</span>
              </div>

              <div
                className={`flex items-center justify-between rounded-xl p-4 text-sm font-bold shadow-sm ${
                  summary.netProfit >= 0 ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                }`}
              >
                <div>
                  <div>(=) Net Profit / Margin</div>
                  <div className="text-xs font-normal text-emerald-100">
                    {summary.profitMargin}% profit margin on net sales
                  </div>
                </div>
                <div className="text-lg">{money(summary.netProfit)}</div>
              </div>
            </div>
          </div>

          {/* Expenses Register */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Expense Register in Selected Period</h3>
            <p className="text-xs text-slate-500 mb-4">
              All daily operational expenses, purchases, and cost outlays.
            </p>

            {(!data?.expenses || data.expenses.length === 0) ? (
              <Empty>No expenses recorded in this period.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-left font-semibold text-slate-500">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Title / Category</th>
                      <th className="py-2.5">Notes</th>
                      <th className="py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 font-medium text-slate-500">
                          {new Date(exp.date).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 font-bold text-slate-800">{exp.title}</td>
                        <td className="py-2.5 text-slate-500">{exp.note || "-"}</td>
                        <td className="py-2.5 text-right font-bold text-rose-600">
                          {money(exp.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: ORDER AUDIT LOG
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Order Audit History</h3>
                <p className="text-xs text-slate-500">
                  Searchable check-level audit log of transactions in the selected period.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Order #, Phone, Staff..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-1.5 pl-8 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>

                {/* Filter */}
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PAID">Paid Only</option>
                  <option value="NEW">New</option>
                  <option value="PREPARING">Preparing</option>
                  <option value="READY">Ready</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <Empty>No orders match the filter criteria.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-left font-semibold text-slate-500">
                      <th className="py-2.5 pl-2">Order #</th>
                      <th className="py-2.5">Date & Time</th>
                      <th className="py-2.5">Type & Channel</th>
                      <th className="py-2.5">Items</th>
                      <th className="py-2.5">Staff / Table</th>
                      <th className="py-2.5">Payment</th>
                      <th className="py-2.5 text-right pr-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 pl-2 font-bold text-slate-800">
                          {o.orderNo}
                          {o.invoiceNo && (
                            <span className="block text-[10px] font-normal text-slate-400">
                              Inv: {o.invoiceNo}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-slate-500">
                          {new Date(o.createdAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <TypeBadge value={o.type} />
                            {o.source !== "IN_HOUSE" && (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                {o.source}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 max-w-xs truncate text-slate-600 font-medium" title={o.itemsSummary}>
                          {o.itemsSummary || "-"}
                        </td>
                        <td className="py-2.5 text-slate-500">
                          <div>{o.placedBy || "Self-order"}</div>
                          {o.tableNo && (
                            <span className="text-[10px] text-brand font-semibold">T-{o.tableNo}</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1">
                            <StatusBadge value={o.paymentStatus} />
                            <span className="text-[11px] text-slate-400">({o.paymentModes})</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right pr-2 font-bold text-slate-900">
                          {money(o.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PRINTABLE REPORT VIEW (Visible ONLY when printing)
      ───────────────────────────────────────────────────────────── */}
      <div className="report-printable hidden">
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">EXECUTIVE BUSINESS REPORT</h1>
            <p className="text-xs text-slate-600 mt-1">
              Reporting Period: {from} to {to} &bull; Generated on: {new Date().toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-slate-900">ENIKK VENDYA RESTAURANT</div>
            <div className="text-xs text-slate-500">Management & Audit Report</div>
          </div>
        </div>

        {/* Executive Summary Grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="border border-slate-300 p-3 rounded">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Net Sales</div>
            <div className="text-lg font-bold text-slate-900">{money(summary.netSales)}</div>
          </div>
          <div className="border border-slate-300 p-3 rounded">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Total Expenses</div>
            <div className="text-lg font-bold text-rose-700">{money(summary.totalExpenses)}</div>
          </div>
          <div className="border border-slate-300 p-3 rounded">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Net Profit</div>
            <div className="text-lg font-bold text-emerald-700">{money(summary.netProfit)}</div>
            <div className="text-[10px] text-slate-600">{summary.profitMargin}% margin</div>
          </div>
          <div className="border border-slate-300 p-3 rounded">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Paid Orders / AOV</div>
            <div className="text-lg font-bold text-slate-900">{summary.paidOrders}</div>
            <div className="text-[10px] text-slate-600">AOV: {money(summary.avgOrderValue)}</div>
          </div>
        </div>

        {/* Top items table for print */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-300 pb-1 mb-2">
            Top Menu Items by Sales
          </h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left font-bold border-b border-slate-200">
                <th className="py-1">#</th>
                <th className="py-1">Item Name</th>
                <th className="py-1">Category</th>
                <th className="py-1 text-right">Units Sold</th>
                <th className="py-1 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data?.topItems?.slice(0, 15).map((it, idx) => (
                <tr key={it.name} className="border-b border-slate-100">
                  <td className="py-1 text-slate-500">{idx + 1}</td>
                  <td className="py-1 font-semibold">{it.name}</td>
                  <td className="py-1 text-slate-600">{it.category || "-"}</td>
                  <td className="py-1 text-right">{it.qty}</td>
                  <td className="py-1 text-right font-bold">{money(it.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sign-off footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between text-xs text-slate-500">
          <div>Prepared By: Management / System Admin</div>
          <div>Authorized Signature: _______________________</div>
        </div>
      </div>
    </div>
  );
}
