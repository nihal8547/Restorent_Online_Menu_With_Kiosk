import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { resolveCartItems, computeTotals, formatOrderNo } from "../utils/order.js";
import { emitOrderEvent } from "../socket.js";

const router = Router();

const orderInclude = {
  items: true,
  table: { select: { id: true, tableNo: true } },
  deliveryInfo: true,
  placedBy: { select: { id: true, name: true, role: true } },
  payments: true,
};

// Upsert a lightweight CRM customer record from a phone number.
async function upsertCustomer(phone, name, zone) {
  if (!phone) return;
  try {
    await prisma.customer.upsert({
      where: { phone: String(phone).trim() },
      update: {
        ...(name && { name: String(name).trim() }),
        ...(zone && { lastZone: String(zone).trim() }),
      },
      create: {
        phone: String(phone).trim(),
        name: name ? String(name).trim() : null,
        lastZone: zone ? String(zone).trim() : null,
      },
    });
  } catch {
    /* non-fatal */
  }
}

/**
 * Shared order creation used by customers, waiters and platform webhooks.
 * opts: { type, tableId, placedById, customerPhone, note, discount, delivery, source, externalId }
 */
export async function createOrder(cart, opts = {}) {
  const resolved = await resolveCartItems(cart);
  const totals = computeTotals(
    resolved.map((r) => ({ price: Number(r.price), qty: r.qty })),
    opts.discount || 0
  );

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        type: opts.type || "DINE_IN",
        source: opts.source || "IN_HOUSE",
        externalId: opts.externalId || null,
        tableId: opts.tableId || null,
        placedById: opts.placedById || null,
        customerPhone: opts.customerPhone ? String(opts.customerPhone).trim() : null,
        note: opts.note ? String(opts.note).slice(0, 500) : null,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: Number(opts.discount || 0),
        total: totals.total,
        items: {
          create: resolved.map((r) => ({
            menuItemId: r.menuItemId,
            name: r.name,
            price: r.price,
            qty: r.qty,
            note: r.note,
          })),
        },
        ...(opts.delivery && {
          deliveryInfo: {
            create: {
              name: String(opts.delivery.name).trim(),
              phone: String(opts.delivery.phone).trim(),
              street: String(opts.delivery.street).trim(),
              buildingNo: String(opts.delivery.buildingNo).trim(),
              room: opts.delivery.room ? String(opts.delivery.room).trim() : null,
              zone: String(opts.delivery.zone).trim(),
            },
          },
        }),
      },
    });
    // set human readable order number now that we have the id
    return tx.order.update({
      where: { id: created.id },
      data: { orderNo: formatOrderNo(created.id) },
      include: orderInclude,
    });
  });

  // CRM: remember the customer
  const phone = opts.customerPhone || opts.delivery?.phone;
  await upsertCustomer(phone, opts.delivery?.name, opts.delivery?.zone);

  emitOrderEvent("order:new", order);
  return order;
}

/**
 * Find the current OPEN (running-tab) dine-in order for a table:
 * an order that is dine-in, not cancelled and not yet paid. That is the bill
 * that further orders for the same table attach to.
 */
