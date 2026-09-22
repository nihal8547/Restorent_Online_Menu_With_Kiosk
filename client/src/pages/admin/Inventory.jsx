import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api, money } from "../../api.js";
import { Spinner, Empty, Toast } from "../../components/ui.jsx";

// Inventory / stock management.
export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [adjust, setAdjust] = useState(null); // item being adjusted

  const load = useCallback(async () => {
    try {
      const inv = await api.get("/inventory");
      setItems(inv.data.items);
    } catch (e) {
      setToast("Failed to load inventory");
    } finally {
      setLoading(false);
    }
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

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Inventory Management</h1>
      </div>

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="card p-3">
          <p className="text-xs text-gray-500">Tracked items</p>
          <p className="mt-1 text-lg font-bold">{items.filter((i) => i.trackStock).length}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500">Low / out of stock</p>
          <p className={`mt-1 text-lg font-bold ${lowCount ? "text-orange-600" : "text-emerald-600"}`}>{lowCount}</p>
        </div>
      </div>

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
