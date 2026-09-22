import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api, money } from "../../api.js";
import { Spinner, Empty, Toast } from "../../components/ui.jsx";
import { subscribeGlobal } from "../../socket.js";

export default function Waiters() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const [waiters, setWaiters] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | ACTIVE | INACTIVE

  // Waiter modal form (null = closed, { id?: number, name: "", username: "", password: "", active: true })
  const [form, setForm] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load waiters and daily stats
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/waiters", { params: { date } });
      setWaiters(data.waiters || []);
      setSummary(data.summary || null);
    } catch (e) {
      setToast(e.message || "Failed to load waiters");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time: refresh waiter daily totals on new orders/payments
  useEffect(() => {
    const refresh = () => load();
    return subscribeGlobal({ onNew: refresh, onPayment: refresh });
  }, [load]);

  // Navigate date
  const changeDateBy = (days) => {
    const current = new Date(date);
    current.setDate(current.getDate() + days);
    setDate(current.toISOString().slice(0, 10));
  };

  // Create or Update Waiter
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) return setToast("Waiter name is required");
    if (!form.id && !form.username.trim()) return setToast("Username is required");
    if (!form.id && !form.password.trim()) return setToast("Password is required");

    setSubmitting(true);
    try {
      if (form.id) {
        // Update
        const payload = {
          name: form.name.trim(),
          active: form.active,
        };
        if (form.password.trim()) {
          payload.password = form.password.trim();
        }
        await api.put(`/waiters/${form.id}`, payload);
        setToast("Waiter updated successfully ✓");
      } else {
        // Create new
        await api.post("/waiters", {
          name: form.name.trim(),
          username: form.username.trim(),
          password: form.password.trim(),
        });
        setToast("New waiter account created ✓");
      }
      setForm(null);
      load();
    } catch (err) {
      setToast(err.message || "Failed to save waiter");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle active status
  const toggleActive = async (w) => {
    try {
      await api.put(`/waiters/${w.id}`, { active: !w.active });
      setToast(w.active ? "Waiter deactivated" : "Waiter activated");
      load();
    } catch (err) {
      setToast(err.message || "Failed to toggle status");
    }
  };

  // Delete waiter
  const handleDelete = async (w) => {
    if (!confirm(`Are you sure you want to delete waiter "${w.name}" (@${w.username})?`)) return;
    try {
      const { data } = await api.delete(`/waiters/${w.id}`);
      setToast(data.message || "Waiter removed");
      load();
    } catch (err) {
      setToast(err.message || "Failed to delete waiter");
    }
  };

  // Filtered list
  const filteredWaiters = useMemo(() => {
    return waiters.filter((w) => {
      if (statusFilter === "ACTIVE" && !w.active) return false;
      if (statusFilter === "INACTIVE" && w.active) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = w.name.toLowerCase().includes(q);
        const matchUser = w.username.toLowerCase().includes(q);
        if (!matchName && !matchUser) return false;
      }
      return true;
    });
  }, [waiters, statusFilter, search]);

  // Top Collector of the day
  const topCollector = useMemo(() => {
    if (!waiters.length) return null;
    const sorted = [...waiters].sort(
      (a, b) => b.dailyStats.collectedTotal - a.dailyStats.collectedTotal
    );
    return sorted[0]?.dailyStats?.collectedTotal > 0 ? sorted[0] : null;
  }, [waiters]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER: Title & Date Controls & Add Button                 */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Waiters & Floor Staff</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage waiter login credentials and track real-time daily cash collections and orders taken.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Picker Navigation Bar */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => changeDateBy(-1)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition"
              title="Previous Day"
            >
              ←
            </button>

            <input
              type="date"
              className="px-2 py-1 text-xs font-bold text-slate-800 outline-none cursor-pointer"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <button
              onClick={() => changeDateBy(1)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition"
              title="Next Day"
            >
              →
            </button>

            {date !== today && (
              <button
                onClick={() => setDate(today)}
                className="rounded-lg bg-brand/10 px-2 py-1 text-[11px] font-bold text-brand hover:bg-brand/20 transition ml-1"
              >
                Today
              </button>
            )}
          </div>

          {/* Add New Waiter Button */}
          <button
            onClick={() => {
              setForm({ name: "", username: "", password: "", active: true });
              setShowPassword(false);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-md shadow-brand/20 hover:brightness-105 active:scale-95 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Add Waiter</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP KPI STAT CARDS (Daily Collections & Staff Metrics)     */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* TOTAL DAILY COLLECTED AMOUNT BY WAITERS */}
        <div className="card p-4 sm:p-5 border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Daily Waiter Collection
            </p>
            <p className="mt-1.5 text-2xl sm:text-3xl font-black text-emerald-600">
              {money(summary?.totalDailyCollected || 0)}
            </p>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-emerald-700/80 border-t border-emerald-100 pt-1.5">
            Collected on {date}
          </p>
        </div>

        {/* TOTAL ORDERS TAKEN TODAY BY WAITERS */}
        <div className="card p-4 sm:p-5 border border-slate-200/80 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Orders Placed Today
            </p>
            <p className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-900">
              {summary?.totalDailyOrders || 0}
            </p>
          </div>
          <p className="mt-2 text-[11px] font-medium text-slate-500 border-t border-slate-100 pt-1.5">
            Handheld tablet / mobile orders
          </p>
        </div>

        {/* TOTAL ACTIVE WAITERS */}
        <div className="card p-4 sm:p-5 border border-slate-200/80 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Waiters
            </p>
            <p className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-900">
              {summary?.activeWaiters || 0} <span className="text-sm font-normal text-slate-400">/ {summary?.totalWaiters || 0}</span>
            </p>
          </div>
          <p className="mt-2 text-[11px] font-medium text-slate-500 border-t border-slate-100 pt-1.5">
            Floor service personnel
          </p>
        </div>

        {/* TOP PERFORMING COLLECTOR */}
        <div className="card p-4 sm:p-5 border border-slate-200/80 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Top Collector Today
            </p>
            <p className="mt-1.5 text-xl sm:text-2xl font-black text-brand truncate">
              {topCollector ? topCollector.name : "None yet"}
            </p>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-slate-500 border-t border-slate-100 pt-1.5">
            {topCollector ? `${money(topCollector.dailyStats.collectedTotal)} collected` : "Awaiting sales"}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. SEARCH & STATUS FILTER CONTROLS                            */}
      {/* ------------------------------------------------------------- */}
      <div className="card p-3.5 border border-slate-200/80 bg-white shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="Search waiter by name or @username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-8 py-1.5 text-xs sm:text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-brand/20 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {["ALL", "ACTIVE", "INACTIVE"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === st
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st === "ALL" ? "All Waiters" : st === "ACTIVE" ? "🟢 Active" : "🔴 Inactive"}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. WAITERS LIST / CARDS MODEL                                 */}
      {/* ------------------------------------------------------------- */}
      {filteredWaiters.length === 0 ? (
        <Empty>No waiters found matching your search.</Empty>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredWaiters.map((w) => (
            <div
              key={w.id}
              className={`card p-5 border flex flex-col justify-between transition-all duration-200 ${
                w.active ? "border-slate-200/80 bg-white hover:shadow-md" : "border-slate-200 bg-slate-50/70 opacity-80"
              }`}
            >
              <div>
                {/* Waiter Card Top: Avatar, Name & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white font-black text-sm shadow-md">
                      {w.name.charAt(0).toUpperCase()}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                          w.active ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-tight">{w.name}</h3>
                      <p className="text-xs font-mono font-medium text-slate-500 mt-0.5">@{w.username}</p>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      w.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {w.active ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Daily Metrics Highlight Box */}
                <div className="mt-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/80 p-3.5 border border-slate-200/80">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-xs font-bold text-slate-600">Daily Amount Collected:</span>
                    <span className="font-extrabold text-base text-emerald-600 font-mono">
                      {money(w.dailyStats.collectedTotal)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                    <span>Orders Placed:</span>
                    <span className="font-bold text-slate-900">{w.dailyStats.ordersCount} orders</span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                    <span>Sales Generated:</span>
                    <span className="font-bold text-slate-900">{money(w.dailyStats.ordersTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => toggleActive(w)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition ${
                    w.active
                      ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {w.active ? "Deactivate" : "Activate"}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setForm({
                        id: w.id,
                        name: w.name,
                        username: w.username,
                        password: "", // empty means keep existing
                        active: w.active,
                      });
                      setShowPassword(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>Edit / Password</span>
                  </button>

                  <button
                    onClick={() => handleDelete(w)}
                    className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition"
                    title="Delete Waiter"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. ADD / EDIT WAITER MODAL (Username, Password & Name)        */}
      {/* ------------------------------------------------------------- */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 bg-white rounded-2xl shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {form.id ? `Edit Waiter · ${form.name}` : "Create New Waiter Account"}
              </h3>
              <button
                onClick={() => setForm(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  className="input text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Login Username *
                </label>
                <input
                  type="text"
                  required
                  disabled={!!form.id} // Username can't be changed once created
                  placeholder="e.g. waiter_rahul"
                  className={`input text-sm font-mono ${form.id ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""}`}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().trim() })}
                />
                {form.id && (
                  <p className="text-[10px] text-slate-400 mt-0.5">Username cannot be changed after creation.</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {form.id ? "New Password (leave blank to keep current)" : "Login Password *"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!form.id}
                    placeholder={form.id ? "Enter new password if changing..." : "Minimum 4 characters..."}
                    className="input text-sm pr-16"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="waiterActive"
                  className="h-4 w-4 rounded text-brand focus:ring-brand cursor-pointer"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <label htmlFor="waiterActive" className="text-sm font-semibold text-slate-700 cursor-pointer">
                  Account Active (Can log into waiter app)
                </label>
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setForm(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? "Saving..." : form.id ? "Update Account" : "Create Waiter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
