import React, { useEffect, useState, useCallback } from "react";
import { api, money } from "../../api.js";
import { Spinner, Empty, StatusBadge } from "../../components/ui.jsx";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get("/customers", { params: { q } });
    setCustomers(data.customers);
    setLoading(false);
  }, [q]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const openHistory = async (c) => {
    setSelected(c);
    setHistory(null);
    const { data } = await api.get(`/customers/${encodeURIComponent(c.phone)}/orders`);
    setHistory(data.orders);
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Customers (CRM)</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="mb-4 flex gap-2"
      >
        <input className="input" placeholder="Search by phone or name" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary">Search</button>
      </form>

      {loading ? (
        <Spinner />
      ) : customers.length === 0 ? (
        <Empty>No customers yet.</Empty>
      ) : (
        <div className="card divide-y">
          {customers.map((c) => (
            <button key={c.id} onClick={() => openHistory(c)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-gray-50">
              <div className="flex-1">
                <p className="font-medium">{c.name || "Guest"}</p>
                <p className="text-xs text-gray-500">{c.phone}{c.lastZone ? ` · ${c.lastZone}` : ""}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-gray-500">{c.orderCount} orders</p>
                <p className="font-semibold text-emerald-600">{money(c.collected)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="card max-h-[80vh] w-full max-w-md overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold">{selected.name || "Guest"}</h3>
                <p className="text-xs text-gray-500">{selected.phone}</p>
              </div>
              <button className="btn-outline btn-sm" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            {!history ? (
              <Spinner />
            ) : (
              <div className="space-y-2">
                {history.map((o) => (
                  <div key={o.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-semibold">{o.orderNo}</span>
                      <span className="flex gap-2">
                        <StatusBadge value={o.paymentStatus} />
                        <span className="font-semibold text-brand">{money(o.total)}</span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
