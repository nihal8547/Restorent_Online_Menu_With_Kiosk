import { Router } from "express";
import { getIntegration } from "./integrations.js";
import { safeEqual } from "../utils/crypto.js";
import { ingestPlatformOrder } from "../services/deliveryIngest.js";

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

    // Create the order directly from the platform's line items (external model —
    // no internal menu link). It appears in Kitchen & Billing immediately.
    const result = await ingestPlatformOrder(source, req.body || {});
    if (result.status >= 400) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(result.status).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

export default router;
