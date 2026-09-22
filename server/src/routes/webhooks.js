import { Router } from "express";
import { prisma } from "../prisma.js";
import { createOrder } from "./orders.js";

const router = Router();

const WEBHOOK_SECRET = process.env.PLATFORM_WEBHOOK_SECRET || "";
const SUPPORTED = { keeta: "KEETA", snoonu: "SNOONU", talabat: "TALABAT" };

/**
 * Generic adapter layer for delivery platforms (Keeta / Snoonu / Talabat).
 *
 * Each platform posts its own JSON shape; a real integration would map their
 * fields precisely. Here we accept a normalised body so the pipeline is ready:
 *   {
 *     externalId: "PLATFORM-123",
 *     customer: { name, phone },
 *     delivery: { name, phone, street, buildingNo, room?, zone },
 *     items: [{ menuItemId, qty, note? }],
 *     note?: "..."
 *   }
 *
 * Security: requires header  x-webhook-secret: <PLATFORM_WEBHOOK_SECRET>
 */
router.post("/:platform", async (req, res, next) => {
  try {
    const key = String(req.params.platform || "").toLowerCase();
    const source = SUPPORTED[key];
    if (!source) return res.status(404).json({ error: "Unknown platform" });

    if (!WEBHOOK_SECRET || req.headers["x-webhook-secret"] !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const body = req.body || {};
    const externalId = String(body.externalId || body.orderId || "").trim();
    if (!externalId) return res.status(400).json({ error: "externalId is required" });

    // Idempotency: ignore duplicates from the same platform.
    const existing = await prisma.platformOrder.findUnique({
      where: { platform_externalId: { platform: source, externalId } },
    });
    if (existing) {
      return res.json({ ok: true, duplicate: true, mappedOrderId: existing.mappedOrderId });
    }

    // Log the raw payload first.
    const log = await prisma.platformOrder.create({
      data: { platform: source, externalId, payload: body },
    });

    const order = await createOrder(body.items, {
      type: "DELIVERY",
      source,
      externalId,
      customerPhone: body.customer?.phone || body.delivery?.phone,
      note: body.note,
      delivery: body.delivery,
    });

    await prisma.platformOrder.update({
      where: { id: log.id },
      data: { mappedOrderId: order.id },
    });

    res.status(201).json({ ok: true, orderNo: order.orderNo, orderId: order.id });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

export default router;
