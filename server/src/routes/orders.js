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

// ---------- Public: place an order (customer self-order) ----------
// POST /api/orders  { type, tableToken?, cart, note?, delivery? }
router.post("/", async (req, res, next) => {
  try {
    const { type, tableToken, cart, note, delivery, customerPhone } = req.body || {};
    const orderType = type || (tableToken ? "DINE_IN" : "TAKEAWAY");

    let tableId = null;
    if (orderType === "DINE_IN") {
      if (!tableToken) return res.status(400).json({ error: "Table QR is required for dine-in" });
      const table = await prisma.restaurantTable.findUnique({ where: { qrToken: tableToken } });
      if (!table || !table.active) return res.status(400).json({ error: "Invalid table" });
      tableId = table.id;
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
    const order = await createOrder(cart, {
      type: orderType,
      tableId: tableId ? Number(tableId) : null,
      placedById: req.user.id,
      customerPhone,
      note,
      delivery: orderType === "DELIVERY" ? delivery : null,
    });
    res.status(201).json({ order });
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
