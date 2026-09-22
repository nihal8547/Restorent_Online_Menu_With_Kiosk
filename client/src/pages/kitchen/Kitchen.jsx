import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { api, money, simulatePartnerOrders } from "../../api.js";
import { subscribeOrders } from "../../socket.js";
import { Spinner, Empty, StatusBadge, TypeBadge, PlatformBadge, Toast } from "../../components/ui.jsx";
import { printKOT } from "../../utils/kot.js";
import { useSettings } from "../../store/settings.js";
import { Sparkles, MapPin, Phone, User, Clock, AlertCircle } from "lucide-react";

const NEXT = { NEW: "PREPARING", PREPARING: "READY", READY: "SERVED" };
const NEXT_LABEL = { NEW: "Start Preparing", PREPARING: "Mark Ready", READY: "Mark Served" };

const CHANNELS = [
  { id: "ALL", label: "All Orders" },
  { id: "IN_HOUSE", label: "In-House" },
  { id: "TALABAT", label: "Talabat", color: "bg-[#FF5A00] text-white" },
  { id: "SNOONU", label: "Snoonu", color: "bg-[#E30613] text-white" },
  { id: "KEETA", label: "Keeta", color: "bg-[#FFD100] text-slate-950 font-black" },
  { id: "RAFEEQ", label: "Rafeeq", color: "bg-[#059669] text-white" },
  { id: "DELIVEROO", label: "Deliveroo", color: "bg-[#00CDBC] text-slate-950 font-black" },
];

