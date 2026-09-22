import React, { useState, useEffect } from "react";
import { api } from "../../api.js";
import { useSettings } from "../../store/settings.js";
import { getSocket } from "../../socket.js";
import { 
  Bell, 
  Check, 
  X, 
  Sparkles, 
  UtensilsCrossed, 
  Receipt, 
  HelpCircle, 
  UserCheck, 
  Clock, 
  Radio
} from "lucide-react";

const ASSISTANCE_REASONS = [
  { label: "General Help", icon: HelpCircle },
  { label: "Ready to Order", icon: UtensilsCrossed },
  { label: "Water & Cutlery", icon: Sparkles },
  { label: "Bill Please", icon: Receipt },
];

export default function AssistanceDongle({ initialTableNo = null }) {
  const callWaiterEnabled = useSettings((s) => s.callWaiterEnabled);
  const [isOpen, setIsOpen] = useState(false);
  const [tableNo, setTableNo] = useState(initialTableNo || "");
  const [selectedReason, setSelectedReason] = useState("General Help");
  const [calling, setCalling] = useState(false);
  
  // Call status states: "IDLE" | "PENDING" | "ACCEPTED"
  const [callStatus, setCallStatus] = useState("IDLE");
  const [acceptedBy, setAcceptedBy] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  // Resolve table from props or sessionStorage
  useEffect(() => {
    if (initialTableNo) {
      setTableNo(String(initialTableNo));
    } else {
      try {
        const stored = sessionStorage.getItem("ev_table");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.no) setTableNo(String(parsed.no));
        }
      } catch (e) {}
    }
  }, [initialTableNo]);

  // Real-time Socket.IO listener for immediate call status change
  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const onAccepted = (data) => {
      // If accepted for this table, immediately update status in real time!
      if (tableNo && String(data.tableNo) === String(tableNo)) {
        setCallStatus("ACCEPTED");
        setAcceptedBy(data.acceptedBy || "Staff");
      }
    };

    s.on("assistance:accepted", onAccepted);

    return () => {
      s.off("assistance:accepted", onAccepted);
    };
  }, [tableNo]);

  // Check initial call status on mount or table change
  useEffect(() => {
    if (!tableNo) return;
    api.get(`/assistance/status?tableNo=${tableNo}`)
      .then(({ data }) => {
        if (data.status === "PENDING") {
          setCallStatus("PENDING");
          if (cooldown === 0) setCooldown(60);
        } else if (data.status === "ACCEPTED") {
          setCallStatus("ACCEPTED");
          setAcceptedBy(data.request?.acceptedBy || "Staff");
        }
      })
      .catch(() => {});
  }, [tableNo]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (callStatus === "PENDING") setCallStatus("IDLE");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown, callStatus]);

  // If disabled by Admin in Settings, don't render anything
  if (callWaiterEnabled === false) {
    return null;
  }

  const handleCall = async (e) => {
    if (e) e.preventDefault();
    const targetTable = String(tableNo || "").trim();
    if (!targetTable) {
      setErrorMsg("Please specify your table number");
      return;
    }

    setCalling(true);
    setErrorMsg("");

    try {
      await api.post("/assistance", {
        tableNo: targetTable,
        reason: selectedReason,
      });

      // Save table to session storage
      try {
        const current = sessionStorage.getItem("ev_table");
        if (!current) {
          sessionStorage.setItem("ev_table", JSON.stringify({ no: targetTable }));
        }
      } catch (err) {}

      setCallStatus("PENDING");
      setCooldown(60); // 60s cooldown
    } catch (err) {
      setErrorMsg(err.message || "Could not call waiter. Please try again.");
    } finally {
      setCalling(false);
    }
  };

  const isPending = callStatus === "PENDING";
  const isAccepted = callStatus === "ACCEPTED";
  const hasActiveCall = isPending || isAccepted;

  return (
    <>
      {/* Floating Concierge Bell Dongle */}
      <div className="fixed bottom-6 right-6 z-40 sm:bottom-8 sm:right-8 print:hidden">
        <button
          onClick={() => setIsOpen(true)}
          className={`group relative flex items-center gap-2.5 rounded-full px-4 py-3.5 shadow-2xl transition-all duration-300 active:scale-95 ${
            isAccepted
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/40 ring-4 ring-emerald-400/30"
              : isPending
              ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-amber-500/40 animate-pulse"
              : "bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 text-white shadow-rose-500/30 hover:brightness-110 hover:shadow-rose-500/50"
          }`}
          title="Call Waiter for Assistance"
          aria-label="Call Waiter"
        >
          {/* Animated Glow Halo */}
          {!hasActiveCall && (
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-400 to-rose-400 opacity-40 blur-sm group-hover:opacity-75 transition duration-500 animate-pulse" />
          )}

          <div className="relative flex items-center justify-center">
            {isAccepted ? (
              <UserCheck className="w-5 h-5 text-emerald-200 animate-bounce" />
            ) : isPending ? (
              <Radio className="w-5 h-5 text-amber-200 animate-spin" />
            ) : (
              <Bell className="w-5 h-5 animate-wiggle" />
            )}
          </div>

          <div className="relative flex flex-col text-left">
            <span className="text-xs sm:text-sm font-black tracking-wide uppercase leading-tight">
              {isAccepted
                ? `Attending: ${acceptedBy}`
                : isPending
                ? `Calling (${cooldown}s)`
                : "Call Waiter"}
            </span>
            {isAccepted && (
              <span className="text-[10px] font-bold text-emerald-100 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-200 animate-ping" />
                Staff On The Way
              </span>
            )}
          </div>

          {/* Table indicator badge if known */}
          {tableNo && !hasActiveCall && (
            <span className="relative rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold tracking-tight">
              T-{tableNo}
            </span>
          )}
        </button>
      </div>

      {/* Assistance Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in print:hidden">
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-scale-in relative text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* REALTIME ACCEPTED STATE */}
            {isAccepted ? (
              <div className="py-4 text-center animate-fade-in">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 border-2 border-emerald-300">
                  <UserCheck className="w-8 h-8 stroke-[2.5] animate-scale-in" />
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-700 border border-emerald-200 mb-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Realtime Update: Accepted
                </span>
                <h3 className="text-xl font-black text-slate-900">Waiter On The Way! 🎉</h3>
                <p className="mt-1 text-base font-bold text-emerald-600">
                  {acceptedBy} is attending Table {tableNo}
                </p>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                  Your assistance request was accepted. Please remain seated, staff will arrive in a moment.
                </p>

                <div className="mt-6 flex flex-col gap-2">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/25"
                  >
                    Got It, Thank You
                  </button>
                  <button
                    onClick={() => {
                      setCallStatus("IDLE");
                      setIsOpen(false);
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 py-1"
                  >
                    Need another request? Reset call
                  </button>
                </div>
              </div>
            ) : isPending ? (
              /* PENDING CALL STATE */
              <div className="py-4 text-center animate-fade-in">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 border border-amber-300">
                  <Bell className="w-8 h-8 animate-wiggle" />
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-700 border border-amber-200 mb-2">
                  <Radio className="w-3.5 h-3.5 animate-spin" />
                  Ringing Waiter Bells...
                </span>
                <h3 className="text-xl font-black text-slate-900">Ding Dong! 🛎️</h3>
                <p className="mt-1 text-sm font-semibold text-amber-700">
                  Notification Sent for Table {tableNo}
                </p>
                <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                  All active waiters have received your chime. This screen will <strong>instantly update</strong> as soon as a waiter accepts your call!
                </p>

                <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Call cooldown
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-800">{cooldown}s</p>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="mt-6 w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 transition"
                >
                  Close Window
                </button>
              </div>
            ) : (
              /* CALL TRIGGER FORM */
              <form onSubmit={handleCall} className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                    <Bell className="w-6 h-6 animate-wiggle" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Need Assistance?</h3>
                    <p className="text-xs text-slate-500">Ring our service bell anytime</p>
                  </div>
                </div>

                {/* Table Selection / Input */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Your Table Number
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={tableNo}
                      onChange={(e) => setTableNo(e.target.value)}
                      placeholder="Enter Table No (e.g. 5)"
                      className="input flex-1 font-bold text-base tracking-wide"
                      required
                      autoFocus={!tableNo}
                    />
                  </div>
                  {/* Quick table chips */}
                  <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
                    <span className="text-[10px] text-slate-400 font-semibold shrink-0">Quick:</span>
                    {["1", "2", "3", "4", "5", "6", "7", "8"].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setTableNo(num)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition shrink-0 ${
                          String(tableNo) === num
                            ? "bg-slate-900 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        T{num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assistance Reason Chips */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    How can we help?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ASSISTANCE_REASONS.map((reason) => {
                      const Icon = reason.icon;
                      const isSelected = selectedReason === reason.label;
                      return (
                        <button
                          key={reason.label}
                          type="button"
                          onClick={() => setSelectedReason(reason.label)}
                          className={`flex items-center gap-2 rounded-xl p-2.5 text-left text-xs font-bold transition border ${
                            isSelected
                              ? "border-amber-500 bg-amber-50/70 text-amber-900 shadow-sm"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-amber-600" : "text-slate-400"}`} />
                          <span className="truncate">{reason.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {errorMsg && (
                  <p className="text-xs font-semibold text-rose-500 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                    {errorMsg}
                  </p>
                )}

                {/* Submit Call Button */}
                <button
                  type="submit"
                  disabled={calling}
                  className="w-full rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-rose-500/25 hover:brightness-110 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Bell className="w-4 h-4" />
                  <span>{calling ? "Calling Waiter..." : "Ring Service Bell"}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
