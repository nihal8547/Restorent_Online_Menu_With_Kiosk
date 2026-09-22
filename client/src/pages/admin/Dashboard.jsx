import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../../api.js";
import { Spinner } from "../../components/ui.jsx";
import { subscribeGlobal } from "../../socket.js";
import { UtensilsCrossed, QrCode, Receipt, BarChart3, AlertCircle } from "lucide-react";

export default function Dashboard() {
  const [report, setReport] = useState(null);
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    const [r, orders] = await Promise.all([
      api.get("/reports/daily"),
      api.get("/orders", { params: { paymentStatus: "PENDING", today: 1 } }),
    ]);
    setReport(r.data);
    setPending(orders.data.orders.length);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time: refresh on new orders or payments
  useEffect(() => {
    const refresh = () => load();
    return subscribeGlobal({
      onNew: refresh,
      onUpdated: refresh,
      onPayment: refresh,
    });
  }, [load]);

  if (!report) return <Spinner />;

  const stats = [
    { label: "Today's Sales", value: money(report.sales), accent: "text-brand" },
    { label: "Expenses", value: money(report.expenses) },
    { label: "Profit", value: money(report.profit), accent: report.profit >= 0 ? "text-emerald-600" : "text-red-600" },
    { label: "Orders", value: report.orderCount },
    { label: "Paid", value: report.paidCount, accent: "text-emerald-600" },
    { label: "Unpaid", value: report.pendingCount, accent: "text-orange-600" },
  ];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Dashboard · {report.date}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`mt-1 text-lg font-bold ${s.accent || ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {pending > 0 && (
        <Link to="/admin/billing" className="card mt-4 flex items-center gap-3 bg-orange-50 p-4 text-orange-700 hover:bg-orange-100 transition">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{pending} order(s) awaiting payment — go to Billing</span>
        </Link>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink to="/admin/menu" label="Manage Menu" Icon={UtensilsCrossed} color="text-amber-600 bg-amber-50" />
        <QuickLink to="/admin/tables" label="Tables & QR" Icon={QrCode} color="text-blue-600 bg-blue-50" />
        <QuickLink to="/admin/billing" label="Billing / POS" Icon={Receipt} color="text-brand bg-brand/10" />
        <QuickLink to="/admin/reports" label="Reports" Icon={BarChart3} color="text-emerald-600 bg-emerald-50" />
      </div>
    </div>
  );
}

function QuickLink({ to, label, Icon, color }) {
  return (
    <Link to={to} className="card flex items-center gap-3 p-4 hover:border-brand hover:shadow-md transition-all">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </span>
      <span className="font-semibold text-slate-800">{label}</span>
    </Link>
  );
}
