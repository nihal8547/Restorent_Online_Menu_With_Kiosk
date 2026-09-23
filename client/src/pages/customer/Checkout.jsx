import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, money } from "../../api.js";
import { useCart } from "../../store/cart.js";
import { Empty } from "../../components/ui.jsx";

export default function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();
  const table = JSON.parse(sessionStorage.getItem("ev_table") || "null");

  const forceMode = sessionStorage.getItem("ev_order_mode");
  const defaultType = table ? "DINE_IN" : (forceMode === "DELIVERY" ? "DELIVERY" : "TAKEAWAY");
  const [type, setType] = useState(defaultType);

  const availableModes = table 
    ? ["DINE_IN"] 
    : (forceMode === "DELIVERY" 
        ? ["DELIVERY"] 
        : ["DINE_IN", "TAKEAWAY", "DELIVERY"]);
  const [tableNo, setTableNo] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [delivery, setDelivery] = useState({
    name: "",
    phone: "",
    street: "",
    buildingNo: "",
    room: "",
    zone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const lastOrderToken = localStorage.getItem("ev_last_order");

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Empty>Your cart is empty.</Empty>
        <div className="flex flex-col gap-3 mt-6">
          {lastOrderToken && (
            <Link to={`/order-slip/${lastOrderToken}`} className="btn-outline w-full !text-brand !border-brand">
              View My Active Order
            </Link>
          )}
          <Link to={table ? `/t/${table.token}` : "/menu"} className="btn-primary w-full">
            Back to Menu
          </Link>
        </div>
      </div>
    );
  }

  const placeOrder = async () => {
    setErr("");
    setSubmitting(true);
    try {
      const payload = {
        type,
        cart: cart.items.map((i) => ({ menuItemId: i.menuItemId, qty: i.qty, note: i.note })),
        note,
        customerPhone: type === "DELIVERY" ? delivery.phone : phone,
      };
      if (type === "DINE_IN") {
        if (table) payload.tableToken = table.token; // QR scanned → auto table
        else payload.tableNo = tableNo.trim(); // manual table number
      }
      if (type === "DELIVERY") payload.delivery = delivery;

      const { data } = await api.post("/orders", payload);
      cart.clear();
      localStorage.setItem("ev_last_order", data.orderToken);
      
      // Remember phone for history convenience
      const savePhone = type === "DELIVERY" ? delivery.phone : phone;
      if (savePhone) localStorage.setItem("ev_phone", savePhone);
      // If it merged into the table's running bill, let the bill page announce it.
      navigate(`/order-slip/${data.orderToken}${data.merged ? "?merged=1" : ""}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    (type === "DINE_IN" && !table ? !!tableNo.trim() : true) &&
    (type !== "DELIVERY" ||
      (delivery.name && delivery.phone && delivery.street && delivery.buildingNo && delivery.zone));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 font-sans">
      <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <Link to={table ? `/t/${table.token}` : "/menu"} className="text-xs font-semibold text-brand hover:underline flex items-center gap-1">
            ← Back to Menu
          </Link>
          <h1 className="mt-1 text-2xl font-black text-slate-900 tracking-tight">Review Your Order</h1>
        </div>
        <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-extrabold text-brand">
          {cart.count()} {cart.count() === 1 ? "Item" : "Items"}
        </span>
      </div>

      <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
        {/* Left Side: Order Type & Contact / Delivery Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Order type Selection */}
          <div className="card p-5">
            <label className="label !text-xs !font-bold uppercase tracking-wider text-slate-600 mb-2.5">
              Select Dining Mode
            </label>
            <div className="flex gap-2">
              {availableModes.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`btn flex-1 !rounded-xl !py-2.5 font-bold transition text-xs sm:text-sm ${
                    type === t
                      ? "bg-brand text-white shadow-md shadow-brand/20"
                      : "border border-gray-200 bg-white text-slate-700 hover:bg-gray-50"
                  }`}
                >
                  {t === "DINE_IN" ? (table ? `Dine-in · T${table?.no}` : "Dine-in") : t === "TAKEAWAY" ? "Takeaway" : "Delivery"}
                </button>
              ))}
            </div>

            {/* QR scanned → table auto-fetched. No QR + dine-in → ask for table number. */}
            {type === "DINE_IN" && !table && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="label !text-xs !font-bold text-slate-700">Table Number *</label>
                <input
                  className="input !rounded-xl"
                  placeholder="e.g. 5"
                  value={tableNo}
                  onChange={(e) => setTableNo(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  New items for the same table are added to that table's running bill.
                </p>
              </div>
            )}
            {type === "DINE_IN" && table && (
              <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-medium">
                ✓ Table {table.no} auto-detected from QR · items will join this table's running bill.
              </div>
            )}
          </div>

          {/* Contact / delivery form */}
          <div className="card p-5">
            {type === "DELIVERY" ? (
              <div className="space-y-3.5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Delivery Address Details
                </h3>
                <div>
                  <label className="label !text-xs font-semibold">Full Name *</label>
                  <input className="input !rounded-xl" value={delivery.name} onChange={(e) => setDelivery({ ...delivery, name: e.target.value })} />
                </div>
                <div>
                  <label className="label !text-xs font-semibold">Phone Number *</label>
                  <input className="input !rounded-xl" value={delivery.phone} onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label !text-xs font-semibold">Street Address *</label>
                  <input className="input !rounded-xl" value={delivery.street} onChange={(e) => setDelivery({ ...delivery, street: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label !text-xs font-semibold">Building No *</label>
                    <input className="input !rounded-xl" value={delivery.buildingNo} onChange={(e) => setDelivery({ ...delivery, buildingNo: e.target.value })} />
                  </div>
                  <div>
                    <label className="label !text-xs font-semibold">Room / Apt (Optional)</label>
                    <input className="input !rounded-xl" value={delivery.room} onChange={(e) => setDelivery({ ...delivery, room: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label !text-xs font-semibold">Zone / District *</label>
                  <input className="input !rounded-xl" value={delivery.zone} onChange={(e) => setDelivery({ ...delivery, zone: e.target.value })} />
                </div>
              </div>
            ) : (
              <div>
                <label className="label !text-xs font-bold uppercase tracking-wider text-slate-700">
                  Phone Number (Optional - To View Bill Later)
                </label>
                <input className="input !rounded-xl" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 55512345" />
                <p className="text-[11px] text-gray-400 mt-1">Allows you to check payment status and order history anytime.</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="label !text-xs font-bold uppercase tracking-wider text-slate-700">
                Cooking Notes / Dietary Requests (Optional)
              </label>
              <textarea
                className="input !rounded-xl"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Less spicy, extra sauce, allergy info..."
              />
            </div>
          </div>
        </div>

        {/* Right Side: Order Items Summary & Checkout Card */}
        <div className="lg:col-span-5 mt-6 lg:mt-0">
          <div className="card p-5 sticky top-20 shadow-md">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 mb-3 pb-2 border-b border-gray-100 flex items-center justify-between">
              <span>Order Summary</span>
              <span className="text-xs font-bold text-gray-500">{cart.count()} items</span>
            </h3>

            {/* Items List */}
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto custom-scrollbar">
              {cart.items.map((i) => (
                <div key={i.menuItemId} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{i.name}</p>
                    <p className="text-xs text-gray-400">{money(i.price)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg p-0.5">
                    <button
                      className="h-6 w-6 flex items-center justify-center rounded-md bg-white text-xs font-bold text-gray-700 shadow-xs hover:bg-gray-50 active:scale-95 transition"
                      onClick={() => cart.setQty(i.menuItemId, i.qty - 1)}
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-slate-900">{i.qty}</span>
                    <button
                      className="h-6 w-6 flex items-center justify-center rounded-md bg-brand text-xs font-bold text-white shadow-xs hover:bg-brand-dark active:scale-95 transition"
                      onClick={() => cart.setQty(i.menuItemId, i.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                  <p className="w-16 text-right text-xs font-black text-slate-900">
                    {money(i.price * i.qty)}
                  </p>
                </div>
              ))}
            </div>

            {/* Subtotal */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-base font-extrabold text-slate-900">
              <span>Total Amount</span>
              <span className="text-brand text-lg">{money(cart.subtotal())}</span>
            </div>

            {err && <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs text-red-600 font-medium border border-red-200">{err}</p>}

            <button
              className="btn-primary mt-5 w-full !py-3 !rounded-xl font-bold shadow-lg shadow-brand/25 text-sm"
              disabled={!canSubmit || submitting}
              onClick={placeOrder}
            >
              {submitting ? "Placing order..." : `Confirm & Place Order · ${money(cart.subtotal())}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
