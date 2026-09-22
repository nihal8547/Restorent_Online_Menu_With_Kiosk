import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { encrypt, decrypt, mask } from "../utils/crypto.js";
import { ingestPlatformOrder } from "../services/deliveryIngest.js";
import { generateSamplePayload } from "../utils/samplePlatformOrders.js";

const router = Router();
const adminOnly = [requireAuth, requireRole("ADMIN")];

// Supported delivery partners.
export const PLATFORMS = [
  { key: "SNOONU", label: "Snoonu" },
  { key: "TALABAT", label: "Talabat" },
  { key: "KEETA", label: "Keeta" },
  { key: "RAFEEQ", label: "Rafeeq" },
  { key: "DELIVEROO", label: "Deliveroo" },
];
const KEYS = new Set(PLATFORMS.map((p) => p.key));

// Helper used by the webhook layer: returns the integration with decrypted
// secrets, or null if not configured.
export async function getIntegration(platformKey) {
  const row = await prisma.platformIntegration.findUnique({ where: { platform: platformKey } });
  if (!row) return null;
  return {
    ...row,
    apiKey: decrypt(row.apiKeyEnc),
    apiSecret: decrypt(row.apiSecretEnc),
    webhookSecret: decrypt(row.webhookSecretEnc),
  };
}

// Build the public webhook URL for a platform.
function webhookUrl(req, platformKey) {
  const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  return `${base}/api/webhooks/${platformKey.toLowerCase()}`;
}

// Shape a row for the client — never returns raw secrets, only masks/flags.
function publicShape(req, key, label, row) {
  return {
    platform: key,
    label,
    enabled: row?.enabled || false,
    storeId: row?.storeId || "",
    brandId: row?.brandId || "",
    baseUrl: row?.baseUrl || "",
    hasApiKey: !!row?.apiKeyEnc,
    hasApiSecret: !!row?.apiSecretEnc,
    hasWebhookSecret: !!row?.webhookSecretEnc,
    apiKeyMask: mask(decrypt(row?.apiKeyEnc)),
    webhookUrl: webhookUrl(req, key),
    lastSyncAt: row?.lastSyncAt || null,
    configured: !!(row?.apiKeyEnc || row?.webhookSecretEnc),
  };
}

// GET /api/integrations — all platforms with masked config.
router.get("/", ...adminOnly, async (req, res, next) => {
  try {
    const rows = await prisma.platformIntegration.findMany();
    const byKey = new Map(rows.map((r) => [r.platform, r]));
    const list = PLATFORMS.map((p) => publicShape(req, p.key, p.label, byKey.get(p.key)));
    res.json({ integrations: list });
  } catch (e) {
    next(e);
  }
});

