import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, money } from "../../api.js";
import { Spinner, Toast } from "../../components/ui.jsx";

// Waiter takes an order at a table and places it.
export default function WaiterOrder() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableId, setTableId] = useState("");
  const [type, setType] = useState("DINE_IN");
  const [cart, setCart] = useState([]); // [{menuItemId,name,price,qty}]
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [menuRes, tableRes] = await Promise.all([
        api.get("/menu"),
        api.get("/tables/for-order").catch(() => ({ data: { tables: [] } })),
      ]);
      setCategories(menuRes.data.categories);
      setTables(tableRes.data.tables);
      setLoading(false);
    })();
  }, []);

  const add = (item) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.menuItemId === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: Number(item.price), qty: 1 }];
    });
  };
  const setQty = (id, qty) =>
    setCart((prev) => prev.map((i) => (i.menuItemId === id ? { ...i, qty } : i)).filter((i) => i.qty > 0));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const place = async () => {
    if (cart.length === 0) return setToast("Add at least one item");
    if (type === "DINE_IN" && !tableId) return setToast("Select a table");
    setSubmitting(true);
    try {
      const { data } = await api.post("/orders/staff", {
        type,
        tableId: type === "DINE_IN" ? Number(tableId) : undefined,
        cart: cart.map((i) => ({ menuItemId: i.menuItemId, qty: i.qty })),
        note,
      });
      setToast(data.merged ? "Added to table's running bill ✓" : "Order placed ✓");
      setCart([]);
      setNote("");
      setTimeout(() => navigate("/waiter/orders"), 600);
    } catch (e) {
      setToast(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Menu */}
      <div className="lg:col-span-2">
        <h1 className="mb-3 text-xl font-bold">New Order</h1>
        <div className="space-y-5">
          {categories.map((cat) => (
            <section key={cat.id}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">{cat.name}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {cat.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => add(item)}
                    className="card flex items-center justify-between p-3 text-left hover:border-brand"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm font-semibold text-brand">{money(item.price)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Cart / ticket */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="card p-4">
          <div className="mb-3">
            <label className="label">Order type</label>
            <div className="flex gap-2">
              {["DINE_IN", "TAKEAWAY"].map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`btn flex-1 btn-sm ${type === t ? "bg-brand text-white" : "border border-gray-300 bg-white"}`}
                >
                  {t === "DINE_IN" ? "Dine-in" : "Takeaway"}
                </button>
              ))}
            </div>
          </div>

          {type === "DINE_IN" && (
            <div className="mb-3">
              <label className="label">Table</label>
              <select className="input" value={tableId} onChange={(e) => setTableId(e.target.value)}>
                <option value="">Select table</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Table {t.tableNo}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="max-h-72 divide-y overflow-auto">
            {cart.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No items yet</p>}
            {cart.map((i) => (
              <div key={i.menuItemId} className="flex items-center gap-2 py-2 text-sm">
                <span className="flex-1">{i.name}</span>
                <button className="btn-outline btn-sm h-6 w-6 !px-0" onClick={() => setQty(i.menuItemId, i.qty - 1)}>−</button>
                <span className="w-5 text-center">{i.qty}</span>
                <button className="btn-outline btn-sm h-6 w-6 !px-0" onClick={() => setQty(i.menuItemId, i.qty + 1)}>+</button>
                <span className="w-16 text-right font-semibold">{money(i.price * i.qty)}</span>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="mt-3 flex justify-between font-bold">
            <span>Total</span>
            <span className="text-brand">{money(subtotal)}</span>
          </div>

          <button className="btn-primary mt-3 w-full" disabled={submitting} onClick={place}>
            {submitting ? "Placing..." : "Place Order"}
          </button>
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
