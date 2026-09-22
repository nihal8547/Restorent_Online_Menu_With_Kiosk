import React, { useEffect, useState, useCallback } from "react";
import { api, money } from "../../api.js";
import { subscribeOrders } from "../../socket.js";
import { Spinner, Empty, StatusBadge, TypeBadge, Toast } from "../../components/ui.jsx";

export default function Billing() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING"); // PENDING | ALL
  const [active, setActive] = useState(null); // order being paid
  const [pay, setPay] = useState({ mode: "CASH", discount: 0 });
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const params = { today: 1 };
    if (filter === "PENDING") params.paymentStatus = "PENDING";
    const { data } = await api.get("/orders", { params });
    setOrders(data.orders);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refresh = () => load();
    return subscribeOrders("admin", { onNew: refresh, onUpdated: refresh });
  }, [load]);

  const openPay = (o) => {
    setActive(o);
    setPay({ mode: "CASH", discount: Number(o.discount) || 0 });
  };

  const total = active ? Math.max(0, Number(active.subtotal) + Number(active.tax) - Number(pay.discount || 0)) : 0;

  const collect = async () => {
    try {
      await api.post("/payments", {
        orderId: active.id,
        amount: total,
        mode: pay.mode,
        discount: Number(pay.discount || 0),
      });
      setToast("Payment collected ✓");
      setActive(null);
      load();
    } catch (e) {
      setToast(e.message);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Billing</h1>
        <div className="flex gap-1">
          {["PENDING", "ALL"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn-sm rounded-lg px-3 py-1.5 ${filter === f ? "bg-brand text-white" : "border border-gray-300 bg-white"}`}
            >
              {f === "PENDING" ? "Unpaid" : "All today"}
            </button>
          ))}
        </div>
      </div>

      {orders.length === 0 && <Empty>No orders.</Empty>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((o) => (
          <div key={o.id} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold">{o.orderNo}</span>
              <StatusBadge value={o.paymentStatus} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <TypeBadge value={o.type} />
              {o.table && <span>Table {o.table.tableNo}</span>}
              <StatusBadge value={o.status} />
            </div>
            {o.deliveryInfo && (
              <p className="mt-1 text-xs text-gray-500">
                🛵 {o.deliveryInfo.name}, {o.deliveryInfo.street}, Bldg {o.deliveryInfo.buildingNo}
                {o.deliveryInfo.room ? `, Room ${o.deliveryInfo.room}` : ""} · {o.deliveryInfo.zone} ·{" "}
                {o.deliveryInfo.phone}
              </p>
            )}
            <ul className="mt-2 text-sm text-gray-700">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>
                    {i.qty}× {i.name}
                  </span>
                  <span>{money(Number(i.price) * i.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t pt-2">
              <span className="font-bold text-brand">{money(o.total)}</span>
              {o.paymentStatus === "PENDING" ? (
                <button className="btn-primary btn-sm" onClick={() => openPay(o)}>
                  Collect Payment
                </button>
              ) : (
                <span className="text-xs text-emerald-600">Paid</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Payment modal */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-sm p-5">
            <h3 className="text-lg font-bold">Collect Payment · {active.orderNo}</h3>
            <div className="mt-3 space-y-1 text-sm">
              <Row label="Subtotal" value={money(active.subtotal)} />
              {Number(active.tax) > 0 && <Row label="Tax" value={money(active.tax)} />}
              <div>
                <label className="label mt-2">Discount</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={pay.discount}
                  onChange={(e) => setPay({ ...pay, discount: e.target.value })}
                />
              </div>
              <div>
                <label className="label mt-2">Payment mode</label>
                <div className="flex gap-2">
                  {["CASH", "CARD", "ONLINE"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setPay({ ...pay, mode: m })}
                      className={`btn flex-1 btn-sm ${pay.mode === m ? "bg-brand text-white" : "border border-gray-300 bg-white"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex justify-between border-t pt-2 text-base font-bold">
                <span>Total</span>
                <span className="text-brand">{money(total)}</span>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setActive(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={collect}>
                Mark Paid
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-gray-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
