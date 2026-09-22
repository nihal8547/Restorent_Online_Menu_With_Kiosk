// Socket.IO instance holder so any route can emit realtime events.
let io = null;

export function setIo(instance) {
  io = instance;
}

export function getIo() {
  return io;
}

/**
 * Emit an order-related event to the relevant rooms.
 * Rooms: "kitchen" (KDS), "admin" (billing), "waiters" (placed orders view).
 */
export function emitOrderEvent(event, payload) {
  if (!io) return;
  io.to("kitchen").to("admin").to("waiters").emit(event, payload);
}
