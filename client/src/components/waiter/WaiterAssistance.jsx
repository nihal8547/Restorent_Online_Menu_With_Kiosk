import React, { useEffect, useState, useRef } from "react";
import { api } from "../../api.js";
import { getSocket } from "../../socket.js";
import { Bell, Check, Clock, UserCheck } from "lucide-react";

// Web Audio API Ding-Dong Chime Synthesizer
function playDingDongSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime;

    // --- "DING" TONE (High Pitch Bell - ~830 Hz) ---
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(830.61, t); // G#5

    gain1.gain.setValueAtTime(0.0001, t);
    gain1.gain.exponentialRampToValueAtTime(0.45, t + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.7);

    // --- "DONG" TONE (Lower Pitch Resonant Bell - ~554 Hz) ~280ms later ---
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(554.37, t + 0.28); // C#5

    gain2.gain.setValueAtTime(0.0001, t + 0.28);
    gain2.gain.exponentialRampToValueAtTime(0.55, t + 0.32);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 1.45);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.28);
    osc2.stop(t + 1.5);
  } catch (err) {
    console.warn("Audio notification chime error:", err);
  }
}

export default function WaiterAssistance() {
  const [requests, setRequests] = useState([]);
  const [acceptedToast, setAcceptedToast] = useState(null);
  const audioUnlockedRef = useRef(false);

  // Unlock AudioContext on first user interaction so chime plays seamlessly
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const testCtx = new AudioCtx();
          if (testCtx.state === "suspended") {
            testCtx.resume();
          }
          audioUnlockedRef.current = true;
        }
      } catch (e) {}
    };

    window.addEventListener("click", unlockAudio, { once: true });
    window.addEventListener("touchstart", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  useEffect(() => {
    // Initial fetch of any currently pending assistance calls
    api.get("/assistance")
      .then(({ data }) => {
        if (Array.isArray(data)) setRequests(data);
      })
      .catch(console.error);

    const s = getSocket();
    if (!s) return;

    const onNew = (req) => {
      setRequests((prev) => {
        if (prev.find((r) => r.id === req.id)) return prev;
        return [req, ...prev];
      });

      // Play authentic "Ding Dong" chime sound
      playDingDongSound();
    };

    const onAccepted = (data) => {
      // Instantly remove request from other waiters' screens
      setRequests((prev) => prev.filter((r) => r.id !== data.id));

      if (data.acceptedBy) {
        setAcceptedToast(`Table ${data.tableNo} attended by ${data.acceptedBy}`);
        setTimeout(() => setAcceptedToast(null), 4000);
      }
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
      // Optimistically remove from this waiter's view
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error("Failed to accept assistance request", e);
      // If error (e.g. 404 already accepted by someone else), remove it
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
  };

  if (requests.length === 0 && !acceptedToast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[999] flex flex-col gap-3 pointer-events-none max-w-sm w-full sm:w-80">
      {/* Accepted feedback notice */}
      {acceptedToast && (
        <div className="pointer-events-auto bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-fade-in border border-emerald-500">
          <UserCheck className="w-4 h-4 shrink-0 text-emerald-200" />
          <span className="truncate">{acceptedToast}</span>
        </div>
      )}

      {/* Active Waiter Call Cards */}
      {requests.map((req) => (
        <div 
          key={req.id} 
          className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl p-4 flex flex-col gap-3 pointer-events-auto border-2 border-amber-500/80 animate-bounce-subtle"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-11 w-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <Bell className="w-5 h-5 animate-wiggle" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-extrabold text-amber-400">
                  Customer Calling
                </p>
                <p className="text-xl font-black tracking-tight text-white">
                  Table {req.tableNo}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
              <Clock className="w-3 h-3" />
              <span>Now</span>
            </div>
          </div>

          {req.reason && req.reason !== "General Assistance" && (
            <div className="bg-slate-800/80 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-medium border border-slate-700/50">
              Note: <span className="text-amber-200 font-semibold">{req.reason}</span>
            </div>
          )}

          <button 
            onClick={() => acceptRequest(req.id)}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition flex items-center justify-center gap-2 text-sm"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Accept & Attend</span>
          </button>
        </div>
      ))}
    </div>
  );
}

