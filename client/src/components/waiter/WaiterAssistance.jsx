import React, { useEffect, useState } from "react";
import { api } from "../../api.js";
import { getSocket } from "../../socket.js";
import { Bell, Check } from "lucide-react";

export default function WaiterAssistance() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    // Initial fetch
    api.get("/assistance").then(({ data }) => setRequests(data)).catch(console.error);

    const s = getSocket();

    const onNew = (req) => {
      setRequests((prev) => {
        if (prev.find((r) => r.id === req.id)) return prev;
        return [...prev, req];
      });
      
      // Play a subtle notification sound (if allowed by browser)
      try {
        const audio = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...");
        // In a real app we'd put a small sound file in public dir, e.g., "/bell.mp3"
        // audio.play();
      } catch (e) {}
    };

    const onAccepted = (data) => {
      setRequests((prev) => prev.filter((r) => r.id !== data.id));
    };

    s.on("assistance:new", onNew);
    s.on("assistance:accepted", onAccepted);

    return () => {
      s.off("assistance:new", onNew);
      s.off("assistance:accepted", onAccepted);
    };
  }, []);

  const acceptRequest = async (id) => {
    try {
      await api.post(`/assistance/${id}/accept`);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error("Failed to accept assistance request", e);
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
      {requests.map((req) => (
        <div 
          key={req.id} 
          className="bg-slate-900 text-white rounded-2xl shadow-2xl p-4 w-72 flex flex-col gap-3 pointer-events-auto border border-slate-800 animate-fade-up"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand/20 flex items-center justify-center text-brand shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Assistance Needed</p>
              <p className="text-lg font-black tracking-wide text-brand-light">Table {req.tableNo}</p>
            </div>
          </div>
          <button 
            onClick={() => acceptRequest(req.id)}
            className="btn-primary w-full !py-2 !rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Accept Request</span>
          </button>
        </div>
      ))}
    </div>
  );
}
