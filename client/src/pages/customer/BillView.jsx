import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { api, money } from "../../api.js";
import { Spinner } from "../../components/ui.jsx";
import { watchOrder } from "../../socket.js";
import { Printer, Receipt, CheckCircle } from "lucide-react";

export default function BillView() {
  const { orderToken } = useParams();
  const [searchParams] = useSearchParams();
  const merged = searchParams.get("merged") === "1";
  // ?autoprint=1  → auto-trigger print on load (Kiosk / Admin cashier use)
  const autoPrint = searchParams.get("autoprint") === "1";
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printed, setPrinted] = useState(false);
  const [fiscal, setFiscal] = useState({});
  const receiptRef = useRef(null);

  // Load business / tax settings for the fiscal invoice header.
  useEffect(() => {
    api
      .get("/settings")
      .then(({ data }) => setFiscal(data || {}))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/bill/${orderToken}`);
      setState(data);
    } catch (e) {
      setState({ error: e.message });
    } finally {
      setLoading(false);
    }
  }, [orderToken]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time: auto-reload when payment is confirmed via socket
  useEffect(() => {
    return watchOrder(orderToken, (update) => {
      if (update.orderToken !== orderToken) return;
      if (update.paymentStatus === "PAID") {
        // Reload to reveal the full bill
        load();
      }
    });
  }, [orderToken, load]);

  // Auto-print once the bill is loaded and paid
  useEffect(() => {
    if (autoPrint && state?.paid && !printed) {
      setPrinted(true);
      // Small delay so the DOM is fully rendered before print dialog opens
      const timer = setTimeout(() => {
        window.print();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, state, printed]);

  const handlePrint = () => window.print();

  if (loading) return <Spinner />;

  if (state?.error) {
    return <div className="mx-auto max-w-md p-6 text-center text-red-600">{state.error}</div>;
  }

  // Payment not completed yet — bill withheld by design.
  if (!state.paid) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <div className="flex justify-center text-gray-400 mb-2">
          <Receipt className="w-12 h-12" />
        </div>
        <h1 className="mt-3 text-xl font-bold">Order {state.orderNo}</h1>
        <p className="mt-1 text-sm text-gray-500">Status: {state.status}</p>
        {merged && (
          <div className="mx-auto mt-4 max-w-xs rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
            ✓ Added to your table's running bill
          </div>
        )}
        <div className="card mt-5 p-5 text-sm text-gray-600">{state.message}</div>
        <button className="btn-outline mt-4" onClick={load}>
          Refresh
        </button>
        <div className="mt-6">
          <Link to="/menu" className="text-sm text-brand underline">
            Order more
          </Link>
        </div>
      </div>
    );
  }

  const b = state.bill;
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      {/* ── RECEIPT (printed area) ── */}
      <div ref={receiptRef} className="receipt-wrapper card p-5">
        {/* Header */}
        <div className="receipt-header text-center">
          <div className="flex justify-center text-emerald-500 mb-2 print:hidden">
            <CheckCircle className="w-10 h-10" />
          </div>
          <div className="hidden print:flex items-center justify-center gap-2 text-2xl font-bold tracking-wide">
            <Receipt className="w-6 h-6" /> RECEIPT
          </div>
          <h1 className="mt-1 text-xl font-bold">Payment Received</h1>

          {/* Fiscal / tax business header */}
          {(fiscal.businessName || fiscal.taxNumber) && (
            <div className="mt-2 text-xs text-gray-600">
              {fiscal.businessName && <p className="font-semibold text-gray-800">{fiscal.businessName}</p>}
              {fiscal.businessAddress && <p>{fiscal.businessAddress}</p>}
              {fiscal.taxNumber && <p>{fiscal.taxLabel || "Tax"} Reg. No: {fiscal.taxNumber}</p>}
            </div>
          )}

          {b.invoiceNo && (
            <p className="mt-2 inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold tracking-wide text-gray-700">
              TAX INVOICE · {b.invoiceNo}
            </p>
          )}
          <p className="mt-1 text-sm text-gray-500">{b.orderNo}</p>
          {b.table && <p className="text-xs text-gray-400">Table {b.table}</p>}
          <p className="mt-1 hidden print:block text-xs text-gray-400">
            {new Date(b.paidAt).toLocaleString()}
          </p>
        </div>

        {/* Divider */}
        <div className="my-3 border-t border-dashed border-gray-300" />

        {/* Items */}
        <div className="divide-y text-sm">
          {b.items.map((i, idx) => (
            <div key={idx} className="flex justify-between py-2">
              <span>
                {i.qty} × {i.name}
              </span>
              <span className="font-medium">{money(i.price * i.qty)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-3 space-y-1 border-t border-dashed border-gray-300 pt-3 text-sm">
          <Row label="Subtotal" value={money(b.subtotal)} />
          {b.discount > 0 && <Row label="Discount" value={`− ${money(b.discount)}`} />}
          {b.tax > 0 && (
            <Row
              label={`${fiscal.taxLabel || "Tax"}${fiscal.taxRate ? ` (${fiscal.taxRate}%)` : ""}`}
              value={money(b.tax)}
            />
          )}
          <div className="flex justify-between pt-1 text-base font-bold">
            <span>Total</span>
            <span className="text-brand">{money(b.total)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 border-t border-dashed border-gray-300 pt-3 text-center text-xs text-gray-400">
          <p className="print:hidden">Paid on {new Date(b.paidAt).toLocaleString()}</p>
          <p className="mt-1">Thank you for dining with us! 🙏</p>
          <p className="mt-1 hidden print:block text-[10px] text-gray-300">
            {window.location.hostname}
          </p>
        </div>
      </div>

      {/* ── ACTION BUTTONS (hidden on print) ── */}
      <div className="no-print px-5 pb-5 flex flex-col gap-2 mt-5">
        <button
          onClick={handlePrint}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-2.5 text-sm font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition"
        >
          <Printer className="w-4 h-4" />
          Print Receipt
        </button>
        <Link
          to="/menu"
          className="btn-primary w-full text-center"
        >
          Order More
        </Link>
        <Link
          to="/history"
          className="btn-outline w-full text-center"
        >
          My orders
        </Link>
      </div>
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
