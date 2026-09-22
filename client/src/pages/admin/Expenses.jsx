import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api, money } from "../../api.js";
import { Spinner, Empty, Toast } from "../../components/ui.jsx";

// Quick expense presets for fast food ERP data entry
const EXPENSE_PRESETS = [
  { label: "Vegetables & Greens", cat: "Vegetables" },
  { label: "Chicken / Meat", cat: "Meat" },
  { label: "Dairy & Milk", cat: "Dairy" },
  { label: "Cooking Oil & Spices", cat: "Groceries" },
  { label: "Cooking Gas Cylinder", cat: "Utilities" },
  { label: "Staff Daily Wages", cat: "Staff" },
  { label: "Packaging & Boxes", cat: "Packaging" },
  { label: "Cleaning Supplies", cat: "Maintenance" },
];

export default function Expenses() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const [data, setData] = useState(null);
  const [dailyReport, setDailyReport] = useState(null);
  const [expenseRange, setExpenseRange] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [form, setForm] = useState({ title: "", amount: "", note: "", category: "Groceries" });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");

  // Load all expenses, daily sales comparison & 7-day range
  const load = useCallback(async () => {
    try {
      const [expRes, dailyRes, rangeRes] = await Promise.all([
        api.get("/expenses", { params: { date } }),
        api.get("/reports/daily", { params: { date } }).catch(() => ({ data: null })),
        api.get("/expenses/range").catch(() => ({ data: { rows: [] } })),
      ]);

      setData(expRes.data);
      if (dailyRes?.data) setDailyReport(dailyRes.data);
      if (rangeRes?.data?.rows) setExpenseRange(rangeRes.data.rows);
    } catch (e) {
      setToast(e.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  // Navigate previous / next day
  const changeDateBy = (days) => {
    const current = new Date(date);
    current.setDate(current.getDate() + days);
    setDate(current.toISOString().slice(0, 10));
  };

  // Add Expense
  const add = async (e) => {
    e?.preventDefault();
    if (!form.title.trim() || form.amount === "") return setToast("Title and amount are required");
    if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) return setToast("Please enter a valid amount");

    setSubmitting(true);
    try {
      const titleWithCat = form.category ? `[${form.category}] ${form.title.trim()}` : form.title.trim();
      await api.post("/expenses", {
        title: titleWithCat,
        amount: Number(form.amount),
        note: form.note.trim() || null,
        date,
      });

      setForm({ title: "", amount: "", note: "", category: "Groceries" });
      setToast("Expense recorded successfully ✓");
      load();
    } catch (err) {
      setToast(err.message || "Failed to add expense");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Expense
  const remove = async (id, title) => {
    if (!confirm(`Delete expense "${title}"?`)) return;
    try {
      await api.delete(`/expenses/${id}`);
      setToast("Expense deleted");
      load();
    } catch (err) {
      setToast(err.message || "Failed to delete");
    }
  };

  // Category breakdown calculation
  const categoryBreakdown = useMemo(() => {
    if (!data?.expenses) return {};
    const map = {};
    data.expenses.forEach((e) => {
      // Extract [Category] if present
      const match = e.title.match(/^\[(.*?)\]\s*(.*)$/);
      const cat = match ? match[1] : "General";
      map[cat] = (map[cat] || 0) + Number(e.amount);
    });
    return map;
  }, [data]);

  // Filtered expenses by search query
  const filteredExpenses = useMemo(() => {
    if (!data?.expenses) return [];
    if (!search.trim()) return data.expenses;
    const q = search.toLowerCase();
    return data.expenses.filter(
      (e) => e.title.toLowerCase().includes(q) || (e.note || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  if (loading || !data) return <Spinner />;

  const totalExpense = Number(data.total || 0);
  const totalSales = Number(dailyReport?.sales || 0);
  const netProfit = totalSales - totalExpense;
  const maxRangeExpense = Math.max(1, ...expenseRange.map((r) => r.total));

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER & DATE CONTROLS (Identical to Report Page)          */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily Cost & Expenses</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Track daily raw materials, groceries, utilities, wages, and operational costs.
          </p>
        </div>

        {/* Date Selector Navigation Bar */}
        <div className="flex items-center gap-2">
          {/* Quick Previous Day Button */}
          <button
            onClick={() => changeDateBy(-1)}
            className="h-9 w-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 shadow-sm active:scale-95 transition"
            title="Previous Day"
          >
            ←
          </button>

          {/* Date Picker Input */}
          <input
            type="date"
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-brand/20 transition cursor-pointer"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          {/* Quick Next Day Button */}
          <button
            onClick={() => changeDateBy(1)}
            className="h-9 w-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 shadow-sm active:scale-95 transition"
            title="Next Day"
          >
            →
          </button>

          {/* Jump to Today Button */}
          {date !== today && (
            <button
              onClick={() => setDate(today)}
              className="rounded-xl bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand/20 transition"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. STAT KPI CARDS (Full Width 4-Column Row like Reports Page) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Total Expenses"
          value={money(totalExpense)}
          accent="text-rose-600"
          sublabel={`${data.expenses.length} entry/entries`}
        />
        <Stat
          label="Today's Sales"
          value={money(totalSales)}
          accent="text-brand"
          sublabel="From paid orders"
        />
        <Stat
          label="Estimated Profit"
          value={money(netProfit)}
          accent={netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}
          sublabel={netProfit >= 0 ? "Positive margin" : "Deficit today"}
        />
        <Stat
          label="Avg Expense / Entry"
          value={data.expenses.length ? money(totalExpense / data.expenses.length) : money(0)}
          accent="text-slate-800"
          sublabel="Per transaction"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. ENTRY FORM & CATEGORY BREAKDOWN (Side by Side Grid)       */}
      {/* ------------------------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ADD EXPENSE CARD */}
        <div className="card p-5 border border-slate-200/80 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-100 text-rose-600 text-xs font-bold">
                  +
                </span>
                <span>Record New Expense</span>
              </h2>
              <span className="text-[11px] font-semibold text-slate-400">Date: {date}</span>
            </div>

            {/* Quick Preset Chips */}
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Quick Presets:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {EXPENSE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setForm({ ...form, title: p.label, category: p.cat })}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 active:scale-95 transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={add} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Category selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Category</label>
                  <select
                    className="input !py-2 text-xs font-medium cursor-pointer"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="Vegetables">Vegetables</option>
                    <option value="Meat">Meat & Poultry</option>
                    <option value="Dairy">Dairy & Milk</option>
                    <option value="Groceries">Groceries & Spices</option>
                    <option value="Utilities">Gas & Utilities</option>
                    <option value="Staff">Staff Wages</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="General">Other / General</option>
                  </select>
                </div>

                {/* Title */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Expense Item *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10kg Onions & Tomatoes"
                    className="input !py-2 text-sm"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Amount */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    className="input !py-2 text-sm font-bold text-rose-600"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>

                {/* Note / Vendor */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Vendor / Note (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Al-Madina Fresh Market, Cash"
                    className="input !py-2 text-sm"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary !py-2 !px-6 !text-xs font-bold shadow-md shadow-brand/20 active:scale-95"
                >
                  {submitting ? "Saving..." : "+ Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* EXPENSES BY CATEGORY BREAKDOWN CARD (Like Reports' Payments by Mode) */}
        <div className="card p-5 border border-slate-200/80 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center justify-between">
              <span>Expenses by Category</span>
              <span className="text-xs font-bold text-slate-500">
                Total: {money(totalExpense)}
              </span>
            </h2>

            {Object.keys(categoryBreakdown).length === 0 ? (
              <Empty>No expenses categorized yet today.</Empty>
            ) : (
              <div className="space-y-3 pt-1">
                {Object.entries(categoryBreakdown).map(([cat, amt]) => {
                  const percentage = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-700 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-brand" />
                          <span>{cat}</span>
                        </span>
                        <span className="text-slate-900">
                          {money(amt)}{" "}
                          <span className="text-[10px] text-slate-400 font-normal">({percentage}%)</span>
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand to-rose-500 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Categories tracked: {Object.keys(categoryBreakdown).length}</span>
            <span className="font-semibold text-rose-600">Daily Burn: {money(totalExpense)}</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. ITEMIZED EXPENSE DATA TABLE (Exact Report Page Format)     */}
      {/* ------------------------------------------------------------- */}
      <div className="card p-5 border border-slate-200/80 bg-white shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Itemized Expenses ({date})
            </h2>
            <p className="text-xs text-slate-500">
              Showing {filteredExpenses.length} of {data.expenses.length} expense record(s).
            </p>
          </div>

          {/* Search Bar for Expense Table */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search expenses, vendors..."
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 pl-8 text-xs sm:text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-brand/20 transition w-full sm:w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              🔍
            </span>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <Empty>No expenses recorded for this date.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Item & Category</th>
                  <th className="py-3 px-4">Vendor / Notes</th>
                  <th className="py-3 px-4">Recorded Time</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredExpenses.map((e) => {
                  const match = e.title.match(/^\[(.*?)\]\s*(.*)$/);
                  const categoryName = match ? match[1] : null;
                  const itemTitle = match ? match[2] : e.title;
                  const time = new Date(e.createdAt || e.date).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {categoryName && (
                            <span className="rounded-md bg-rose-50 border border-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                              {categoryName}
                            </span>
                          )}
                          <span className="font-bold text-slate-900">{itemTitle}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {e.note || "—"}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-400">
                        {time}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600 text-sm">
                        {money(e.amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => remove(e.id, itemTitle)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                          title="Delete expense"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="py-3 px-4 text-right text-xs uppercase tracking-wider text-slate-500">
                    Total Expense
                  </td>
                  <td className="py-3 px-4 text-right text-base text-rose-600">
                    {money(totalExpense)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. LAST 7 DAYS EXPENSES BAR CHART (Matching Reports.jsx)      */}
      {/* ------------------------------------------------------------- */}
      <div className="card p-5 border border-slate-200/80 bg-white shadow-sm">
        <h2 className="mb-4 text-base font-bold text-slate-900 flex items-center justify-between">
          <span>Last 7 Days Expense Trend</span>
          <span className="text-xs font-semibold text-slate-400">Weekly Cost Analysis</span>
        </h2>

        {expenseRange.length === 0 ? (
          <Empty>No expense history recorded in the past 7 days.</Empty>
        ) : (
          <div className="flex items-end gap-2 sm:gap-4 pt-4" style={{ height: 180 }}>
            {expenseRange.map((r) => {
              const isSelectedDay = r.date === date;
              const heightPercent = maxRangeExpense > 0 ? (r.total / maxRangeExpense) * 120 : 0;

              return (
                <div key={r.date} className="flex flex-1 flex-col items-center justify-end group">
                  <span className="mb-1.5 text-[10px] sm:text-xs font-bold text-slate-600 transition-opacity">
                    {money(r.total)}
                  </span>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      isSelectedDay
                        ? "bg-gradient-to-t from-brand to-rose-500 shadow-md shadow-brand/20 ring-2 ring-brand/30"
                        : "bg-slate-200 hover:bg-slate-300"
                    }`}
                    style={{ height: `${Math.max(8, heightPercent)}px` }}
                    title={`${r.date}: ${money(r.total)}`}
                  />
                  <span
                    className={`mt-2 text-[10px] sm:text-xs font-semibold truncate ${
                      isSelectedDay ? "text-brand font-bold" : "text-slate-400"
                    }`}
                  >
                    {r.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}

// Matching Stat component from Reports.jsx
function Stat({ label, value, accent, sublabel }) {
  return (
    <div className="card p-4 sm:p-5 border border-slate-200/80 bg-white shadow-sm flex flex-col justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`mt-1.5 text-xl sm:text-2xl font-black ${accent || "text-slate-900"}`}>{value}</p>
      </div>
      {sublabel && (
        <p className="mt-2 text-[11px] font-medium text-slate-500 border-t border-slate-100 pt-1.5 truncate">
          {sublabel}
        </p>
      )}
    </div>
  );
}
