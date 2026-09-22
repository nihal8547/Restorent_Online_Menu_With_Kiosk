// Socket.IO instance holder so any route can emit realtime events.
let io = null;

export function setIo(instance) {
  io = instance;
}

export function getIo() {
  return io;
}

/**
 * Emit an order-related event to all staff rooms.
 * Rooms: "kitchen" (KDS), "admin" (billing/dashboard), "waiters".
 */
export function emitOrderEvent(event, payload) {
  if (!io) return;
  io.to("kitchen").to("admin").to("waiters").emit(event, payload);
}

/**
 * Emit an event to a specific order's customer room.
 * Room name = "order:<orderToken>"
 * Used to push real-time status to the customer watching their order slip.
 */
export function emitToOrder(orderToken, event, payload) {
  if (!io || !orderToken) return;
  io.to(`order:${orderToken}`).emit(event, payload);
}

/**
 * Emit an event to ALL rooms (staff + dashboard).
 * Used for payment:done so dashboard/reports can refresh.
 */
export function emitGlobal(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}
