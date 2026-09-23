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
  Radio,
  QrCode,
  CheckCircle2,
  Edit3,
  Coffee
} from "lucide-react";

const ASSISTANCE_REASONS = [
  { label: "General Help", desc: "Staff assistance at table", icon: HelpCircle },
  { label: "Ready to Order", desc: "Take our food or drink order", icon: UtensilsCrossed },
  { label: "Water & Cutlery", desc: "Glasses, tissues, napkins", icon: Sparkles },
  { label: "Bill Please", desc: "Check & payment request", icon: Receipt },
  { label: "Clean Table", desc: "Clear plates or wipe table", icon: Coffee },
];

// Removed hardcoded QUICK_TABLES

export default function AssistanceDongle({ initialTableNo = null }) {
  const callWaiterEnabled = useSettings((s) => s.callWaiterEnabled);
  const [isOpen, setIsOpen] = useState(false);
  const [tableNo, setTableNo] = useState(initialTableNo || "");
  const [isQrAutoFetched, setIsQrAutoFetched] = useState(false);
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [selectedReason, setSelectedReason] = useState("General Help");
  const [calling, setCalling] = useState(false);
  
  // Call status states: "IDLE" | "PENDING" | "ACCEPTED"
  const [callStatus, setCallStatus] = useState("IDLE");
  const [acceptedBy, setAcceptedBy] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [showTextPeek, setShowTextPeek] = useState(true);
  const [configuredTables, setConfiguredTables] = useState([]);

  useEffect(() => {
    api.get("/tables")
      .then(({ data }) => setConfiguredTables(data.tables || []))
      .catch(() => {});
  }, []);

  // Resolve table from props or sessionStorage
  useEffect(() => {
    if (initialTableNo) {
      setTableNo(String(initialTableNo));
      setIsQrAutoFetched(true);
    } else {
      try {
        const stored = sessionStorage.getItem("ev_table");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.no) {
            setTableNo(String(parsed.no));
            setIsQrAutoFetched(true);
          }
        }
      } catch (e) {}
    }
  }, [initialTableNo]);

  // Real-time Socket.IO listener for immediate call status change
  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const onAccepted = (data) => {
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

  // Auto-peek text briefly on mount and periodically every 16 seconds
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      setShowTextPeek(false);
    }, 4000);

    const interval = setInterval(() => {
      setShowTextPeek(true);
      setTimeout(() => {
        setShowTextPeek(false);
      }, 3500);
    }, 16000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  // If disabled by Admin in Settings, don't render anything
  if (callWaiterEnabled === false) {
    return null;
  }

  const handleCall = async (e) => {
    if (e) e.preventDefault();
    const targetTable = String(tableNo || "").trim();
    if (!targetTable) {
      setErrorMsg("Please select or enter your table number");
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
      {/* Floating Concierge Bell Dongle (Icon-only default with periodic smooth text peek) */}
      <div className="fixed bottom-24 right-4 sm:bottom-28 sm:right-6 md:bottom-28 md:right-8 z-40 print:hidden">
        <button
          onClick={() => setIsOpen(true)}
          onMouseEnter={() => setShowTextPeek(true)}
          onMouseLeave={() => setShowTextPeek(false)}
          className={`group relative flex items-center shadow-2xl transition-all duration-300 active:scale-95 rounded-full p-3 sm:p-3.5 ${
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

          {/* Bell / Status Icon */}
          <div className="relative flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center shrink-0">
            {isAccepted ? (
              <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-200 animate-bounce" />
            ) : isPending ? (
              <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-amber-200 animate-spin" />
            ) : (
              <Bell className="w-5 h-5 sm:w-6 sm:h-6 animate-wiggle" />
            )}
          </div>

          {/* Auto-Expanding Text Peek */}
          <div
            className={`overflow-hidden transition-all duration-500 ease-out flex items-center whitespace-nowrap ${
              showTextPeek || hasActiveCall
                ? "max-w-xs pl-2 pr-1 opacity-100"
                : "max-w-0 pl-0 pr-0 opacity-0"
            }`}
          >
            <div className="flex flex-col text-left">
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
          </div>

          {/* Table indicator badge if known */}
          {tableNo && !hasActiveCall && (
            <span className="absolute -top-1.5 -left-1.5 rounded-full bg-[#120f12] text-amber-300 text-[10px] font-black px-2 py-0.5 border border-white/20 shadow-md">
              T{tableNo}
            </span>
          )}
        </button>
      </div>

      {/* Assistance Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in print:hidden"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-scale-in relative text-slate-900 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* REALTIME ACCEPTED STATE */}
            {isAccepted ? (
              <div className="py-4 text-center animate-fade-in">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 border-2 border-emerald-300 shadow-lg shadow-emerald-500/20">
                  <UserCheck className="w-8 h-8 stroke-[2.5] animate-scale-in" />
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-700 border border-emerald-200 mb-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Staff Dispatched
                </span>
                <h3 className="text-2xl font-black text-slate-900">Waiter On The Way! 🎉</h3>
                <div className="mt-3 p-3 rounded-2xl bg-emerald-50/80 border border-emerald-100">
                  <p className="text-sm font-bold text-emerald-800">
                    <span className="font-extrabold text-emerald-600">{acceptedBy}</span> is coming to Table {tableNo}
                  </p>
                </div>
                <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                  Your assistance call was accepted. Please relax, our team will arrive at your table shortly.
                </p>

                <div className="mt-6 flex flex-col gap-2">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-full rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/25"
                  >
                    Got It, Thank You
                  </button>
                  <button
                    onClick={() => {
                      setCallStatus("IDLE");
                      setIsOpen(false);
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 py-1.5"
                  >
                    Need another request? Reset call
                  </button>
                </div>
              </div>
            ) : isPending ? (
              /* PENDING CALL STATE */
              <div className="py-4 text-center animate-fade-in">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 border border-amber-300 shadow-lg shadow-amber-500/20">
                  <Bell className="w-8 h-8 animate-wiggle" />
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-700 border border-amber-200 mb-2">
                  <Radio className="w-3.5 h-3.5 animate-spin" />
                  Ringing Waiter Alert...
                </span>
                <h3 className="text-2xl font-black text-slate-900">Ding Dong! 🛎️</h3>
                <div className="mt-2 inline-block px-3 py-1 bg-amber-100 rounded-xl text-amber-900 text-sm font-bold">
                  Request sent for Table #{tableNo}
                </div>
                <p className="mt-3 text-xs text-slate-500 leading-relaxed px-4">
                  Waiters on floor have received your alert. This screen will <strong>instantly update</strong> the second a waiter accepts!
                </p>

                <div className="mt-5 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Call cooldown timer
                  </p>
                  <p className="mt-1 text-3xl font-black text-slate-800 font-mono">{cooldown}s</p>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="mt-6 w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white hover:bg-slate-800 transition"
                >
                  Close & Keep Waiting
                </button>
              </div>
            ) : (
              /* CALL TRIGGER FORM */
              <form onSubmit={handleCall} className="space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3.5 border-b border-slate-100 pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-md shadow-rose-500/20">
                    <Bell className="w-6 h-6 animate-wiggle" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Need Assistance?</h3>
                    <p className="text-xs text-slate-500">Instant floor concierge & table service</p>
                  </div>
                </div>

                {/* TABLE NUMBER SECTION */}
                <div>
                  {isQrAutoFetched && !isEditingTable ? (
                    /* Auto-Fetched Table Badge */
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-3.5 border border-emerald-200/80 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25 shrink-0">
                            <QrCode className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                QR Auto-Detected
                              </span>
                            </div>
                            <h4 className="text-lg font-black text-slate-900 mt-0.5">
                              Table #{tableNo}
                            </h4>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsEditingTable(true)}
                          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-emerald-100/60 transition border border-emerald-200/60"
                          title="Change table number"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Change</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Manual Table Selector & Quick Chips */
                    <div className="rounded-2xl bg-stone-50/80 p-3.5 border border-stone-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <span>Table Number</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        {isQrAutoFetched && (
                          <button
                            type="button"
                            onClick={() => setIsEditingTable(false)}
                            className="text-[11px] font-bold text-emerald-600 hover:underline"
                          >
                            Revert to QR (T#{tableNo})
                          </button>
                        )}
                      </div>

                      {/* Custom Input */}
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 text-slate-400 font-black text-sm">#</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={tableNo}
                          onChange={(e) => setTableNo(e.target.value)}
                          placeholder="Type table (e.g. 5 or VIP-2)"
                          className="w-full rounded-xl bg-white border border-slate-200 pl-8 pr-9 py-2.5 text-sm font-black text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-sm"
                          required
                          autoFocus={!tableNo}
                        />
                        {tableNo && (
                          <button
                            type="button"
                            onClick={() => setTableNo("")}
                            className="absolute right-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Premium Quick Table Chips Grid */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                            Quick Select
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">Tap your table</span>
                        </div>
                        <div className="grid grid-cols-6 gap-1.5 sm:gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                          {configuredTables.map((t) => {
                            const num = String(t.tableNo);
                            const isSelected = String(tableNo) === num;
                            return (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setTableNo(num)}
                                className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs font-black transition-all active:scale-95 ${
                                  isSelected
                                    ? "bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400 scale-105"
                                    : "bg-white text-slate-700 border border-slate-200/80 hover:border-amber-300 hover:bg-amber-50/50 shadow-xs"
                                }`}
                              >
                                <span>T{num}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ASSISTANCE REASON SELECTION */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                    How can we help you?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ASSISTANCE_REASONS.map((reason) => {
                      const Icon = reason.icon;
                      const isSelected = selectedReason === reason.label;
                      return (
                        <button
                          key={reason.label}
                          type="button"
                          onClick={() => setSelectedReason(reason.label)}
                          className={`flex items-start gap-2.5 rounded-2xl p-2.5 text-left transition-all border active:scale-[0.98] ${
                            isSelected
                              ? "border-amber-500 bg-gradient-to-r from-amber-50/90 to-rose-50/50 text-slate-900 shadow-sm ring-1 ring-amber-400/40"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                              isSelected
                                ? "bg-amber-500 text-white shadow-sm"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold truncate text-slate-900">{reason.label}</p>
                            <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">{reason.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {errorMsg && (
                  <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-2xl border border-rose-200 animate-shake">
                    {errorMsg}
                  </p>
                )}

                {/* Submit Call Button */}
                <button
                  type="submit"
                  disabled={calling || !tableNo}
                  className="w-full rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-rose-500/25 hover:brightness-110 active:scale-[0.98] transition flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Bell className="w-4 h-4" />
                  <span>
                    {calling
                      ? "Calling Waiter..."
                      : tableNo
                      ? `Ring Waiter for Table ${tableNo}`
                      : "Select Table to Ring Waiter"}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
