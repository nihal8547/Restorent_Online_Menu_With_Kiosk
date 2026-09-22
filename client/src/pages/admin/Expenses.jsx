import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api, money } from "../../api.js";
import { Spinner, Empty, Toast } from "../../components/ui.jsx";
import {
  Plus,
  Search,
  Calendar,
  X,
  PlusCircle,
  Tag,
  DollarSign,
  TrendingDown,
  ShoppingBag,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

// Default standard restaurant expense categories
const DEFAULT_CATEGORIES = [
  "Vegetables",
  "Meat & Poultry",
  "Dairy & Milk",
  "Groceries & Spices",
  "Beverages",
  "Gas & Utilities",
  "Staff Wages",
  "Packaging",
  "Cleaning & Maintenance",
  "Rent",
  "General / Miscellaneous",
];

// Quick expense presets for fast restaurant data entry
const EXPENSE_PRESETS = [
  { label: "Fresh Vegetables", cat: "Vegetables" },
  { label: "Chicken / Meat", cat: "Meat & Poultry" },
  { label: "Dairy & Milk", cat: "Dairy & Milk" },
  { label: "Cooking Oil & Spices", cat: "Groceries & Spices" },
  { label: "Cooking Gas Cylinder", cat: "Gas & Utilities" },
  { label: "Staff Daily Wages", cat: "Staff Wages" },
  { label: "Takeaway Packaging", cat: "Packaging" },
  { label: "Cleaning Supplies", cat: "Cleaning & Maintenance" },
];

export default function Expenses() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const [data, setData] = useState(null);
  const [dailyReport, setDailyReport] = useState(null);
  const [expenseRange, setExpenseRange] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Search and Category Filter
  const [search, setSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");

  // Manual Entry Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Custom Categories list stored locally
  const [customCategories, setCustomCategories] = useState(() => {
    try {
      const saved = localStorage.getItem("custom_expense_categories");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal Line Items State
  const [modalDate, setModalDate] = useState(today);
  const [modalItems, setModalItems] = useState([
    { id: 1, category: "Groceries & Spices", title: "", amount: "", note: "" },
  ]);
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);

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

  // Merge default categories, custom saved categories, and any existing categories in records
  const allCategories = useMemo(() => {
    const set = new Set([...DEFAULT_CATEGORIES, ...customCategories]);
    if (data?.expenses) {
      data.expenses.forEach((e) => {
        const match = e.title.match(/^\[(.*?)\]\s*(.*)$/);
        if (match && match[1]) set.add(match[1]);
      });
    }
    return Array.from(set);
  }, [customCategories, data?.expenses]);

  // Navigate previous / next day
  const changeDateBy = (days) => {
    const current = new Date(date);
    current.setDate(current.getDate() + days);
    setDate(current.toISOString().slice(0, 10));
  };

  // Open Modal with preset date
  const handleOpenModal = () => {
    setModalDate(date);
    setModalItems([
      { id: Date.now(), category: allCategories[0] || "Vegetables", title: "", amount: "", note: "" },
    ]);
    setIsAddingNewCat(false);
    setNewCatName("");
    setIsModalOpen(true);
  };

  // Add line item in modal
  const handleAddLineItem = () => {
    setModalItems((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        category: prev[prev.length - 1]?.category || allCategories[0] || "General",
        title: "",
        amount: "",
        note: "",
      },
    ]);
  };

  // Remove line item in modal
  const handleRemoveLineItem = (id) => {
    if (modalItems.length === 1) return;
    setModalItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Update line item in modal
  const handleUpdateLineItem = (id, field, value) => {
    setModalItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Add custom category
  const handleCreateCategory = (e) => {
    e?.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (!allCategories.includes(trimmed)) {
      const updated = [...customCategories, trimmed];
      setCustomCategories(updated);
      try {
        localStorage.setItem("custom_expense_categories", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save custom category", err);
      }
    }
    // Set for current editing item
    if (modalItems.length > 0) {
      handleUpdateLineItem(modalItems[0].id, "category", trimmed);
    }
    setNewCatName("");
    setIsAddingNewCat(false);
    setToast(`Category "${trimmed}" added!`);
  };

  // Apply preset to active modal item
  const handleApplyPreset = (p) => {
    const lastItem = modalItems[modalItems.length - 1];
    if (lastItem && !lastItem.title) {
      handleUpdateLineItem(lastItem.id, "title", p.label);
      handleUpdateLineItem(lastItem.id, "category", p.cat);
    } else {
      setModalItems((prev) => [
        ...prev,
        { id: Date.now(), category: p.cat, title: p.label, amount: "", note: "" },
      ]);
    }
  };

  // Submit manual entries
  const handleSaveModalExpenses = async (e) => {
    e?.preventDefault();
    const validItems = modalItems.filter((it) => it.title.trim() && it.amount !== "");
    if (validItems.length === 0) {
      return setToast("Please enter at least one item with name and amount.");
    }

    for (const it of validItems) {
      if (isNaN(Number(it.amount)) || Number(it.amount) <= 0) {
        return setToast(`Please enter a valid amount for "${it.title}"`);
      }
    }

    setModalSubmitting(true);
    try {
      const payloadItems = validItems.map((it) => ({
        title: it.category ? `[${it.category}] ${it.title.trim()}` : it.title.trim(),
        amount: Number(it.amount),
        note: it.note.trim() || null,
        date: modalDate,
      }));

      await api.post("/expenses", {
        items: payloadItems,
        date: modalDate,
      });

      setToast(`Successfully recorded ${payloadItems.length} expense(s) ✓`);
      setIsModalOpen(false);
      // If recorded on a different date, switch to that date
      if (modalDate !== date) {
        setDate(modalDate);
      } else {
        load();
      }
    } catch (err) {
      setToast(err.response?.data?.error || err.message || "Failed to save expenses");
    } finally {
      setModalSubmitting(false);
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
      const match = e.title.match(/^\[(.*?)\]\s*(.*)$/);
      const cat = match ? match[1] : "General";
      map[cat] = (map[cat] || 0) + Number(e.amount);
    });
    return map;
  }, [data]);

  // Filtered expenses by search query and category
  const filteredExpenses = useMemo(() => {
    if (!data?.expenses) return [];
    let list = data.expenses;

    // Filter by category
    if (selectedCategoryFilter !== "ALL") {
      list = list.filter((e) => {
        const match = e.title.match(/^\[(.*?)\]\s*(.*)$/);
        const cat = match ? match[1] : "General";
        return cat.toLowerCase() === selectedCategoryFilter.toLowerCase();
      });
    }

    // Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => {
        const match = e.title.match(/^\[(.*?)\]\s*(.*)$/);
        const cat = match ? match[1] : "General";
        const title = match ? match[2] : e.title;
        return (
          title.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q) ||
          (e.note || "").toLowerCase().includes(q) ||
          String(e.amount).includes(q)
        );
      });
    }

    return list;
  }, [data, search, selectedCategoryFilter]);

  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [filteredExpenses]);

  if (loading || !data) return <Spinner />;

  const totalExpense = Number(data.total || 0);
  const totalSales = Number(dailyReport?.sales || 0);
  const netProfit = totalSales - totalExpense;
  const maxRangeExpense = Math.max(1, ...expenseRange.map((r) => r.total));
  const modalTotal = modalItems.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      <Toast message={toast} onClose={() => setToast("")} />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER WITH MANUAL ENTRY BUTTON & DATE CONTROLS        */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 font-bold">
              <DollarSign className="h-5 w-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Daily Cost & Expenses
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track daily purchases, raw materials, groceries, utilities, and staff operational expenses.
          </p>
        </div>

        {/* Action Controls & Date Navigation */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* TOP MANUAL ENTRY BUTTON */}
          <button
            onClick={handleOpenModal}
            className="btn-primary !py-2.5 !px-4 !text-xs font-bold shadow-md shadow-brand/20 active:scale-95 flex items-center gap-2 bg-gradient-to-r from-brand to-rose-600 hover:brightness-105"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Manual Entry</span>
          </button>

          {/* Date Navigation Bar */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-0.5 shadow-sm">
            <button
              onClick={() => changeDateBy(-1)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-xs active:scale-95 transition"
              title="Previous Day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                className="border-none bg-transparent py-1 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <button
              onClick={() => changeDateBy(1)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-xs active:scale-95 transition"
              title="Next Day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Jump to Today Button */}
          {date !== today && (
            <button
              onClick={() => setDate(today)}
              className="rounded-xl border border-brand/20 bg-brand/10 px-3 py-2 text-xs font-bold text-brand hover:bg-brand/20 transition active:scale-95"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. STAT KPI CARDS                                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Total Expenses"
          value={money(totalExpense)}
          accent="text-rose-600"
          sublabel={`${data.expenses.length} entry/entries recorded`}
        />
        <Stat
          label="Today's Sales"
          value={money(totalSales)}
          accent="text-brand"
          sublabel="From paid customer orders"
        />
        <Stat
          label="Estimated Net Margin"
          value={money(netProfit)}
          accent={netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}
          sublabel={netProfit >= 0 ? "Positive operating margin" : "Expense deficit today"}
        />
        <Stat
          label="Avg Expense / Item"
          value={data.expenses.length ? money(totalExpense / data.expenses.length) : money(0)}
          accent="text-slate-800"
          sublabel="Average per receipt"
        />
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. CATEGORY BREAKDOWN CARDS                                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Expenses by Category</h2>
            <p className="text-xs text-slate-500">Distribution of expenditures for {date}</p>
          </div>
          <span className="text-xs font-bold text-rose-600">
            Total Burn: {money(totalExpense)}
          </span>
        </div>

        {Object.keys(categoryBreakdown).length === 0 ? (
          <Empty>No expenses categorized yet for this date.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(categoryBreakdown).map(([cat, amt]) => {
              const percentage = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
              const isSelected = selectedCategoryFilter.toLowerCase() === cat.toLowerCase();
              return (
                <div
                  key={cat}
                  onClick={() =>
                    setSelectedCategoryFilter(isSelected ? "ALL" : cat)
                  }
                  className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                    isSelected
                      ? "border-brand bg-brand/5 shadow-sm ring-1 ring-brand"
                      : "border-slate-100 bg-slate-50/60 hover:border-slate-200 hover:bg-slate-100/60"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 truncate pr-2">{cat}</span>
                    <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                      {percentage}%
                    </span>
                  </div>
                  <div className="mt-1 text-base font-bold text-slate-900">{money(amt)}</div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-rose-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. SEARCH, CATEGORY FILTER PILLS, AND DATA TABLE              */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
        {/* Table Header Controls: Search & Category Filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Itemized Expenses ({date})
            </h2>
            <p className="text-xs text-slate-500">
              Showing {filteredExpenses.length} of {data.expenses.length} record(s) &bull; Filtered Total:{" "}
              <strong className="text-rose-600 font-bold">{money(filteredTotal)}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search item, category, vendor..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-1.5 pl-8 pr-7 text-xs text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-brand transition"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Quick Add Button above table */}
            <button
              onClick={handleOpenModal}
              className="rounded-xl border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand/10 transition active:scale-95 flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Enter Items</span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills Rail */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setSelectedCategoryFilter("ALL")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition ${
              selectedCategoryFilter === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Categories ({data.expenses.length})
          </button>
          {allCategories.map((cat) => {
            const count = data.expenses.filter((e) => {
              const match = e.title.match(/^\[(.*?)\]\s*(.*)$/);
              return (match ? match[1] : "General").toLowerCase() === cat.toLowerCase();
            }).length;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                  selectedCategoryFilter.toLowerCase() === cat.toLowerCase()
                    ? "bg-brand text-white font-semibold shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{cat}</span>
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      selectedCategoryFilter.toLowerCase() === cat.toLowerCase()
                        ? "bg-white/20 text-white font-bold"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Table Content */}
        {filteredExpenses.length === 0 ? (
          <Empty>No expenses found matching the search or category filter.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600 min-w-[550px]">
              <thead className="bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-4">Item & Category</th>
                  <th className="py-2.5 px-4">Vendor / Notes</th>
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
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
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          {categoryName && (
                            <span className="rounded-md bg-rose-50 border border-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                              {categoryName}
                            </span>
                          )}
                          <span className="font-bold text-slate-900">{itemTitle}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {e.note || "—"}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">
                        {time}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-rose-600 text-sm">
                        {money(e.amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => remove(e.id, itemTitle)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                          title="Delete expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="py-2.5 px-4 text-right text-xs uppercase tracking-wider text-slate-500">
                    Total
                  </td>
                  <td className="py-2.5 px-4 text-right text-sm text-rose-600">
                    {money(filteredTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. LAST 7 DAYS EXPENSES BAR CHART                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-900 flex items-center justify-between">
          <span>Last 7 Days Expense Trend</span>
          <span className="text-xs font-semibold text-slate-400">Weekly Cost Analysis</span>
        </h2>

        {expenseRange.length === 0 ? (
          <Empty>No expense history recorded in the past 7 days.</Empty>
        ) : (
          <div className="flex items-end gap-2 sm:gap-4 pt-4" style={{ height: 160 }}>
            {expenseRange.map((r) => {
              const isSelectedDay = r.date === date;
              const heightPercent = maxRangeExpense > 0 ? (r.total / maxRangeExpense) * 110 : 0;

              return (
                <div key={r.date} className="flex flex-1 flex-col items-center justify-end group">
                  <span className="mb-1 text-[10px] sm:text-xs font-bold text-slate-600 transition-opacity">
                    {money(r.total)}
                  </span>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      isSelectedDay
                        ? "bg-gradient-to-t from-brand to-rose-500 shadow-md shadow-brand/20 ring-2 ring-brand/30"
                        : "bg-slate-200 hover:bg-slate-300"
                    }`}
                    style={{ height: `${Math.max(6, heightPercent)}px` }}
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. MODAL: MANUAL EXPENSE ENTRY WITH SET CATEGORY OPTION       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-4xl lg:max-w-5xl rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <PlusCircle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Manual Expense Entry</h3>
                  <p className="text-xs text-slate-500">
                    Record single or multiple operational expense items with spacious itemized columns.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveModalExpenses} className="p-6 space-y-5">
              {/* Date & Set Category Control Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700">Expense Date:</span>
                  <input
                    type="date"
                    required
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand/20 shadow-xs"
                  />
                </div>

                {/* Set Category Option */}
                <div>
                  {!isAddingNewCat ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCat(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-xs font-bold text-brand hover:bg-brand/20 transition active:scale-95 shadow-xs"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      <span>Set Category</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Enter category name..."
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="rounded-xl border border-brand bg-white px-3 py-1.5 text-xs font-semibold outline-none w-52 shadow-xs focus:ring-2 focus:ring-brand/20"
                      />
                      <button
                        type="button"
                        onClick={handleCreateCategory}
                        className="rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-dark transition active:scale-95 shadow-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewCat(false);
                          setNewCatName("");
                        }}
                        className="rounded-xl p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Presets Chips */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Quick Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-brand hover:text-brand active:scale-95 transition shadow-2xs"
                    >
                      + {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Line Items Form (Spacious Columns) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-900">Expense Items List</span>
                  <span className="text-sm font-semibold">
                    Total Amount: <strong className="text-rose-600 font-extrabold">{money(modalTotal)}</strong>
                  </span>
                </div>

                {/* Visible Column Headers on Tablets/Desktops */}
                <div className="hidden md:grid grid-cols-12 gap-3 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <div className="col-span-3">Category *</div>
                  <div className="col-span-4">Item Description *</div>
                  <div className="col-span-2">Amount *</div>
                  <div className="col-span-2">Vendor / Notes</div>
                  <div className="col-span-1 text-center">Action</div>
                </div>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {modalItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 items-center transition hover:border-slate-300"
                    >
                      {/* Category Selection */}
                      <div className="col-span-12 md:col-span-3">
                        <label className="block md:hidden text-[10px] font-bold text-slate-500 mb-1">
                          Category *
                        </label>
                        <select
                          value={item.category}
                          onChange={(e) => {
                            if (e.target.value === "__ADD_NEW__") {
                              setIsAddingNewCat(true);
                            } else {
                              handleUpdateLineItem(item.id, "category", e.target.value);
                            }
                          }}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs cursor-pointer"
                        >
                          {allCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          <option value="__ADD_NEW__">➕ Set New Category...</option>
                        </select>
                      </div>

                      {/* Item Description / Name */}
                      <div className="col-span-12 md:col-span-4">
                        <label className="block md:hidden text-[10px] font-bold text-slate-500 mb-1">
                          Item Description *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 10kg Onions & Tomatoes"
                          value={item.title}
                          onChange={(e) => handleUpdateLineItem(item.id, "title", e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-800 outline-none focus:ring-2 focus:ring-brand/20 font-medium shadow-2xs"
                        />
                      </div>

                      {/* Amount */}
                      <div className="col-span-6 md:col-span-2">
                        <label className="block md:hidden text-[10px] font-bold text-slate-500 mb-1">
                          Amount *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="0.00"
                          value={item.amount}
                          onChange={(e) => handleUpdateLineItem(item.id, "amount", e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-rose-600 outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs"
                        />
                      </div>

                      {/* Note / Vendor */}
                      <div className="col-span-5 md:col-span-2">
                        <label className="block md:hidden text-[10px] font-bold text-slate-500 mb-1">
                          Vendor / Note
                        </label>
                        <input
                          type="text"
                          placeholder="Vendor / Note"
                          value={item.note}
                          onChange={(e) => handleUpdateLineItem(item.id, "note", e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs"
                          title="Vendor or Notes"
                        />
                      </div>

                      {/* Delete Row Action */}
                      <div className="col-span-1 md:col-span-1 flex justify-center pt-4 md:pt-0">
                        {modalItems.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(item.id)}
                            className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Line Item Button */}
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-dark transition px-2 py-1.5 rounded-lg hover:bg-brand/5 active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Add Another Line Item</span>
                </button>
              </div>

              {/* Modal Footer with Actions */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="text-xs text-slate-500">
                  Total Items: <strong className="text-slate-800">{modalItems.length}</strong>
                  <span className="mx-2">&bull;</span>
                  Total Amount: <strong className="text-rose-600 text-sm">{money(modalTotal)}</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSubmitting}
                    className="btn-primary !py-2 !px-5 !text-xs font-bold shadow-md shadow-brand/20 active:scale-95 disabled:opacity-50"
                  >
                    {modalSubmitting ? "Saving..." : "Save Expense(s)"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent, sublabel }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm flex flex-col justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
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
