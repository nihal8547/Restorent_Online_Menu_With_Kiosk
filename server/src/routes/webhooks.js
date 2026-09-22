import { Router } from "express";
import { prisma } from "../prisma.js";
import { createOrder } from "./orders.js";
import { getIntegration } from "./integrations.js";
import { safeEqual } from "../utils/crypto.js";
import { normalizePayload } from "../utils/platformAdapters.js";

const router = Router();

const ENV_FALLBACK_SECRET = process.env.PLATFORM_WEBHOOK_SECRET || "";
const SUPPORTED = {
  keeta: "KEETA",
  snoonu: "SNOONU",
  talabat: "TALABAT",
  rafeeq: "RAFEEQ",
  deliveroo: "DELIVEROO",
};

/**
 * Delivery platform webhook receiver (Snoonu / Talabat / Keeta / Rafeeq / Deliveroo).
 *
 * Each platform is configured in Admin → Settings → Delivery Partners with its own
 * API key and webhook secret (stored encrypted). Incoming requests must carry the
 * matching secret in `x-webhook-secret`, and the integration must be enabled.
 *
 * Body is a normalised shape (map each platform's real payload to this in their
 * adapter):
 *   {
 *     externalId, customer:{name,phone},
 *     delivery:{name,phone,street,buildingNo,room?,zone},
 *     items:[{menuItemId,qty,note?}], note?
 *   }
 */
router.post("/:platform", async (req, res, next) => {
  try {
    const key = String(req.params.platform || "").toLowerCase();
    const source = SUPPORTED[key];
    if (!source) return res.status(404).json({ error: "Unknown platform" });

    // Look up the configured integration for this platform.
    const integration = await getIntegration(source);
    if (!integration || !integration.enabled) {
      return res.status(403).json({ error: `${source} integration is not enabled` });
    }

    // Validate the webhook secret (per-platform stored secret; env as fallback).
    const provided = req.headers["x-webhook-secret"];
    const expected = integration.webhookSecret || ENV_FALLBACK_SECRET;
    if (!expected || !safeEqual(provided, expected)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const body = req.body || {};

    // Translate the platform's payload into our normalised order shape.
    const norm = normalizePayload(source, body);
    const externalId = norm.externalId;
    if (!externalId) return res.status(400).json({ error: "externalId is required" });

    // Idempotency: ignore duplicates from the same platform.
    const existing = await prisma.platformOrder.findUnique({
      where: { platform_externalId: { platform: source, externalId } },
    });
    if (existing) {
      return res.json({ ok: true, duplicate: true, mappedOrderId: existing.mappedOrderId });
    }

    // Log the raw payload first (so unmapped orders can be recovered by admin).
    const log = await prisma.platformOrder.create({
      data: { platform: source, externalId, payload: body },
    });

    // Resolve each line to a menu item: use menuItemId if provided, else map the
    // platform SKU via PlatformItemMap.
    const skus = norm.items.filter((i) => !i.menuItemId && i.sku).map((i) => String(i.sku));
    const maps = skus.length
      ? await prisma.platformItemMap.findMany({ where: { platform: source, sku: { in: skus } } })
      : [];
    const skuToId = new Map(maps.map((m) => [m.sku, m.menuItemId]));

    const cart = [];
    const unmapped = [];
    for (const it of norm.items) {
      const menuItemId = it.menuItemId || skuToId.get(String(it.sku));
      if (!menuItemId) {
        unmapped.push(it.sku || "(no sku)");
        continue;
      }
      cart.push({ menuItemId: Number(menuItemId), qty: it.qty, note: it.note });
    }

    // Don't create a half order — if any item is unmapped, reject so the platform
    // retries after the admin adds the missing SKU mapping.
    if (unmapped.length || cart.length === 0) {
      return res.status(422).json({
        error: cart.length === 0 ? "No mappable items in order" : "Some items are not mapped",
        unmappedSkus: unmapped,
        hint: `Add these SKUs for ${source} in Admin → Menu Mapping, then the order can be retried.`,
      });
    }

    const order = await createOrder(cart, {
      type: "DELIVERY",
      source,
      externalId,
      customerPhone: norm.customer?.phone || norm.delivery?.phone,
      note: norm.note,
      delivery: norm.delivery,
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
