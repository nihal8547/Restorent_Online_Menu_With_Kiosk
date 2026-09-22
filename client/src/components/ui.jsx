import React from "react";
import { X } from "lucide-react";

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />
    </div>
  );
}

export function Empty({ children }) {
  return <div className="py-10 text-center text-sm text-gray-500">{children}</div>;
}

const STATUS_STYLES = {
  NEW: "bg-blue-100 text-blue-700",
  PREPARING: "bg-amber-100 text-amber-700",
  READY: "bg-emerald-100 text-emerald-700",
  SERVED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-700",
  PAID: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-orange-100 text-orange-700",
};

export function StatusBadge({ value }) {
  return <span className={`badge ${STATUS_STYLES[value] || "bg-gray-100 text-gray-600"}`}>{value}</span>;
}

export function TypeBadge({ value }) {
  const map = { DINE_IN: "Dine-in", DELIVERY: "Delivery", TAKEAWAY: "Takeaway" };
  return <span className="badge bg-gray-100 text-gray-600">{map[value] || value}</span>;
}

export function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
      {message}
      <button className="ml-3 text-gray-300 hover:text-white" onClick={onClose}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
