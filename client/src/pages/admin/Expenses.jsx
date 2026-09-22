import React, { useEffect, useState, useCallback } from "react";
import { api, money } from "../../api.js";
import { Spinner, Empty, Toast } from "../../components/ui.jsx";

// Daily cost / expenses entry.
export default function Expenses() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ title: "", amount: "", note: "" });
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const { data } = await api.get("/expenses", { params: { date } });
    setData(data);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!form.title || form.amount === "") return setToast("Title and amount required");
    await api.post("/expenses", { ...form, date });
    setForm({ title: "", amount: "", note: "" });
    setToast("Expense added");
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this expense?")) return;
    await api.delete(`/expenses/${id}`);
    load();
  };

  if (!data) return <Spinner />;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Daily Cost</h1>
        <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="card mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <input className="input sm:col-span-2" placeholder="Title (e.g. Vegetables)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input type="number" step="0.01" className="input" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <button className="btn-primary" onClick={add}>
            Add
          </button>
        </div>
        <input className="input mt-3" placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b p-3">
          <span className="font-semibold">Expenses on {date}</span>
          <span className="font-bold text-brand">{money(data.total)}</span>
        </div>
        {data.expenses.length === 0 ? (
          <Empty>No expenses recorded.</Empty>
        ) : (
          <div className="divide-y">
            {data.expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3">
                <div className="flex-1">
                  <p className="font-medium">{e.title}</p>
                  {e.note && <p className="text-xs text-gray-500">{e.note}</p>}
                </div>
                <span className="font-semibold">{money(e.amount)}</span>
                <button className="btn-outline btn-sm text-red-600" onClick={() => remove(e.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
