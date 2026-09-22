import React, { useEffect, useState, useCallback } from "react";
import { api, money } from "../../api.js";
import { Spinner, Empty, Toast } from "../../components/ui.jsx";

// Download an authenticated export as a file.
async function download(path, filename, setToast) {
  try {
    const res = await api.get(path, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    setToast(e.message || "Download failed");
  }
}

export default function Accounting() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState(null);
  const [journal, setJournal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, j] = await Promise.all([
        api.get("/accounting/summary", { params: { from, to } }),
        api.get("/accounting/journal", { params: { from, to } }),
      ]);
      setSummary(s.data);
      setJournal(j.data);
    } catch (e) {
      setToast(e.message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const q = `?from=${from}&to=${to}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Accounting</h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            P&amp;L summary, double-entry journal and exports for Tally, QuickBooks, Zoho &amp; Excel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-gray-400">→</span>
          <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {loading || !summary ? (
        <Spinner />
      ) : (
        <>
          {/* P&L cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Net Sales" value={money(summary.netSales)} accent="text-brand" sub={`${summary.invoiceCount} invoices`} />
            <Stat label={`${summary.taxLabel} Collected`} value={money(summary.taxCollected)} accent="text-indigo-600" />
            <Stat label="Gross Collected" value={money(summary.grossCollected)} />
            <Stat label="Expenses" value={money(summary.expenseTotal)} accent="text-rose-600" sub={`${summary.expenseCount} entries`} />
            <Stat
              label="Net Profit"
              value={money(summary.netProfit)}
              accent={summary.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}
            />
          </div>

          {/* Payments + expense breakdown */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-4">
              <h2 className="mb-3 font-bold">Collections by Mode</h2>
              {Object.keys(summary.paymentsByMode).length === 0 ? (
                <Empty>No collections.</Empty>
              ) : (
                <div className="space-y-2 text-sm">
                  {Object.entries(summary.paymentsByMode).map(([m, v]) => (
                    <div key={m} className="flex justify-between">
                      <span>{m}</span>
                      <span className="font-semibold">{money(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-4">
              <h2 className="mb-3 font-bold">Expenses by Category</h2>
              {Object.keys(summary.expensesByCategory).length === 0 ? (
                <Empty>No expenses.</Empty>
              ) : (
                <div className="space-y-2 text-sm">
                  {Object.entries(summary.expensesByCategory).map(([c, v]) => (
                    <div key={c} className="flex justify-between">
                      <span>{c}</span>
                      <span className="font-semibold">{money(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Export buttons */}
          <div className="card p-4">
            <h2 className="mb-1 font-bold">Export for your accountant</h2>
            <p className="mb-3 text-xs text-gray-500">
              CSV files import into Excel, QuickBooks &amp; Zoho Books. The Tally XML imports directly as vouchers.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary btn-sm" onClick={() => download(`/accounting/export/sales.csv${q}`, `sales_${from}_${to}.csv`, setToast)}>
                ⬇ Sales CSV
              </button>
              <button className="btn-primary btn-sm" onClick={() => download(`/accounting/export/expenses.csv${q}`, `expenses_${from}_${to}.csv`, setToast)}>
                ⬇ Expenses CSV
              </button>
              <button className="btn-primary btn-sm" onClick={() => download(`/accounting/export/journal.csv${q}`, `journal_${from}_${to}.csv`, setToast)}>
                ⬇ Journal CSV
              </button>
              <button className="btn-gold btn-sm" onClick={() => download(`/accounting/export/tally.xml${q}`, `tally_${from}_${to}.xml`, setToast)}>
                ⬇ Tally XML
              </button>
            </div>
          </div>

          {/* Journal preview */}
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between border-b p-3">
              <h2 className="font-bold">Journal (double-entry)</h2>
              <span className={`text-xs ${Math.abs(journal.totalDebit - journal.totalCredit) < 0.01 ? "text-emerald-600" : "text-rose-600"}`}>
                Dr {money(journal.totalDebit)} = Cr {money(journal.totalCredit)}
              </span>
            </div>
            {journal.entries.length === 0 ? (
              <Empty>No transactions in this period.</Empty>
            ) : (
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="p-2">Date</th>
                    <th className="p-2">Voucher</th>
                    <th className="p-2">Account</th>
                    <th className="p-2 text-right">Debit</th>
                    <th className="p-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.entries.slice(0, 100).flatMap((en) =>
                    en.lines.map((l, i) => (
                      <tr key={`${en.ref}-${i}`} className="border-t">
                        <td className="p-2 text-gray-500">{i === 0 ? en.date : ""}</td>
                        <td className="p-2">{i === 0 ? en.ref : ""}</td>
                        <td className="p-2">{l.account}</td>
                        <td className="p-2 text-right">{l.debit ? money(l.debit) : ""}</td>
                        <td className="p-2 text-right">{l.credit ? money(l.credit) : ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
            {journal.entries.length > 100 && (
              <p className="p-3 text-center text-xs text-gray-400">Showing first 100 vouchers — export CSV for the full ledger.</p>
            )}
          </div>
        </>
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}

function Stat({ label, value, accent, sub }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${accent || ""}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}
