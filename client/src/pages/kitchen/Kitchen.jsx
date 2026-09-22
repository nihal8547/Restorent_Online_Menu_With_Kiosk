import React, { useEffect, useState, useCallback } from "react";
import { api, money } from "../../api.js";
import { subscribeOrders } from "../../socket.js";
import { Spinner, Empty, StatusBadge, TypeBadge } from "../../components/ui.jsx";

const NEXT = { NEW: "PREPARING", PREPARING: "READY", READY: "SERVED" };
const NEXT_LABEL = { NEW: "Start Preparing", PREPARING: "Mark Ready", READY: "Mark Served" };

export default function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await api.get("/orders", { params: { status: "NEW,PREPARING,READY", today: 1 } });
    setOrders(data.orders);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime updates
  useEffect(() => {
    const upsert = (order) =>
      setOrders((prev) => {
        const others = prev.filter((o) => o.id !== order.id);
        const active = ["NEW", "PREPARING", "READY"].includes(order.status);
        return active ? [order, ...others] : others;
      });
    return subscribeOrders("kitchen", { onNew: upsert, onUpdated: upsert });
  }, []);

  const advance = async (order) => {
    const status = NEXT[order.status];
    if (!status) return;
    await api.patch(`/orders/${order.id}/status`, { status });
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Kitchen Display</h1>
        <button className="btn-outline btn-sm" onClick={load}>
          Refresh
        </button>
      </div>

      {orders.length === 0 && <Empty>No active orders. New orders will appear here automatically.</Empty>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((o) => (
          <div key={o.id} className="card flex flex-col p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold">{o.orderNo}</span>
              <StatusBadge value={o.status} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <TypeBadge value={o.type} />
              {o.table && <span>Table {o.table.tableNo}</span>}
              {o.placedBy && <span>· by {o.placedBy.name}</span>}
            </div>

            <ul className="mt-3 flex-1 space-y-1 text-sm">
              {o.items.map((i) => (
                <li key={i.id}>
                  <span className="font-semibold">{i.qty}×</span> {i.name}
                  {i.note && <span className="block pl-5 text-xs text-amber-600">↳ {i.note}</span>}
                </li>
              ))}
            </ul>

            {o.note && <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-700">Note: {o.note}</p>}

            <p className="mt-2 text-xs text-gray-400">
              {new Date(o.createdAt).toLocaleTimeString()} · {money(o.total)}
            </p>

            <div className="mt-3 flex gap-2">
              {NEXT[o.status] && (
                <button className="btn-primary btn-sm flex-1" onClick={() => advance(o)}>
                  {NEXT_LABEL[o.status]}
                </button>
              )}
              {o.status !== "READY" && (
                <button
                  className="btn-outline btn-sm"
                  onClick={() => api.patch(`/orders/${o.id}/status`, { status: "CANCELLED" })}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
