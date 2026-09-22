import React, { useEffect, useState, useCallback, useRef } from "react";
import { api, money } from "../../api.js";
import { subscribeOrders } from "../../socket.js";
import { Spinner, Empty, StatusBadge, TypeBadge, Toast } from "../../components/ui.jsx";
import { printKOT } from "../../utils/kot.js";
import { useSettings } from "../../store/settings.js";

const NEXT = { NEW: "PREPARING", PREPARING: "READY", READY: "SERVED" };
const NEXT_LABEL = { NEW: "Start Preparing", PREPARING: "Mark Ready", READY: "Mark Served" };

export default function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("kot_autoprint") === "1");
  const autoPrintRef = useRef(autoPrint);
  useEffect(() => {
    autoPrintRef.current = autoPrint;
    localStorage.setItem("kot_autoprint", autoPrint ? "1" : "0");
  }, [autoPrint]);

  const load = useCallback(async () => {
    const { data } = await api.get("/orders", { params: { status: "NEW,PREPARING,READY", today: 1 } });
    setOrders(data.orders);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kot = (order) => {
    const ok = printKOT(order, useSettings.getState().shopName);
    if (!ok) setToast("Popup blocked — allow popups to print KOT");
  };

  // Realtime updates
  useEffect(() => {
    const upsert = (order) =>
      setOrders((prev) => {
        const others = prev.filter((o) => o.id !== order.id);
        const active = ["NEW", "PREPARING", "READY"].includes(order.status);
        return active ? [order, ...others] : others;
      });
    const onNew = (order) => {
      upsert(order);
      if (autoPrintRef.current) printKOT(order, useSettings.getState().shopName);
    };
    return subscribeOrders("kitchen", { onNew, onUpdated: upsert });
  }, []);

  const advance = async (order) => {
    const status = NEXT[order.status];
    if (!status) return;
    await api.patch(`/orders/${order.id}/status`, { status });
  };

  // Delivery-platform lifecycle action (external orders).
  const platformAction = async (order, action) => {
    try {
      await api.patch(`/orders/${order.id}/platform`, { action });
    } catch (e) {
      setToast(e.message);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Kitchen Display</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoPrint((v) => !v)}
            className={`btn-sm rounded-lg px-3 py-1.5 font-medium ${autoPrint ? "bg-emerald-600 text-white" : "border border-gray-300 bg-white text-gray-700"}`}
            title="Auto-print a KOT ticket when a new order arrives"
          >
            🖨 Auto-print KOT: {autoPrint ? "ON" : "OFF"}
          </button>
          <button className="btn-outline btn-sm" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {orders.length === 0 && <Empty>No active orders. New orders will appear here automatically.</Empty>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((o) => (
          <div key={o.id} className="card flex flex-col p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold">{o.orderNo}</span>
              <StatusBadge value={o.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <TypeBadge value={o.type} />
              {o.source !== "IN_HOUSE" && (
                <span className="badge bg-fuchsia-100 font-semibold text-fuchsia-700">
                  {o.source}
                  {o.platformRef ? ` · ${o.platformRef}` : ""}
                </span>
              )}
              {o.platformStatus && (
                <span className="badge bg-slate-100 text-slate-600">{o.platformStatus}</span>
              )}
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

            <div className="mt-3 flex flex-wrap gap-2">
              {o.source === "IN_HOUSE" ? (
                <>
                  {NEXT[o.status] && (
                    <button className="btn-primary btn-sm flex-1" onClick={() => advance(o)}>
                      {NEXT_LABEL[o.status]}
                    </button>
                  )}
                  <button className="btn-outline btn-sm" onClick={() => kot(o)} title="Print KOT">
                    🖨
                  </button>
                  {o.status !== "READY" && (
                    <button
                      className="btn-outline btn-sm"
                      onClick={() => api.patch(`/orders/${o.id}/status`, { status: "CANCELLED" })}
                    >
                      Cancel
                    </button>
                  )}
                </>
              ) : (
                /* Delivery-platform lifecycle actions */
                <>
                  {o.status === "NEW" && (
                    <>
                      <button className="btn-primary btn-sm flex-1" onClick={() => platformAction(o, "ACCEPT")}>
                        Accept
                      </button>
                      <button className="btn-outline btn-sm text-red-600" onClick={() => platformAction(o, "REJECT")}>
                        Reject
                      </button>
                    </>
                  )}
                  {o.status === "PREPARING" && (
                    <button className="btn-primary btn-sm flex-1" onClick={() => platformAction(o, "READY")}>
                      Mark Ready
                    </button>
                  )}
                  {o.status === "READY" && (
                    <button className="btn-primary btn-sm flex-1" onClick={() => platformAction(o, "PICKED_UP")}>
                      Picked Up
                    </button>
                  )}
                  <button className="btn-outline btn-sm" onClick={() => kot(o)} title="Print KOT">
                    🖨
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
