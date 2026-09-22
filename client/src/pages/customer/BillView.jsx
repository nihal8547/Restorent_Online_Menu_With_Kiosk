import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api, money } from "../../api.js";
import { Spinner } from "../../components/ui.jsx";

export default function BillView() {
  const { orderToken } = useParams();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <Spinner />;

  if (state?.error) {
    return <div className="mx-auto max-w-md p-6 text-center text-red-600">{state.error}</div>;
  }

  // Payment not completed yet — bill withheld by design.
  if (!state.paid) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <div className="text-5xl">🧾</div>
        <h1 className="mt-3 text-xl font-bold">Order {state.orderNo}</h1>
        <p className="mt-1 text-sm text-gray-500">Status: {state.status}</p>
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
      <div className="card p-5">
        <div className="text-center">
          <div className="text-3xl">✅</div>
          <h1 className="mt-1 text-xl font-bold">Payment Received</h1>
          <p className="text-sm text-gray-500">{b.orderNo}</p>
          {b.table && <p className="text-xs text-gray-400">Table {b.table}</p>}
        </div>

        <div className="mt-5 divide-y text-sm">
          {b.items.map((i, idx) => (
            <div key={idx} className="flex justify-between py-2">
              <span>
                {i.qty} × {i.name}
              </span>
              <span>{money(i.price * i.qty)}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1 border-t pt-3 text-sm">
          <Row label="Subtotal" value={money(b.subtotal)} />
          {b.tax > 0 && <Row label="Tax" value={money(b.tax)} />}
          {b.discount > 0 && <Row label="Discount" value={`− ${money(b.discount)}`} />}
          <div className="flex justify-between pt-1 text-base font-bold">
            <span>Total</span>
            <span className="text-brand">{money(b.total)}</span>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Paid on {new Date(b.paidAt).toLocaleString()}
        </p>
      </div>

      <div className="mt-5 flex gap-2">
        <Link to="/menu" className="btn-outline flex-1">
          Order more
        </Link>
        <Link to="/history" className="btn-primary flex-1">
          My history
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
