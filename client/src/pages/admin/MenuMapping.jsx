import React, { useEffect, useState, useCallback } from "react";
import { api } from "../../api.js";
import { Spinner, Empty, Toast } from "../../components/ui.jsx";

// Admin → Menu Mapping: map each menu item to each delivery platform's SKU/PLU.
export default function MenuMapping() {
  const [platforms, setPlatforms] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState("");
  const [failed, setFailed] = useState([]);

  const load = useCallback(async () => {
    const [m, f] = await Promise.all([
      api.get("/mapping"),
      api.get("/mapping/failed").catch(() => ({ data: { rows: [] } })),
    ]);
    setPlatforms(m.data.platforms);
    setItems(m.data.items);
    setFailed(f.data.rows || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setLocal = (itemId, platform, sku) =>
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, skus: { ...it.skus, [platform]: sku } } : it)));

  const save = async (itemId, platform, sku, original) => {
    if ((sku || "") === (original || "")) return; // no change
    const key = `${itemId}:${platform}`;
    setSaving(key);
    try {
      await api.put("/mapping", { platform, menuItemId: itemId, sku });
      setToast(sku ? `Saved ${platform} SKU` : `Cleared ${platform} SKU`);
    } catch (e) {
      setToast(e.message);
      setLocal(itemId, platform, original || ""); // revert on error
    } finally {
      setSaving("");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200/80 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Delivery Menu Mapping</h1>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
          Enter each platform's product code (SKU / PLU) for your items. Incoming delivery orders are matched to
          your menu using these codes. Leave blank if an item isn't listed on that platform.
        </p>
      </div>

      {failed.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠ {failed.length} delivery order(s) could not be matched (unmapped SKUs). Add the missing codes below —
          the platform will retry, or contact them to resend.
        </div>
      )}

      {items.length === 0 ? (
        <Empty>No menu items yet.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 p-3">Menu Item</th>
                {platforms.map((p) => (
                  <th key={p} className="p-3">
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 bg-white p-3">
                    <p className="font-medium text-slate-900">{it.name}</p>
                    <p className="text-[11px] text-slate-400">{it.category}</p>
                  </td>
                  {platforms.map((p) => {
                    const val = it.skus[p] || "";
                    const key = `${it.id}:${p}`;
                    return (
                      <td key={p} className="p-2">
                        <input
                          className={`input text-xs ${it.skus[p] ? "border-emerald-300 bg-emerald-50/40" : ""}`}
                          placeholder="SKU / PLU"
                          defaultValue={val}
                          disabled={saving === key}
                          onBlur={(e) => save(it.id, p, e.target.value.trim(), val)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Tip: SKUs are saved automatically when you click out of a field. Each SKU must be unique per platform.
      </p>

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
