import { prisma } from "../prisma.js";

/**
 * Build order totals from a list of resolved items, an optional discount and a
 * tax rate (fraction, e.g. 0.05 for 5%). Tax is applied on (subtotal - discount).
 * Each item: { price (number), qty }
 */
export function computeTotals(items, discount = 0, taxRate = 0) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.price) * i.qty, 0);
  const taxable = Math.max(0, subtotal - Number(discount || 0));
  const tax = +(taxable * (Number(taxRate) || 0)).toFixed(2);
  const total = Math.max(0, +(taxable + tax).toFixed(2));
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
    // Inventory: block ordering more than what's in stock for tracked items.
    if (item.trackStock && item.stockQty < qty) {
      const err = new Error(
        item.stockQty <= 0
          ? `"${item.name}" is out of stock`
          : `Only ${item.stockQty} left of "${item.name}"`
      );
      err.status = 400;
      throw err;
    }
    return {
      menuItemId: item.id,
      name: item.name,
      price: item.price, // Prisma Decimal — snapshot
      qty,
      note: c.note ? String(c.note).slice(0, 200) : null,
      trackStock: item.trackStock,
    };
  });
}

/**
 * Within a transaction, decrement stock for tracked items and log the movement.
 * Called after order items are created. `resolved` is the resolveCartItems output.
 */
export async function applyStockForSale(tx, resolved) {
  for (const r of resolved) {
    if (!r.trackStock) continue;
    const updated = await tx.menuItem.update({
      where: { id: r.menuItemId },
      data: {
        stockQty: { decrement: r.qty },
        // Auto mark unavailable once it hits zero.
      },
      select: { stockQty: true },
    });
    await tx.stockMovement.create({
      data: {
        menuItemId: r.menuItemId,
        change: -r.qty,
        balance: updated.stockQty,
        reason: "SALE",
      },
    });
    if (updated.stockQty <= 0) {
      await tx.menuItem.update({ where: { id: r.menuItemId }, data: { available: false } });
    }
  }
}
