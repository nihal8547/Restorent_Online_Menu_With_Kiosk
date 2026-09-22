import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, money } from "../../api.js";
import { useCart } from "../../store/cart.js";
import { Empty } from "../../components/ui.jsx";

export default function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();
  const table = JSON.parse(sessionStorage.getItem("ev_table") || "null");

  const [type, setType] = useState(table ? "DINE_IN" : "TAKEAWAY");
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

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Empty>Your cart is empty.</Empty>
        <Link to={table ? `/t/${table.token}` : "/menu"} className="btn-primary w-full">
          Back to Menu
        </Link>
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
      if (type === "DINE_IN") payload.tableToken = table?.token;
      if (type === "DELIVERY") payload.delivery = delivery;

      const { data } = await api.post("/orders", payload);
      cart.clear();
      // Remember phone for history convenience
      const savePhone = type === "DELIVERY" ? delivery.phone : phone;
      if (savePhone) localStorage.setItem("ev_phone", savePhone);
      navigate(`/order/${data.orderToken}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    type !== "DELIVERY" ||
    (delivery.name && delivery.phone && delivery.street && delivery.buildingNo && delivery.zone);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Link to={table ? `/t/${table.token}` : "/menu"} className="text-sm text-gray-500 underline">
        ← Back to menu
      </Link>
      <h1 className="mt-2 text-xl font-bold">Your Order</h1>

      {/* Items */}
      <div className="card mt-3 divide-y">
        {cart.items.map((i) => (
          <div key={i.menuItemId} className="flex items-center gap-3 p-3">
            <div className="flex-1">
              <p className="font-medium">{i.name}</p>
              <p className="text-xs text-gray-500">{money(i.price)} each</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-outline btn-sm h-7 w-7 !px-0" onClick={() => cart.setQty(i.menuItemId, i.qty - 1)}>−</button>
              <span className="w-5 text-center text-sm">{i.qty}</span>
              <button className="btn-outline btn-sm h-7 w-7 !px-0" onClick={() => cart.setQty(i.menuItemId, i.qty + 1)}>+</button>
            </div>
            <p className="w-16 text-right text-sm font-semibold">{money(i.price * i.qty)}</p>
          </div>
        ))}
        <div className="flex justify-between p-3 font-semibold">
          <span>Subtotal</span>
          <span>{money(cart.subtotal())}</span>
        </div>
      </div>

      {/* Order type */}
      <div className="mt-5">
        <label className="label">Order type</label>
        <div className="flex gap-2">
          {(table ? ["DINE_IN"] : ["TAKEAWAY", "DELIVERY"]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`btn flex-1 ${type === t ? "bg-brand text-white" : "border border-gray-300 bg-white"}`}
            >
              {t === "DINE_IN" ? `Dine-in · T${table?.no}` : t === "TAKEAWAY" ? "Takeaway" : "Delivery"}
            </button>
          ))}
        </div>
      </div>

      {/* Contact / delivery */}
      {type === "DELIVERY" ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold">Delivery details</p>
          <div>
            <label className="label">Name *</label>
            <input className="input" value={delivery.name} onChange={(e) => setDelivery({ ...delivery, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone *</label>
            <input className="input" value={delivery.phone} onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Street *</label>
            <input className="input" value={delivery.street} onChange={(e) => setDelivery({ ...delivery, street: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Building No *</label>
              <input className="input" value={delivery.buildingNo} onChange={(e) => setDelivery({ ...delivery, buildingNo: e.target.value })} />
            </div>
            <div>
              <label className="label">Room (optional)</label>
              <input className="input" value={delivery.room} onChange={(e) => setDelivery({ ...delivery, room: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Zone *</label>
            <input className="input" value={delivery.zone} onChange={(e) => setDelivery({ ...delivery, zone: e.target.value })} />
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <label className="label">Phone (to view your bill later)</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
        </div>
      )}

      <div className="mt-4">
        <label className="label">Note (optional)</label>
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {err && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{err}</p>}

      <button className="btn-primary mt-5 w-full" disabled={!canSubmit || submitting} onClick={placeOrder}>
        {submitting ? "Placing order..." : `Place Order · ${money(cart.subtotal())}`}
      </button>
    </div>
  );
}
