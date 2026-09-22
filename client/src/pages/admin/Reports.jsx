import React, { useEffect, useState, useCallback } from "react";
import { api, money } from "../../api.js";
import { Spinner, Empty } from "../../components/ui.jsx";

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [daily, setDaily] = useState(null);
  const [items, setItems] = useState([]);
  const [range, setRange] = useState([]);

  const load = useCallback(async () => {
    const [d, it, r] = await Promise.all([
      api.get("/reports/daily", { params: { date } }),
      api.get("/reports/items", { params: { date } }),
      api.get("/reports/range"),
    ]);
    setDaily(d.data);
    setItems(it.data.items);
    setRange(r.data.rows);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  if (!daily) return <Spinner />;

  const maxSales = Math.max(1, ...range.map((r) => r.sales));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Reports</h1>
        <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {/* Daily summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sales" value={money(daily.sales)} accent="text-brand" />
        <Stat label="Expenses" value={money(daily.expenses)} />
        <Stat label="Profit" value={money(daily.profit)} accent={daily.profit >= 0 ? "text-emerald-600" : "text-red-600"} />
        <Stat label="Orders" value={`${daily.paidCount}/${daily.orderCount}`} />
      </div>

      {/* Payments by mode */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 font-bold">Payments by Mode</h2>
          {Object.keys(daily.paymentsByMode).length === 0 ? (
            <Empty>No payments.</Empty>
          ) : (
            <div className="space-y-2 text-sm">
              {Object.entries(daily.paymentsByMode).map(([mode, amt]) => (
                <div key={mode} className="flex justify-between">
                  <span>{mode}</span>
                  <span className="font-semibold">{money(amt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-bold">Sales by Type</h2>
          {Object.keys(daily.salesByType).length === 0 ? (
            <Empty>No sales.</Empty>
          ) : (
            <div className="space-y-2 text-sm">
              {Object.entries(daily.salesByType).map(([type, amt]) => (
                <div key={type} className="flex justify-between">
                  <span>{type}</span>
                  <span className="font-semibold">{money(amt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Item-wise */}
      <div className="card mt-6 p-4">
        <h2 className="mb-3 font-bold">Item-wise Sales ({date})</h2>
        {items.length === 0 ? (
          <Empty>No item sales.</Empty>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1">Item</th>
                <th className="py-1 text-right">Qty</th>
                <th className="py-1 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.name} className="border-t">
                  <td className="py-1">{it.name}</td>
                  <td className="py-1 text-right">{it.qty}</td>
                  <td className="py-1 text-right font-semibold">{money(it.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Last 7 days bar chart */}
      <div className="card mt-6 p-4">
        <h2 className="mb-3 font-bold">Last 7 Days Sales</h2>
        {range.length === 0 ? (
          <Empty>No sales in range.</Empty>
        ) : (
          <div className="flex items-end gap-2" style={{ height: 160 }}>
            {range.map((r) => (
              <div key={r.date} className="flex flex-1 flex-col items-center justify-end">
                <span className="mb-1 text-[10px] text-gray-500">{money(r.sales)}</span>
                <div
                  className="w-full rounded-t bg-brand"
                  style={{ height: `${(r.sales / maxSales) * 120}px` }}
                  title={`${r.date}: ${money(r.sales)}`}
                />
                <span className="mt-1 text-[10px] text-gray-400">{r.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${accent || ""}`}>{value}</p>
    </div>
  );
}
