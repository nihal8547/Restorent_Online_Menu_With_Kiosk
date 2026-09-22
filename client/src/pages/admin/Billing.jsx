import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api, money } from "../../api.js";
import { subscribeOrders } from "../../socket.js";
import { Spinner, Empty, StatusBadge, TypeBadge, Toast } from "../../components/ui.jsx";

export default function Billing() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL"); // ALL | PENDING | PAID
  const [staffFilter, setStaffFilter] = useState("ALL"); // ALL or staff username/name
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(null); // order being paid
  const [pay, setPay] = useState({ mode: "CASH", discount: 0 });
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const params = { today: 1 };
    if (filter === "PENDING") params.paymentStatus = "PENDING";
    if (filter === "PAID") params.paymentStatus = "PAID";
    const { data } = await api.get("/orders", { params });
    setOrders(data.orders || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time order socket subscription
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
      setToast("Payment collected ✓  Opening receipt…");
      // Open the bill in a small popup window with auto-print enabled
      const billUrl = `/bill/${active.orderToken}?autoprint=1`;
      window.open(billUrl, "_blank", "width=420,height=680,scrollbars=yes");
      setActive(null);
      load();
    } catch (e) {
      setToast(e.message || "Failed to collect payment");
    }
  };

  // Extract unique staff members who billed / collected payments today
  const billingStaffList = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      (o.payments || []).forEach((p) => {
        if (p.collectedBy) {
          const key = p.collectedBy.username;
          const prev = map.get(key) || {
            name: p.collectedBy.name,
            role: p.collectedBy.role,
            username: p.collectedBy.username,
            totalCollected: 0,
            orderCount: 0,
          };
          prev.totalCollected += Number(p.amount || 0);
          prev.orderCount += 1;
          map.set(key, prev);
        }
      });
    });
    return Array.from(map.values());
  }, [orders]);

  // Filtered orders based on Search, Payment Status, and Staff Filter
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Staff filter (Billed by)
      if (staffFilter !== "ALL") {
        const hasStaffPayment = (o.payments || []).some(
          (p) => p.collectedBy?.username === staffFilter
        );
        if (!hasStaffPayment) return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNo = (o.orderNo || "").toLowerCase().includes(q);
        const matchPhone = (o.customerPhone || "").toLowerCase().includes(q);
        const matchTable = o.table ? `table ${o.table.tableNo}`.toLowerCase().includes(q) : false;
        const matchWaiter = o.placedBy ? o.placedBy.name.toLowerCase().includes(q) : false;
        const matchBilledBy = (o.payments || []).some((p) =>
          p.collectedBy ? p.collectedBy.name.toLowerCase().includes(q) : false
        );
        if (!matchNo && !matchPhone && !matchTable && !matchWaiter && !matchBilledBy) {
          return false;
        }
      }

      return true;
    });
  }, [orders, staffFilter, search]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let pendingCount = 0;
    let pendingSum = 0;
    let paidCount = 0;
    let paidSum = 0;

    orders.forEach((o) => {
      if (o.paymentStatus === "PAID") {
        paidCount++;
        paidSum += Number(o.total || 0);
      } else {
        pendingCount++;
        pendingSum += Number(o.total || 0);
      }
    });

    return { pendingCount, pendingSum, paidCount, paidSum };
  }, [orders]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER: Title & Status Filters                             */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Billing & Cashier POS</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Collect payments, track table bills, and audit which staff member billed each order.
          </p>
        </div>

        {/* Payment Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
          <button
            onClick={() => setFilter("ALL")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              filter === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Today ({orders.length})
          </button>
          <button
            onClick={() => setFilter("PENDING")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              filter === "PENDING"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-amber-700 hover:text-amber-900"
            }`}
          >
            Unpaid ({metrics.pendingCount})
          </button>
          <button
            onClick={() => setFilter("PAID")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              filter === "PAID"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-emerald-700 hover:text-emerald-900"
            }`}
          >
            Paid ({metrics.paidCount})
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP METRICS & STAFF COLLECTION BREAKDOWN                   */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4 border border-slate-200/80 bg-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Unpaid Orders</p>
          <p className="mt-1 text-xl font-black text-amber-600">{money(metrics.pendingSum)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{metrics.pendingCount} order(s) awaiting payment</p>
        </div>

        <div className="card p-4 border border-slate-200/80 bg-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Billed Today</p>
          <p className="mt-1 text-xl font-black text-emerald-600">{money(metrics.paidSum)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{metrics.paidCount} order(s) fully paid</p>
        </div>

        {/* Staff Collectors Summary Chips */}
        <div className="card p-4 border border-slate-200/80 bg-white shadow-sm col-span-2 flex flex-col justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Staff Collection Audit (Who Billed Today)
          </p>
          {billingStaffList.length === 0 ? (
            <p className="text-xs text-slate-400 mt-1">No payments collected yet today.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-2">
              {billingStaffList.map((s) => (
                <div
                  key={s.username}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium"
                >
                  <span className="font-bold text-slate-800">{s.name}</span>
                  <span className="rounded bg-brand/10 text-brand text-[10px] px-1 font-bold uppercase">
                    {s.role}
                  </span>
                  <span className="font-bold text-emerald-700 ml-1">{money(s.totalCollected)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. SEARCH & STAFF AUDIT FILTER BAR                            */}
      {/* ------------------------------------------------------------- */}
      <div className="card p-3.5 border border-slate-200/80 bg-white shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="Search by Order #, Table, Waiter, Staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-8 py-1.5 text-xs sm:text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-brand/20 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter by Billed Staff Member */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-500 shrink-0">Billed by Staff:</label>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none cursor-pointer focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
          >
            <option value="ALL">All Staff Members</option>
            {billingStaffList.map((s) => (
              <option key={s.username} value={s.username}>
                {s.name} ({s.role}) — {money(s.totalCollected)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. ORDERS GRID WITH AUDIT BADGES (Who Billed & Who Placed)    */}
      {/* ------------------------------------------------------------- */}
      {filteredOrders.length === 0 ? (
        <Empty>No orders match the current filter or search.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOrders.map((o) => {
            const primaryPayment = o.payments?.[0];
            const billedBy = primaryPayment?.collectedBy;

            return (
              <div
                key={o.id}
                className={`card p-4 flex flex-col justify-between border transition-all duration-150 ${
                  o.paymentStatus === "PAID"
                    ? "border-emerald-200 bg-white shadow-sm hover:shadow-md"
                    : "border-amber-200 bg-amber-50/20 shadow-sm hover:shadow-md"
                }`}
              >
                <div>
                  {/* Card Header: Order No & Status */}
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-base text-slate-900">{o.orderNo}</span>
                    <StatusBadge value={o.paymentStatus} />
                  </div>

                  {/* Order Meta Badges */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                    <TypeBadge value={o.type} />
                    {o.table && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-700 text-[11px]">
                        Table {o.table.tableNo}
                      </span>
                    )}
                    <StatusBadge value={o.status} />
                  </div>

                  {/* WHO TOOK THE ORDER (Waiter / Customer QR) */}
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 rounded-lg p-2 border border-slate-100">
                    <span className="text-slate-400">👤</span>
                    <span className="font-medium text-[11px]">
                      Order taken by:{" "}
                      <strong className="text-slate-800 font-semibold">
                        {o.placedBy ? o.placedBy.name : "Customer (QR Scan)"}
                      </strong>
                    </span>
                    {o.placedBy?.role && (
                      <span className="ml-auto text-[9px] font-bold uppercase rounded bg-slate-200 px-1 py-0.2 text-slate-600">
                        {o.placedBy.role}
                      </span>
                    )}
                  </div>

                  {/* Delivery Info if any */}
                  {o.deliveryInfo && (
                    <p className="mt-1.5 text-xs text-gray-500">
                      🛵 {o.deliveryInfo.name}, {o.deliveryInfo.street}, Bldg {o.deliveryInfo.buildingNo}
                      {o.deliveryInfo.room ? `, Room ${o.deliveryInfo.room}` : ""} · {o.deliveryInfo.zone} ·{" "}
                      {o.deliveryInfo.phone}
                    </p>
                  )}

                  {/* Itemized Order List */}
                  <ul className="mt-3 divide-y divide-slate-100 text-xs text-slate-700 max-h-36 overflow-y-auto no-scrollbar">
                    {o.items.map((i) => (
                      <li key={i.id} className="flex justify-between py-1.5">
                        <span className="truncate pr-2">
                          <strong className="text-slate-900">{i.qty}×</strong> {i.name}
                        </span>
                        <span className="font-semibold shrink-0 text-slate-800">
                          {money(Number(i.price) * i.qty)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* --------------------------------------------------------- */}
                {/* WHO BILLED IT (Collected By Staff Audit Banner)          */}
                {/* --------------------------------------------------------- */}
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  {/* If Paid: Show Exactly Who Billed It */}
                  {o.paymentStatus === "PAID" && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-slate-600 text-[11px]">Billed by:</span>
                          <strong className="text-slate-900 font-bold">
                            {billedBy ? billedBy.name : "Cashier / Admin"}
                          </strong>
                          {billedBy?.role && (
                            <span className="rounded bg-emerald-200/60 px-1 py-0.2 text-[9px] font-extrabold uppercase text-emerald-800">
                              {billedBy.role}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-emerald-800 font-mono text-[11px]">
                          {primaryPayment?.mode || "CASH"}
                        </span>
                      </div>
                      {primaryPayment?.paidAt && (
                        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                          <span>Staff User: @{billedBy?.username || "cashier"}</span>
                          <span>{new Date(primaryPayment.paidAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Total & Action Button */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-[11px] font-medium text-slate-400 block">Total Bill</span>
                      <span className="font-extrabold text-base text-brand">{money(o.total)}</span>
                    </div>

                    {o.paymentStatus === "PENDING" ? (
                      <button
                        className="btn-primary btn-sm !py-2 !px-4 shadow-md shadow-brand/20 active:scale-95 transition font-bold"
                        onClick={() => openPay(o)}
                      >
                        Collect Payment
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                          <span>✓ Settled</span>
                        </div>
                        {o.orderToken && (
                          <button
                            onClick={() =>
                              window.open(
                                `/bill/${o.orderToken}?autoprint=1`,
                                "_blank",
                                "width=420,height=680,scrollbars=yes"
                              )
                            }
                            title="Reprint receipt"
                            className="text-xs px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition"
                          >
                            🖨️
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. COLLECT PAYMENT MODAL                                      */}
      {/* ------------------------------------------------------------- */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-sm p-6 bg-white rounded-2xl shadow-2xl animate-fade-up">
            <h3 className="text-lg font-bold text-slate-900">
              Collect Payment · {active.orderNo}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Order Taken by: {active.placedBy ? active.placedBy.name : "Customer (QR)"}
            </p>

            <div className="mt-4 space-y-2 text-sm">
              <Row label="Subtotal" value={money(active.subtotal)} />
              {Number(active.tax) > 0 && <Row label="Tax" value={money(active.tax)} />}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mt-2 mb-1">
                  Discount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input !py-1.5 text-sm font-semibold"
                  value={pay.discount}
                  onChange={(e) => setPay({ ...pay, discount: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mt-2 mb-1">
                  Payment Mode
                </label>
                <div className="flex gap-2">
                  {["CASH", "CARD", "ONLINE"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPay({ ...pay, mode: m })}
                      className={`btn flex-1 !py-2 text-xs font-bold rounded-xl transition ${
                        pay.mode === m
                          ? "bg-brand text-white shadow-md shadow-brand/20"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex justify-between border-t border-slate-100 pt-2 text-base font-extrabold text-slate-900">
                <span>Final Payable</span>
                <span className="text-brand text-lg">{money(total)}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button className="btn-outline" onClick={() => setActive(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={collect}>
                Confirm & Mark Paid
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
    <div className="flex justify-between text-slate-600 text-xs">
      <span>{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
