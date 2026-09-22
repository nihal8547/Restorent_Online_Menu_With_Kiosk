import { io } from "socket.io-client";

// Shared socket connection. Connects lazily on first use.
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io("/", { path: "/socket.io", autoConnect: true });
  }
  return socket;
}

// ─── Staff rooms ────────────────────────────────────────────────────────────

// Join a room ("kitchen" | "admin" | "waiters") and subscribe to order events.
// Returns an unsubscribe function (use inside a useEffect cleanup).
export function subscribeOrders(room, handlers) {
  const s = getSocket();
  s.emit("join", room);
  if (handlers.onNew) s.on("order:new", handlers.onNew);
  if (handlers.onUpdated) s.on("order:updated", handlers.onUpdated);
  return () => {
    if (handlers.onNew) s.off("order:new", handlers.onNew);
    if (handlers.onUpdated) s.off("order:updated", handlers.onUpdated);
  };
}

// ─── Dashboard / Reports ─────────────────────────────────────────────────────

// Subscribe to payment:done events (for dashboard KPI refresh).
// Also hooks order:new + order:updated for pending count.
export function subscribeGlobal(handlers) {
  const s = getSocket();
  s.emit("join", "admin"); // admin room for order events
  if (handlers.onPayment) s.on("payment:done", handlers.onPayment);
  if (handlers.onNew) s.on("order:new", handlers.onNew);
  if (handlers.onUpdated) s.on("order:updated", handlers.onUpdated);
  return () => {
    if (handlers.onPayment) s.off("payment:done", handlers.onPayment);
    if (handlers.onNew) s.off("order:new", handlers.onNew);
    if (handlers.onUpdated) s.off("order:updated", handlers.onUpdated);
  };
}

// ─── Customer: per-order status tracking ─────────────────────────────────────

// Join a specific order's room and listen for status changes.
// Used by OrderSlip and BillView.
export function watchOrder(orderToken, onStatusChange) {
  const s = getSocket();
  s.emit("watch:order", orderToken);
  s.on("order:status", onStatusChange);
  return () => {
    s.off("order:status", onStatusChange);
  };
}
