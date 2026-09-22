import React, { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { api, money } from "../../api.js";
import { Spinner } from "../../components/ui.jsx";
import { useSettings } from "../../store/settings.js";
import { watchOrder } from "../../socket.js";
import {
  Clock, ChefHat, CheckCircle, Utensils, CreditCard, XCircle,
  Printer, ShoppingBag, Truck, Bell, CheckCheck, MapPin
} from "lucide-react";

export default function OrderSlip() {
  const { orderToken } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const shopName = useSettings(s => s.shopName);
  const autoPrint = searchParams.get("autoprint") === "1";
  const merged = searchParams.get("merged") === "1";

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [printed, setPrinted] = useState(false);
  const [liveStatus, setLiveStatus] = useState(null);
  const [livePayStatus, setLivePayStatus] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/slip/${orderToken}`);
      setOrder(data);
      setLiveStatus(data.status);
      setLivePayStatus(data.paymentStatus);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [orderToken]);

  useEffect(() => { load(); }, [load]);

  // Real-time: watch this order's status
  useEffect(() => {
    return watchOrder(orderToken, (update) => {
      if (update.orderToken !== orderToken) return;
      setLiveStatus(update.status);
      setLivePayStatus(update.paymentStatus);
      if (update.paymentStatus === "PAID") {
        setTimeout(() => navigate(`/order/${orderToken}`), 1500);
      }
    });
  }, [orderToken, navigate]);

  // Auto print when ?autoprint=1
  useEffect(() => {
    if (autoPrint && order && !printed) {
      setPrinted(true);
      const t = setTimeout(() => {
        window.print();
        // If it was opened in a standalone window, try to close it after printing
        if (window.opener) {
          window.close();
        }
      }, 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint, order, printed]);

  if (loading) return <Spinner />;

  if (err) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-red-600">
        <p>{err}</p>
        <Link to="/menu" className="btn-outline mt-4 inline-block">Back to menu</Link>
      </div>
    );
  }

  if (!order) return null;

  const subtotal = order.items.reduce((s, i) => s + Number(i.price) * i.qty, 0);
  const tax = Number(order.tax || 0);
  const total = subtotal + tax;
  const now = new Date(order.createdAt);

  // Status config — using Lucide icons instead of emojis
  const statusKey = livePayStatus === "PAID" ? "PAID" : (liveStatus || order.status);
  const STATUS_CFG = {
    NEW:       { bg: "bg-blue-500",    Icon: Clock,        label: "Order Received" },
    PREPARING: { bg: "bg-amber-500",   Icon: ChefHat,      label: "Being Prepared..." },
    READY:     { bg: "bg-emerald-500", Icon: CheckCircle,  label: "Ready to Serve!" },
    SERVED:    { bg: "bg-emerald-600", Icon: Utensils,     label: "Served — Enjoy!" },
    PAID:      { bg: "bg-green-600",   Icon: CreditCard,   label: "Payment Received!" },
    CANCELLED: { bg: "bg-red-500",     Icon: XCircle,      label: "Order Cancelled" },
  };
  const cfg = STATUS_CFG[statusKey] || STATUS_CFG.NEW;
  const StatusIcon = cfg.Icon;

  // Order type config
  const TYPE_CFG = {
    DINE_IN:  { Icon: Utensils, label: "Dine-in",  cls: "bg-blue-100 text-blue-700" },
    TAKEAWAY: { Icon: ShoppingBag, label: "Takeaway", cls: "bg-purple-100 text-purple-700" },
    DELIVERY: { Icon: Truck, label: "Delivery", cls: "bg-orange-100 text-orange-700" },
  };
  const typeCfg = TYPE_CFG[order.type] || TYPE_CFG.TAKEAWAY;
  const TypeIcon = typeCfg.Icon;

  // Status message text
  const statusMsg = livePayStatus === "PAID"
    ? "Payment received! Thank you."
    : liveStatus === "READY"
    ? "Your order is ready! Please collect or wait for service."
    : liveStatus === "PREPARING"
    ? "Kitchen is preparing your order..."
    : liveStatus === "SERVED"
    ? "Order served. Enjoy your meal!"
    : order.type === "DINE_IN"
    ? "Your order is being prepared. Payment will be collected at your table."
    : order.type === "TAKEAWAY"
    ? "Please wait at the counter. We'll call your order number when ready."
    : "Your delivery order is being prepared!";

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-8 px-4 print:p-0 print:bg-transparent print:min-h-0 print:block">
      <div className="receipt-wrapper w-full max-w-xs bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden print:w-full print:max-w-[80mm] print:mx-auto print:rounded-none print:shadow-none print:border-none text-black">

        {/* Dynamic status top bar */}
        <div className={`${cfg.bg} py-4 text-center text-white print:hidden transition-colors duration-700`}>
          <div className="flex justify-center">
            <StatusIcon className="w-8 h-8" />
          </div>
          <p className="mt-1 text-sm font-bold">{cfg.label}</p>
          {statusKey === "PAID" && (
            <p className="text-xs mt-1 opacity-80 animate-pulse">Redirecting to your bill...</p>
          )}
          {(statusKey === "NEW" || statusKey === "PREPARING") && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{animationDelay:"0ms"}} />
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{animationDelay:"150ms"}} />
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{animationDelay:"300ms"}} />
            </div>
          )}
        </div>

        {/* Thermal header — print only */}
        <div className="hidden print:block text-center py-3 border-b border-dashed border-gray-400">
          <p className="text-lg font-black tracking-widest uppercase">{shopName}</p>
          <p className="text-[11px] text-gray-500">{useSettings.getState().shopTagline}</p>
        </div>

        {/* Header: Shop Name & Details */}
        <div className="text-center mb-6 pb-6 border-b-2 border-dashed border-slate-200 px-5 pt-5">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2 uppercase">{shopName}</h1>
          <p className="text-xs text-slate-500 font-medium">Thank you for dining with us!</p>
        </div>

        {/* Order meta */}
        <div className="px-5 pt-4 pb-2 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-widest">Order No.</p>
          <p className="text-2xl font-black text-slate-900 mt-0.5 tracking-wide">{order.orderNo}</p>

          <div className="mt-2 flex items-center justify-center gap-3 flex-wrap">
            {order.table && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1">
                <MapPin className="w-3 h-3" />
                Table {order.table.tableNo}
              </span>
            )}
            <span className={`inline-flex items-center gap-1.5 rounded-full text-xs font-bold px-3 py-1 ${typeCfg.cls}`}>
              <TypeIcon className="w-3 h-3" />
              {typeCfg.label}
            </span>
          </div>

          <p className="mt-2 text-[11px] text-gray-400">
            {now.toLocaleDateString()} · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        <div className="mx-5 my-2 border-t border-dashed border-gray-300" />

        {/* Items list */}
        <div className="px-5 py-2 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Items Ordered</p>
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-start text-sm">
              <div className="flex-1 min-w-0">
                <span className="font-bold text-slate-800">{item.qty}&times;</span>
                <span className="ml-1 text-slate-700">{item.name}</span>
                {item.note && (
                  <p className="text-[10px] text-gray-400 ml-5">Note: {item.note}</p>
                )}
              </div>
              <span className="text-sm font-semibold text-slate-800 ml-2 shrink-0">
                {money(Number(item.price) * item.qty)}
              </span>
            </div>
          ))}
        </div>

        <div className="mx-5 my-2 border-t border-dashed border-gray-300" />

        {/* Totals */}
        <div className="px-5 py-2 space-y-1 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span><span>{money(subtotal)}</span>
          </div>
          {tax > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Tax</span><span>{money(tax)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-base text-slate-900 pt-1 border-t border-gray-200">
            <span>Total</span>
            <span className="text-brand">{money(total)}</span>
          </div>
        </div>

        {/* Merged notice */}
        {merged && (
          <div className="mx-5 mb-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center text-xs text-emerald-700 font-medium flex items-center justify-center gap-1.5">
            <CheckCheck className="w-3.5 h-3.5" />
            Added to Table {order.table?.tableNo}&apos;s running bill
          </div>
        )}

        {/* Live status message */}
        <div className={`mx-5 mb-3 rounded-xl p-3 text-center border print:hidden ${
          (liveStatus === "READY" || liveStatus === "SERVED")
            ? "bg-emerald-50 border-emerald-200"
            : livePayStatus === "PAID"
            ? "bg-green-50 border-green-200"
            : "bg-blue-50 border-blue-100"
        }`}>
          <p className={`text-xs font-semibold flex items-center justify-center gap-1.5 ${
            (liveStatus === "READY" || liveStatus === "SERVED") ? "text-emerald-700"
            : livePayStatus === "PAID" ? "text-green-700"
            : "text-blue-700"
          }`}>
            {liveStatus === "READY" && <Bell className="w-3.5 h-3.5 shrink-0" />}
            {liveStatus === "PREPARING" && <ChefHat className="w-3.5 h-3.5 shrink-0" />}
            {liveStatus === "SERVED" && <CheckCheck className="w-3.5 h-3.5 shrink-0" />}
            {statusMsg}
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 text-center text-[10px] text-gray-400">
          <p>Thank you for choosing {BRAND.name}!</p>
        </div>

        {/* Action buttons */}
        <div className="print:hidden px-5 pb-5 flex flex-col gap-2">
          <button
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-2.5 text-sm font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <Link to="/menu" className="btn-primary w-full text-center">
            Order More
          </Link>
        </div>
      </div>
    </div>
  );
}