export default function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [simulating, setSimulating] = useState(false);
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("kot_autoprint") === "1");
  const autoPrintRef = useRef(autoPrint);

  useEffect(() => {
    autoPrintRef.current = autoPrint;
    localStorage.setItem("kot_autoprint", autoPrint ? "1" : "0");
  }, [autoPrint]);

  const load = useCallback(async () => {
    const { data } = await api.get("/orders", { params: { status: "NEW,PREPARING,READY", today: 1 } });
    setOrders(data.orders || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kot = (order) => {
    const ok = printKOT(order, useSettings.getState().shopName);
    if (!ok) setToast("Popup blocked — allow popups to print KOT");
  };

  // Realtime updates via socket
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
      const { data } = await api.patch(`/orders/${order.id}/platform`, { action });
      const ob = data.outbound;
      if (ob && !ob.ok && !ob.skipped) {
        setToast(`${order.source}: status updated locally, but platform push failed (${ob.error || ob.httpStatus})`);
      }
      load();
    } catch (e) {
      setToast(e.message);
    }
  };

  // Simulate orders from all online partners
  const simulateOrders = async (platform = "ALL") => {
    setSimulating(true);
    try {
      const data = await simulatePartnerOrders(platform);
      setToast(data.message || `Simulated ${data.count} partner orders!`);
      await load();
    } catch (e) {
      setToast(e.message || "Failed to simulate partner orders");
    } finally {
      setSimulating(false);
    }
  };

  // Filter orders by selected channel
  const filteredOrders = useMemo(() => {
    if (channelFilter === "ALL") return orders;
    if (channelFilter === "IN_HOUSE") return orders.filter((o) => !o.source || o.source === "IN_HOUSE");
    return orders.filter((o) => o.source === channelFilter);
  }, [orders, channelFilter]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Kitchen Display &amp; KOT</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live order tickets for kitchen prep, delivery partners, and thermal dispatch</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Simulate Button */}
          <button
            onClick={() => simulateOrders("ALL")}
            disabled={simulating}
            className="btn-outline btn-sm !border-amber-400 !bg-amber-50 !text-amber-800 hover:!bg-amber-100 flex items-center gap-1.5 font-bold shadow-sm"
            title="Create realistic sample orders from Talabat, Snoonu, Keeta, Rafeeq & Deliveroo"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span>{simulating ? "Simulating..." : "Simulate Partner Orders"}</span>
          </button>

          <button
            onClick={() => setAutoPrint((v) => !v)}
            className={`btn-sm rounded-xl px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
              autoPrint ? "bg-emerald-600 text-white shadow-sm" : "border border-slate-300 bg-white text-slate-700"
            }`}
            title="Auto-print a KOT ticket when a new order arrives"
          >
            <span>🖨 Auto-print KOT:</span>
            <span className="uppercase">{autoPrint ? "ON" : "OFF"}</span>
          </button>

          <button className="btn-outline btn-sm font-semibold" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {/* Channel Filter Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        {CHANNELS.map((ch) => {
          const isActive = channelFilter === ch.id;
          const count = orders.filter((o) => {
            if (ch.id === "ALL") return true;
            if (ch.id === "IN_HOUSE") return !o.source || o.source === "IN_HOUSE";
            return o.source === ch.id;
          }).length;

          return (
            <button
              key={ch.id}
              onClick={() => setChannelFilter(ch.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                isActive
                  ? ch.color || "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{ch.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                isActive ? "bg-white/20 text-current" : "bg-white text-slate-700"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filteredOrders.length === 0 && (
        <Empty>No active orders for the selected channel. New orders will appear here automatically.</Empty>
      )}

      {/* Orders Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredOrders.map((o) => {
          const isPlatform = o.source && o.source !== "IN_HOUSE";

          return (
            <div
              key={o.id}
              className={`cv-auto card flex flex-col p-4 border transition duration-150 ${
                isPlatform 
                  ? "border-amber-300 bg-amber-50/15 shadow-sm" 
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              {/* Order Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-black text-lg text-slate-900">{o.orderNo}</span>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {isPlatform ? (
                      <PlatformBadge source={o.source} platformRef={o.platformRef} />
                    ) : (
                      <TypeBadge value={o.type} />
                    )}

                    {o.table && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        Table {o.table.tableNo}
                      </span>
                    )}

                    {o.placedBy && (
                      <span className="text-[11px] text-slate-500">
                        by {o.placedBy.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <StatusBadge value={o.status} />
                  {o.platformStatus && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {o.platformStatus}
                    </span>
                  )}
                </div>
              </div>

              {/* Delivery Details for Partner Orders */}
              {isPlatform && o.deliveryInfo && (
                <div className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700 border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1 text-slate-900">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      {o.deliveryInfo.name}
                    </span>
                    {o.deliveryInfo.phone && (
                      <span className="font-semibold text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {o.deliveryInfo.phone}
                      </span>
                    )}
                  </div>
                  {o.deliveryInfo.zone && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{o.deliveryInfo.zone} {o.deliveryInfo.street ? `· ${o.deliveryInfo.street}` : ""}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Items List */}
              <ul className="mt-3 flex-1 space-y-1.5 text-sm divide-y divide-slate-100">
                {o.items.map((i) => (
                  <li key={i.id} className="pt-1.5 first:pt-0">
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-slate-800">
                        <span className="text-brand font-black mr-1">{i.qty}×</span> {i.name}
                      </span>
                    </div>
                    {i.note && (
                      <span className="block pl-4 text-xs font-medium text-amber-700 mt-0.5">
                        ↳ {i.note}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {/* Special Order Notes */}
              {o.note && (
                <div className="mt-3 rounded-xl bg-amber-100/70 p-2.5 text-xs text-amber-900 font-semibold border border-amber-200/60 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <span>{o.note}</span>
                </div>
              )}

              {/* Footer Meta */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="font-bold text-slate-700">
                  {money(o.total)} {isPlatform && <span className="text-[10px] text-emerald-600 font-bold ml-1">Prepaid</span>}
                </span>
              </div>

              {/* Lifecycle Actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                {!isPlatform ? (
                  /* IN-HOUSE ORDER ACTIONS */
                  <>
                    {NEXT[o.status] && (
                      <button className="btn-primary btn-sm flex-1 font-bold" onClick={() => advance(o)}>
                        {NEXT_LABEL[o.status]}
                      </button>
                    )}
                    <button className="btn-outline btn-sm font-bold flex items-center gap-1" onClick={() => kot(o)} title="Print Thermal KOT Ticket">
                      <span>🖨 KOT</span>
                    </button>
                    {o.status !== "READY" && (
                      <button
                        className="btn-outline btn-sm text-red-600 hover:bg-red-50 border-red-200"
                        onClick={() => api.patch(`/orders/${o.id}/status`, { status: "CANCELLED" }).then(load)}
                      >
                        Cancel
                      </button>
                    )}
                  </>
                ) : (
                  /* DELIVERY PARTNER ACTIONS */
                  <>
                    {o.status === "NEW" && (
                      <>
                        <button className="btn-primary btn-sm flex-1 font-bold !bg-emerald-600 hover:!bg-emerald-700" onClick={() => platformAction(o, "ACCEPT")}>
                          Accept {o.source}
                        </button>
                        <button className="btn-outline btn-sm text-red-600 hover:bg-red-50" onClick={() => platformAction(o, "REJECT")}>
                          Reject
                        </button>
                      </>
                    )}
                    {o.status === "PREPARING" && (
                      <button className="btn-primary btn-sm flex-1 font-bold !bg-amber-600 hover:!bg-amber-700" onClick={() => platformAction(o, "READY")}>
                        Mark Ready for Rider
                      </button>
                    )}
                    {o.status === "READY" && (
                      <button className="btn-primary btn-sm flex-1 font-bold !bg-teal-600 hover:!bg-teal-700" onClick={() => platformAction(o, "PICKED_UP")}>
                        Rider Picked Up ✓
                      </button>
                    )}
                    <button className="btn-outline btn-sm font-bold flex items-center gap-1" onClick={() => kot(o)} title="Print Thermal KOT Ticket">
                      <span>🖨 KOT</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
