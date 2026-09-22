import React, { useEffect, useState, useMemo } from "react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  const displayedCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => item.name.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, searchQuery]);

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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">New Order</h1>
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full pl-9 py-2"
            />
            <span className="absolute left-3 top-2.5 text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1.5 text-xl font-bold text-gray-400 hover:text-gray-600"
              >&times;</button>
            )}
          </div>
        </div>
        <div className="space-y-5">
          {displayedCategories.length === 0 && (
            <p className="py-10 text-center text-gray-500">No items found.</p>
          )}
          {displayedCategories.map((cat) => (
            <section key={cat.id}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">{cat.name}</h2>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
                {cat.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => add(item)}
                    className="card flex overflow-hidden text-left hover:border-brand transition-colors"
                  >
                    <div className="h-16 w-16 shrink-0 bg-slate-900 relative">
                      {item.photoUrl ? (
                        <img
                          src={item.photoUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div className={`absolute inset-0 items-center justify-center bg-gradient-to-br from-ink to-ink-soft text-white ${item.photoUrl ? "hidden" : "flex"}`}>
                        <span className="text-xl opacity-80">🍲</span>
                      </div>
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{cat.name}</p>
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-medium line-clamp-2 leading-tight">{item.name}</span>
                        <span className="text-sm font-semibold text-brand shrink-0">{money(item.price)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Cart / ticket */}
      <div className={`lg:sticky lg:top-20 lg:self-start ${cartOpen ? "fixed inset-0 z-50 flex flex-col justify-end bg-black/60 sm:items-center sm:justify-center p-0 sm:p-4 lg:p-0 lg:bg-transparent lg:block" : "hidden lg:block"}`}>
        {cartOpen && <div className="absolute inset-0 lg:hidden" onClick={() => setCartOpen(false)} />}
        <div className="card w-full max-w-md p-5 bg-white max-h-[85vh] overflow-y-auto relative animate-fade-up lg:animate-none rounded-t-3xl sm:rounded-2xl lg:rounded-2xl z-10">
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <h2 className="font-bold text-lg">Current Order</h2>
            <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-gray-800 font-bold text-2xl">&times;</button>
          </div>

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

      {/* Floating button on mobile */}
      {totalItems > 0 && !cartOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white p-4 border-t shadow-[0_-10px_20px_rgba(0,0,0,0.1)] lg:hidden">
          <button 
            className="btn-primary w-full flex items-center justify-between px-5 py-3 shadow-md"
            onClick={() => setCartOpen(true)}
          >
            <span className="font-bold text-brand bg-white px-2 py-0.5 rounded-full text-sm shadow-sm">{totalItems} items</span>
            <span className="font-bold tracking-wide text-white">View Order</span>
            <span className="font-bold text-white">{money(subtotal)}</span>
          </button>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
