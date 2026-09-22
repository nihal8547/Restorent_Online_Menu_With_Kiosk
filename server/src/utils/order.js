import { prisma } from "../prisma.js";

// Default tax rate (e.g. 0 for none). Kept simple — configurable per deployment.
export const TAX_RATE = Number(process.env.TAX_RATE ?? 0);

/**
 * Build order totals from a list of resolved items and an optional discount.
 * Each item: { price (number), qty }
 */
export function computeTotals(items, discount = 0) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.price) * i.qty, 0);
  const tax = +(subtotal * TAX_RATE).toFixed(2);
  const total = Math.max(0, +(subtotal + tax - Number(discount || 0)).toFixed(2));
  return { subtotal: +subtotal.toFixed(2), tax, total };
}

/** Human readable order number, e.g. ORD-00042. */
export function formatOrderNo(id) {
  return `ORD-${String(id).padStart(5, "0")}`;
}

/**
 * Validate an incoming cart against the DB and return resolved order items
 * with server-trusted prices (never trust prices from the client).
 * cart: [{ menuItemId, qty, note? }]
 */
export async function resolveCartItems(cart) {
  if (!Array.isArray(cart) || cart.length === 0) {
    const err = new Error("Cart is empty");
    err.status = 400;
    throw err;
  }
  const ids = [...new Set(cart.map((c) => Number(c.menuItemId)))];
  const menuItems = await prisma.menuItem.findMany({ where: { id: { in: ids } } });
  const byId = new Map(menuItems.map((m) => [m.id, m]));

  return cart.map((c) => {
    const item = byId.get(Number(c.menuItemId));
    if (!item) {
      const err = new Error(`Menu item ${c.menuItemId} not found`);
      err.status = 400;
      throw err;
    }
    if (!item.available) {
      const err = new Error(`"${item.name}" is not available`);
      err.status = 400;
      throw err;
    }
    const qty = Math.max(1, parseInt(c.qty, 10) || 1);
    return {
      menuItemId: item.id,
      name: item.name,
      price: item.price, // Prisma Decimal — snapshot
      qty,
      note: c.note ? String(c.note).slice(0, 200) : null,
    };
  });
}
