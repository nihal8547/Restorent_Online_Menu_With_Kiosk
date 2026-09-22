import { io } from "socket.io-client";

// Shared socket connection. Connects lazily.
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io("/", { path: "/socket.io", autoConnect: true });
  }
  return socket;
}

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