// PUT /api/integrations/:platform — create/update config.
// Secret fields (apiKey, apiSecret, webhookSecret) are only changed when a
// non-empty value is sent; leave blank to keep the stored secret.
router.put("/:platform", ...adminOnly, async (req, res, next) => {
  try {
    const key = String(req.params.platform || "").toUpperCase();
    if (!KEYS.has(key)) return res.status(404).json({ error: "Unknown platform" });

    const { enabled, storeId, brandId, baseUrl, apiKey, apiSecret, webhookSecret, config } = req.body || {};

    const data = {
      ...(enabled !== undefined && { enabled: !!enabled }),
      ...(storeId !== undefined && { storeId: storeId ? String(storeId).trim() : null }),
      ...(brandId !== undefined && { brandId: brandId ? String(brandId).trim() : null }),
      ...(baseUrl !== undefined && { baseUrl: baseUrl ? String(baseUrl).trim() : null }),
      ...(config !== undefined && { config }),
    };
    // Only overwrite secrets when a fresh value is provided.
    if (apiKey) data.apiKeyEnc = encrypt(apiKey);
    if (apiSecret) data.apiSecretEnc = encrypt(apiSecret);
    if (webhookSecret) data.webhookSecretEnc = encrypt(webhookSecret);

    const row = await prisma.platformIntegration.upsert({
      where: { platform: key },
      update: data,
      create: { platform: key, ...data },
    });

    const label = PLATFORMS.find((p) => p.key === key)?.label || key;
    res.json({ integration: publicShape(req, key, label, row) });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/integrations/:platform/secret?field=apiKey|apiSecret|webhookSecret
// Clears a single stored secret.
router.delete("/:platform/secret", ...adminOnly, async (req, res, next) => {
  try {
    const key = String(req.params.platform || "").toUpperCase();
    if (!KEYS.has(key)) return res.status(404).json({ error: "Unknown platform" });
    const field = String(req.query.field || "");
    const map = { apiKey: "apiKeyEnc", apiSecret: "apiSecretEnc", webhookSecret: "webhookSecretEnc" };
    if (!map[field]) return res.status(400).json({ error: "Invalid field" });
    await prisma.platformIntegration.update({ where: { platform: key }, data: { [map[field]]: null } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /api/integrations/:platform/test — validate configuration.
// Checks that the integration is enabled and has credentials, and (if a
// baseUrl is set) does a best-effort reachability probe.
router.post("/:platform/test", ...adminOnly, async (req, res, next) => {
  try {
    const key = String(req.params.platform || "").toUpperCase();
    if (!KEYS.has(key)) return res.status(404).json({ error: "Unknown platform" });

    const it = await getIntegration(key);
    if (!it) return res.json({ ok: false, message: "Not configured yet." });

    const issues = [];
    if (!it.enabled) issues.push("integration is disabled");
    if (!it.apiKey) issues.push("API key missing");
    if (!it.webhookSecret) issues.push("webhook secret missing (needed to receive orders)");

    let reachable = null;
    if (it.baseUrl) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(it.baseUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${it.apiKey || ""}` },
          signal: controller.signal,
        });
        clearTimeout(t);
        reachable = resp.status;
      } catch (err) {
        reachable = `unreachable (${err.name})`;
      }
    }

    res.json({
      ok: issues.length === 0,
      message: issues.length ? `Check: ${issues.join(", ")}` : "Configuration looks complete.",
      baseUrlProbe: reachable,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/integrations/simulate — generate sample API webhook orders for demonstration.
// Disabled in production (unless ALLOW_SIMULATE=1) so demo data never pollutes live books.
router.post("/simulate", ...adminOnly, async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_SIMULATE !== "1") {
      return res.status(403).json({ error: "Order simulation is disabled in production" });
    }
    const { platform = "ALL" } = req.body || {};
    const targets = platform === "ALL" 
      ? ["TALABAT", "SNOONU", "KEETA", "RAFEEQ", "DELIVEROO"]
      : [String(platform).toUpperCase()];

    const created = [];
    for (const p of targets) {
      if (!KEYS.has(p)) continue;
      const payload = generateSamplePayload(p);
      const result = await ingestPlatformOrder(p, payload);
      if (result && result.ok) {
        created.push({ platform: p, orderNo: result.orderNo, orderId: result.orderId });
      }
    }

    res.json({
      success: true,
      count: created.length,
      orders: created,
      message: `Simulated ${created.length} delivery partner orders. They are now live in Kitchen & Billing.`
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/integrations/payloads?platform=&limit=  — recent raw webhook payloads.
// Lets you inspect exactly what a platform sent, to fine-tune the adapter field
// mapping against real orders once you go live.
router.get("/payloads", ...adminOnly, async (req, res, next) => {
  try {
    const where = {};
    if (req.query.platform) where.platform = String(req.query.platform).toUpperCase();
    const rows = await prisma.platformOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(req.query.limit) || 20, 100),
    });
    res.json({
      payloads: rows.map((r) => ({
        id: r.id,
        platform: r.platform,
        externalId: r.externalId,
        mappedOrderId: r.mappedOrderId,
        createdAt: r.createdAt,
        payload: r.payload, // raw JSON as received
      })),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
