import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../../api.js";
import { Empty } from "../../components/ui.jsx";

// Customer order history — shows ONLY paid orders for a phone number.
export default function History() {
  const [phone, setPhone] = useState(localStorage.getItem("ev_phone") || "");
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const search = async (e) => {
    e?.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get(`/bill/history/${encodeURIComponent(phone.trim())}`);
      setOrders(data.orders);
      localStorage.setItem("ev_phone", phone.trim());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Link to="/menu" className="text-sm text-gray-500 underline">
        ← Menu
      </Link>
      <h1 className="mt-2 text-xl font-bold">My Order History</h1>
      <p className="text-sm text-gray-500">Enter your phone number to see your paid orders.</p>

      <form onSubmit={search} className="mt-4 flex gap-2">
        <input
          className="input"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button className="btn-primary" disabled={loading}>
          {loading ? "..." : "View"}
        </button>
      </form>

      {err && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{err}</p>}

      {orders && (
        <div className="mt-5 space-y-3">
          {orders.length === 0 && <Empty>No paid orders found for this number.</Empty>}
          {orders.map((o) => (
            <Link
              to={`/order/${o.orderToken}`}
              key={o.orderToken}
              className="card block p-4 hover:border-brand"
            >
              <div className="flex justify-between">
                <span className="font-semibold">{o.orderNo}</span>
                <span className="font-semibold text-brand">{money(o.total)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {new Date(o.paidAt || o.createdAt).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