export function findOpenTableOrder(tableId) {
  return prisma.order.findFirst({
    where: {
      tableId,
      type: "DINE_IN",
      paymentStatus: "PENDING",
      status: { not: "CANCELLED" },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Append items to an existing open order (running tab), recompute totals and
 * re-open it for the kitchen if it had already been served/ready.
 */
export async function appendItemsToOrder(open, cart, opts = {}) {
  const resolved = await resolveCartItems(cart);

  const order = await prisma.$transaction(async (tx) => {
    await tx.orderItem.createMany({
      data: resolved.map((r) => ({
        orderId: open.id,
        menuItemId: r.menuItemId,
        name: r.name,
        price: r.price,
        qty: r.qty,
        note: r.note,
      })),
    });
    const items = await tx.orderItem.findMany({ where: { orderId: open.id } });
    const totals = computeTotals(
      items.map((i) => ({ price: Number(i.price), qty: i.qty })),
      open.discount
    );
    // If the previous round was already Ready/Served, bring it back to NEW so
    // the kitchen sees the newly added items.
    const status = open.status === "READY" || open.status === "SERVED" ? "NEW" : open.status;
    const mergedNote = opts.note
      ? [open.note, String(opts.note).slice(0, 200)].filter(Boolean).join(" | ")
      : open.note;

    return tx.order.update({
      where: { id: open.id },
      data: {
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        status,
        note: mergedNote ? mergedNote.slice(0, 500) : null,
        ...(opts.customerPhone && !open.customerPhone && {
          customerPhone: String(opts.customerPhone).trim(),
        }),
      },
      include: orderInclude,
    });
  });

  emitOrderEvent("order:updated", order);
  return order;
}

/** Resolve a dine-in table from a QR token or a typed table number. */
async function resolveDineInTable({ tableToken, tableNo }) {
  if (tableToken) {
    const t = await prisma.restaurantTable.findUnique({ where: { qrToken: tableToken } });
    if (!t || !t.active) {
      const e = new Error("Invalid table QR");
      e.status = 400;
      throw e;
    }
    return t.id;
  }
  if (tableNo !== undefined && tableNo !== null && String(tableNo).trim() !== "") {
    const t = await prisma.restaurantTable.findUnique({ where: { tableNo: String(tableNo).trim() } });
    if (!t || !t.active) {
      const e = new Error(`Table "${tableNo}" not found`);
      e.status = 400;
      throw e;
    }
    return t.id;
  }
  const e = new Error("A table (QR or table number) is required for dine-in");
  e.status = 400;
  throw e;
}

// ---------- Public: place an order (customer self-order) ----------
// POST /api/orders  { type, tableToken?, tableNo?, cart, note?, delivery? }
router.post("/", async (req, res, next) => {
  try {
    const { type, tableToken, tableNo, cart, note, delivery, customerPhone } = req.body || {};
    const orderType = type || (tableToken ? "DINE_IN" : "TAKEAWAY");

    let tableId = null;
    if (orderType === "DINE_IN") {
      tableId = await resolveDineInTable({ tableToken, tableNo });

      // Running tab: if this table already has an open (unpaid) bill, attach to it.
      const open = await findOpenTableOrder(tableId);
      if (open) {
        const order = await appendItemsToOrder(open, cart, { note, customerPhone });
        return res.status(200).json({
          orderNo: order.orderNo,
          orderToken: order.orderToken,
          status: order.status,
          merged: true,
        });
      }
    }

    if (orderType === "DELIVERY") {
      const d = delivery || {};
      const missing = ["name", "phone", "street", "buildingNo", "zone"].filter((k) => !d[k]);
      if (missing.length) {
        return res.status(400).json({ error: `Delivery details required: ${missing.join(", ")}` });
      }
    }

    const order = await createOrder(cart, {
      type: orderType,
      tableId,
      customerPhone: customerPhone || delivery?.phone || null,
      note,
      delivery: orderType === "DELIVERY" ? delivery : null,
    });

    // Only expose the token (for the bill link), not internal details.
    res.status(201).json({
      orderNo: order.orderNo,
      orderToken: order.orderToken,
      status: order.status,
      merged: false,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// ---------- Waiter/staff: place an order on behalf of a table ----------
// POST /api/orders/staff  { type, tableId?, cart, note?, customerPhone? }
router.post("/staff", requireAuth, requireRole("WAITER", "ADMIN", "CASHIER"), async (req, res, next) => {
  try {
    const { type, tableId, cart, note, customerPhone, delivery } = req.body || {};
    const orderType = type || "DINE_IN";
    if (orderType === "DINE_IN" && !tableId) {
      return res.status(400).json({ error: "tableId is required for dine-in" });
    }

    // Running tab: attach to the table's open bill if one exists.
    if (orderType === "DINE_IN") {
      const open = await findOpenTableOrder(Number(tableId));
      if (open) {
        const order = await appendItemsToOrder(open, cart, { note, customerPhone });
        return res.status(200).json({ order, merged: true });
      }
    }

    const order = await createOrder(cart, {
      type: orderType,
      tableId: tableId ? Number(tableId) : null,
      placedById: req.user.id,
      customerPhone,
      note,
      delivery: orderType === "DELIVERY" ? delivery : null,
    });
    res.status(201).json({ order, merged: false });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// ---------- Staff: list orders (kitchen / admin / waiter) ----------
// GET /api/orders?status=NEW,PREPARING&type=DINE_IN&mine=1&today=1
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) {
      where.status = { in: String(req.query.status).split(",") };
    }
    if (req.query.type) where.type = String(req.query.type);
    if (req.query.paymentStatus) where.paymentStatus = String(req.query.paymentStatus);
    if (req.query.mine === "1") where.placedById = req.user.id;
    if (req.query.today === "1") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      where.createdAt = { gte: start };
    }
    const orders = await prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(req.query.limit) || 100, 200),
    });
    res.json({ orders });
  } catch (e) {
    next(e);
  }
});

// GET /api/orders/:id  (staff)
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: orderInclude,
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ order });
  } catch (e) {
    next(e);
  }
});

// ---------- Staff: update order status (kitchen flow) ----------
// PATCH /api/orders/:id/status  { status }
const STATUSES = ["NEW", "PREPARING", "READY", "SERVED", "CANCELLED"];
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("KITCHEN", "ADMIN", "WAITER", "CASHIER"),
  async (req, res, next) => {
    try {
      const { status } = req.body || {};
      if (!STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
      const order = await prisma.order.update({
        where: { id: Number(req.params.id) },
        data: { status },
        include: orderInclude,
      });
      emitOrderEvent("order:updated", order);
      res.json({ order });
    } catch (e) {
      next(e);
    }
  }
);

// ---------- Staff: add / edit items on an existing order ----------
// PATCH /api/orders/:id/items  { cart, discount? }  (replaces items)
router.patch(
  "/:id/items",
  requireAuth,
  requireRole("WAITER", "ADMIN", "CASHIER"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const { cart, discount } = req.body || {};
      const existing = await prisma.order.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Order not found" });
      if (existing.paymentStatus === "PAID") {
        return res.status(400).json({ error: "Cannot edit a paid order" });
      }
      const resolved = await resolveCartItems(cart);
      const totals = computeTotals(
        resolved.map((r) => ({ price: Number(r.price), qty: r.qty })),
        discount ?? existing.discount
      );
      const order = await prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        return tx.order.update({
          where: { id },
          data: {
            subtotal: totals.subtotal,
            tax: totals.tax,
            discount: Number(discount ?? existing.discount),
            total: totals.total,
            items: {
              create: resolved.map((r) => ({
                menuItemId: r.menuItemId,
                name: r.name,
                price: r.price,
                qty: r.qty,
                note: r.note,
              })),
            },
          },
          include: orderInclude,
        });
      });
      emitOrderEvent("order:updated", order);
      res.json({ order });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  }
);

export default router;
