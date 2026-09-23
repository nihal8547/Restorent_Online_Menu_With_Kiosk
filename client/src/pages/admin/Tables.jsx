import React, { useEffect, useState, useCallback } from "react";
import { api } from "../../api.js";
import { Spinner, Toast } from "../../components/ui.jsx";
import { subscribeOrders } from "../../socket.js";
import { useCoalescedCallback } from "../../hooks.js";
import { Bike } from "lucide-react";

export default function Tables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNo, setNewNo] = useState("");
  const [qr, setQr] = useState(null); // { tableNo, url, dataUrl }
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const { data } = await api.get("/tables");
    setTables(data.tables);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time: refresh tables when orders change (bursts coalesced into one refetch)
  const refresh = useCoalescedCallback(load, 500);
  useEffect(() => {
    return subscribeOrders("admin", { onNew: refresh, onUpdated: refresh });
  }, [refresh]);

  const addTable = async () => {
    if (!newNo.trim()) return;
    try {
      await api.post("/tables", { tableNo: newNo });
      setNewNo("");
      load();
    } catch (e) {
      setToast(e.message);
    }
  };

  const regenerate = async (t) => {
    if (!confirm(`Regenerate QR for table ${t.tableNo}? The old printed QR will stop working.`)) return;
    await api.post(`/tables/${t.id}/regenerate`);
    setToast("QR regenerated — reprint the code");
    load();
  };

  const showQr = async (t) => {
    const { data } = await api.get(`/tables/${t.id}/qr`);
    setQr(data);
  };

  const remove = async (t) => {
    if (!confirm(`Delete table ${t.tableNo}?`)) return;
    await api.delete(`/tables/${t.id}`);
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h1 className="text-xl font-bold">Tables & QR Codes</h1>
      </div>

      {/* Public Delivery Link Card */}
      <div className="card mb-6 p-4 border border-brand/20 bg-brand/5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-brand flex items-center gap-2">
              <Bike className="w-4 h-4" /> Public Delivery Link
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Share this link on social media. Orders placed through it will be locked to <strong className="text-slate-700">Delivery Only</strong> and require an address.
            </p>
            <div className="mt-3 flex gap-2 items-center">
              <input 
                readOnly 
                className="input !py-1.5 !text-xs w-full sm:w-80 bg-white" 
                value={`${window.location.origin}/menu?mode=delivery`} 
              />
              <button 
                className="btn-primary !py-1.5 !text-xs shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/menu?mode=delivery`);
                  setToast("Link copied to clipboard!");
                }}
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-6 flex gap-2 p-4">
        <input className="input" placeholder="Table number / name" value={newNo} onChange={(e) => setNewNo(e.target.value)} />
        <button className="btn-primary" onClick={addTable}>
          Add Table
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">Table {t.tableNo}</span>
              {!t.active && <span className="text-xs text-gray-400">inactive</span>}
            </div>
            <p className="mt-1 break-all text-xs text-gray-400">{t.menuUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary btn-sm" onClick={() => showQr(t)}>
                View QR
              </button>
              <button className="btn-outline btn-sm" onClick={() => regenerate(t)}>
                Regenerate
              </button>
              <button className="btn-outline btn-sm text-red-600" onClick={() => remove(t)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {qr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setQr(null)}>
          <div className="card w-full max-w-xs p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-bold">Table {qr.tableNo}</h3>
            <img src={qr.dataUrl} alt="QR" className="mx-auto w-full max-w-[240px]" />
            <p className="mt-2 break-all text-xs text-gray-400">{qr.url}</p>
            <div className="mt-4 flex gap-2">
              <a className="btn-outline flex-1" href={qr.dataUrl} download={`table-${qr.tableNo}-qr.png`}>
                Download
              </a>
              <button className="btn-primary flex-1" onClick={() => setQr(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
