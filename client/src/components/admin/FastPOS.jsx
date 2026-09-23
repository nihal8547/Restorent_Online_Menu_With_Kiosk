import React, { useEffect, useState, useMemo } from "react";
import { api, money } from "../../api.js";
import { Spinner, Toast } from "../ui.jsx";
import { ShoppingCart, UtensilsCrossed } from "lucide-react";

export default function FastPOS({ onClose, onComplete }) {
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [tableId, setTableId] = useState("");
  const [type, setType] = useState("TAKEAWAY");
  const [cart, setCart] = useState([]); // [{menuItemId,name,price,qty}]
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [taxRate, setTaxRate] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [menuRes, tableRes, settingsRes] = await Promise.all([
          api.get("/menu"),
          api.get("/tables/for-order").catch(() => ({ data: { tables: [] } })),
          api.get("/settings").catch(() => ({ data: { taxRate: 0 } }))
        ]);
        setCategories(menuRes.data.categories || []);
        setTables(tableRes.data.tables || []);
        setTaxRate(Number(settingsRes.data.taxRate || 0));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
  const tax = Number((subtotal * (taxRate / 100)).toFixed(2));
  const total = subtotal + tax;

  const handleCheckout = async (paymentMode) => {
    if (cart.length === 0) return setToast("Add at least one item");
    if (type === "DINE_IN" && !tableId) return setToast("Select a table");
    
    setSubmitting(true);
    try {
      const { data } = await api.post("/orders/staff", {
        type,
        tableId: type === "DINE_IN" ? Number(tableId) : undefined,
        cart: cart.map((i) => ({ menuItemId: i.menuItemId, qty: i.qty })),
      });
      
      const order = data.order;
      
      if (paymentMode !== "UNPAID") {
        await api.post(`/payments`, {
          orderId: order.id,
          amount: total,
          mode: paymentMode,
          discount: 0
        });
      }

      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = `/bill/${order.orderToken}?autoprint=1`;
      document.body.appendChild(iframe);
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 10000);

      onComplete();
    } catch (e) {
      setToast(e.message || "Checkout failed");
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="h-full bg-slate-50 flex flex-col animate-fade-in">
      {/* Main Grid */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Menu Section */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full max-w-5xl mx-auto">
            <button onClick={onClose} className="btn-outline !py-2 !px-3 shadow-sm flex items-center gap-2 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Billing</span>
            </button>
            <div className="relative flex-1 w-full max-w-md">
              <input
                type="text"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input !py-2 pl-9 bg-white shadow-sm text-sm w-full"
              />
              <span className="absolute left-3 top-2.5 text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-2 text-slate-400 hover:text-slate-700 font-bold">
                  &times;
                </button>
              )}
            </div>
          </div>

          {displayedCategories.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <p>No items found</p>
            </div>
          )}
          <div className="space-y-6 max-w-5xl mx-auto">
            {displayedCategories.map((cat) => (
              <section key={cat.id}>
                <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">{cat.name}</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {cat.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => add(item)}
                      className="card flex flex-col overflow-hidden text-left hover:border-brand transition-all hover:shadow-md active:scale-95 bg-white group"
                    >
                      <div className="h-24 w-full bg-slate-100 relative overflow-hidden">
                        {item.photoUrl ? (
                          <img
                            src={item.photoUrl}
                            alt={item.name}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => { e.target.style.display = "none"; }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-slate-400">
                            <UtensilsCrossed className="w-6 h-6 opacity-80" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 flex-1 flex flex-col justify-between">
                        <span className="font-semibold text-sm leading-tight text-slate-800 line-clamp-2 mb-1">{item.name}</span>
                        <span className="text-sm font-black text-brand">{money(item.price)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Right Sidebar - Cart */}
        <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shadow-[-4px_0_15px_rgba(0,0,0,0.03)] z-10 relative lg:h-full lg:shrink-0">
          <div className="p-4 border-b border-slate-100 shrink-0">
            <h2 className="font-extrabold text-lg text-slate-800 mb-3">Current Bill</h2>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
              {["TAKEAWAY", "DINE_IN"].map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    type === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t === "DINE_IN" ? "Dine-In" : "Takeaway"}
                </button>
              ))}
            </div>
            {type === "DINE_IN" && (
              <div className="mt-3">
                <select className="input !py-2 text-sm font-medium bg-slate-50" value={tableId} onChange={(e) => setTableId(e.target.value)}>
                  <option value="">-- Select Table --</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>Table {t.tableNo}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-[150px] max-h-[40vh] lg:max-h-none">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <ShoppingCart className="w-10 h-10 mb-2 opacity-50" />
                <p className="font-medium text-sm">Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((i) => (
                  <div key={i.menuItemId} className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 transition">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-sm text-slate-800 flex-1">{i.name}</span>
                      <span className="font-bold text-sm text-slate-900 ml-2">{money(i.price * i.qty)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <button className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold transition" onClick={() => setQty(i.menuItemId, i.qty - 1)}>−</button>
                        <span className="w-6 text-center text-xs font-bold">{i.qty}</span>
                        <button className="px-2.5 py-1 text-brand hover:bg-brand/10 font-bold transition" onClick={() => setQty(i.menuItemId, i.qty + 1)}>+</button>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">@ {money(i.price)} each</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
            <div className="space-y-1.5 mb-4 text-sm font-medium">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="text-slate-800">{money(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Tax ({taxRate}%)</span>
                  <span className="text-slate-800">{money(tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200 mt-2">
                <span>Total Due</span>
                <span className="text-brand text-lg">{money(total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={submitting || cart.length === 0}
                  className="btn bg-emerald-600 text-white hover:bg-emerald-700 !py-2.5 shadow-md shadow-emerald-600/20 disabled:shadow-none"
                  onClick={() => handleCheckout("CASH")}
                >
                  CASH
                </button>
                <button
                  disabled={submitting || cart.length === 0}
                  className="btn bg-blue-600 text-white hover:bg-blue-700 !py-2.5 shadow-md shadow-blue-600/20 disabled:shadow-none"
                  onClick={() => handleCheckout("CARD")}
                >
                  CARD
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={submitting || cart.length === 0}
                  className="btn bg-purple-600 text-white hover:bg-purple-700 !py-2.5 shadow-md shadow-purple-600/20 disabled:shadow-none"
                  onClick={() => handleCheckout("ONLINE")}
                >
                  ONLINE
                </button>
                <button
                  disabled={submitting || cart.length === 0}
                  className="btn-outline !py-2.5 border-slate-300 text-slate-700"
                  onClick={() => handleCheckout("UNPAID")}
                  title="Send to kitchen without payment"
                >
                  Hold Unpaid
                </button>
              </div>
            </div>
            
            {submitting && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center">
                <Spinner />
              </div>
            )}
          </div>
        </div>
      </div>
      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
