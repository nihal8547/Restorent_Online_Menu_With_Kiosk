import React, { useEffect, useState, useCallback } from "react";
import { api, money } from "../../api.js";
import { subscribeOrders } from "../../socket.js";
import { Spinner, Empty, StatusBadge, TypeBadge } from "../../components/ui.jsx";

// Orders placed by this waiter, with live status.
export default function WaiterOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await api.get("/orders", { params: { mine: 1, today: 1 } });
    setOrders(data.orders);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const upsert = (order) =>
      setOrders((prev) => {
        if (!prev.some((o) => o.id === order.id)) return prev; // only my orders
        return prev.map((o) => (o.id === order.id ? order : o));
      });
    return subscribeOrders("waiters", { onUpdated: upsert });
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">My Orders (today)</h1>
        <button className="btn-outline btn-sm" onClick={load}>
          Refresh
        </button>
      </div>

      {orders.length === 0 && <Empty>You haven't placed any orders today.</Empty>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((o) => (
          <div key={o.id} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold">{o.orderNo}</span>
              <StatusBadge value={o.status} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <TypeBadge value={o.type} />
              {o.table && <span>Table {o.table.tableNo}</span>}
              <StatusBadge value={o.paymentStatus} />
            </div>
            <ul className="mt-2 text-sm text-gray-700">
              {o.items.map((i) => (
                <li key={i.id}>
                  {i.qty}× {i.name}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-right font-semibold text-brand">{money(o.total)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
