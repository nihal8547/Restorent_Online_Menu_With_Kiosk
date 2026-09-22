import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api, money } from "../../api.js";
import { Spinner, Empty, Toast } from "../../components/ui.jsx";

// Inventory / stock management + total sale counts per item.
export default function Inventory() {
  const [items, setItems] = useState([]);
  const [sales, setSales] = useState({}); // menuItemId -> { soldQty, revenue }
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState("stock"); // stock | sales
  const [adjust, setAdjust] = useState(null); // item being adjusted

  const load = useCallback(async () => {
    const [inv, top] = await Promise.all([
      api.get("/inventory"),
      api.get("/reports/top-items").catch(() => ({ data: { rows: [] } })),
    ]);
    setItems(inv.data.items);
    const map = {};
    top.data.rows.forEach((r) => (map[r.menuItemId] = r));
    setSales(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleTrack = async (it) => {
    await api.put(`/inventory/${it.id}/config`, { trackStock: !it.trackStock });
    load();
  };

  const saveAdjust = async () => {
    const { id, change, reason, note } = adjust;
    const n = parseInt(change, 10);
    if (!n) return setToast("Enter a non-zero quantity");
    try {
      await api.post(`/inventory/${id}/adjust`, { change: n, reason, note });
      setToast("Stock updated ✓");
      setAdjust(null);
      load();
    } catch (e) {
      setToast(e.message);
    }
  };

  const lowCount = useMemo(() => items.filter((i) => i.low).length, [items]);
  const totalSold = useMemo(
    () => Object.values(sales).reduce((s, r) => s + r.soldQty, 0),
    [sales]
  );

  // Sales-sorted list for the Sales tab.
  const salesRows = useMemo(() => {
    return items
      .map((i) => ({ ...i, ...(sales[i.id] || { soldQty: 0, revenue: 0 }) }))
      .sort((a, b) => b.soldQty - a.soldQty);
  }, [items, sales]);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Inventory & Sales</h1>
        <div className="flex gap-1">
          {[
            ["stock", "Stock"],
            ["sales", "Sale Count"],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-brand text-white" : "border border-gray-300 bg-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="card p-3">
          <p className="text-xs text-gray-500">Tracked items</p>
          <p className="mt-1 text-lg font-bold">{items.filter((i) => i.trackStock).length}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500">Low / out of stock</p>
          <p className={`mt-1 text-lg font-bold ${lowCount ? "text-orange-600" : "text-emerald-600"}`}>{lowCount}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500">Total units sold</p>
          <p className="mt-1 text-lg font-bold text-brand">{totalSold}</p>
        </div>
      </div>

      {tab === "stock" ? (
        <div className="card divide-y">
          {items.length === 0 && <Empty>No menu items.</Empty>}
          {items.map((it) => (
            <div key={it.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {it.name}
                    {it.out && <span className="badge ml-2 bg-red-100 text-red-700">Out</span>}
                    {!it.out && it.low && <span className="badge ml-2 bg-orange-100 text-orange-700">Low</span>}
                  </p>
                  <p className="text-xs text-gray-500">{it.category}</p>
                </div>
                <div className="text-right">
                  {it.trackStock ? (
                    <p className={`text-lg font-bold ${it.out ? "text-red-600" : it.low ? "text-orange-600" : "text-gray-900"}`}>
                      {it.stockQty}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">not tracked</p>
                  )}
                  <p className="text-[11px] text-gray-400">sold {sales[it.id]?.soldQty || 0}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-outline btn-sm" onClick={() => toggleTrack(it)}>
                  {it.trackStock ? "Stop tracking" : "Track stock"}
                </button>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => setAdjust({ id: it.id, name: it.name, change: "", reason: "RESTOCK", note: "" })}
                >
                  + Restock
                </button>
                <button
                  className="btn-outline btn-sm"
                  onClick={() => setAdjust({ id: it.id, name: it.name, change: "", reason: "WASTE", note: "" })}
                >
                  − Waste / Adjust
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[340px] text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="p-3">#</th>
                <th className="p-3">Item</th>
                <th className="p-3 text-right">Total Sold</th>
                <th className="p-3 text-right">Revenue</th>
                <th className="p-3 text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {salesRows.map((r, idx) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-3 text-gray-400">{idx + 1}</td>
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-right font-bold text-brand">{r.soldQty}</td>
                  <td className="p-3 text-right">{money(r.revenue)}</td>
                  <td className="p-3 text-right">{r.trackStock ? r.stockQty : "—"}</td>
                </tr>
              ))}
              {salesRows.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <Empty>No sales yet.</Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust modal */}
      {adjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-sm p-5">
            <h3 className="text-lg font-bold">
              {adjust.reason === "RESTOCK" ? "Restock" : "Adjust"} · {adjust.name}
            </h3>
            <div className="mt-3 space-y-3">
              <div>
                <label className="label">
                  Quantity {adjust.reason === "RESTOCK" ? "to add (+)" : "change (use − to remove)"}
                </label>
                <input
                  type="number"
                  className="input"
                  placeholder={adjust.reason === "RESTOCK" ? "e.g. 20" : "e.g. -3"}
                  value={adjust.change}
                  onChange={(e) => setAdjust({ ...adjust, change: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Reason</label>
                <select className="input" value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}>
                  <option value="RESTOCK">Restock (new delivery)</option>
                  <option value="ADJUST">Adjustment / correction</option>
                  <option value="WASTE">Waste / spoilage</option>
                </select>
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <input className="input" value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setAdjust(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={saveAdjust}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
