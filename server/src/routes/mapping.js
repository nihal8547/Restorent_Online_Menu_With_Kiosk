import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { reprocessFailed } from "../services/deliveryIngest.js";

const router = Router();
const adminOnly = [requireAuth, requireRole("ADMIN")];

export const MAP_PLATFORMS = ["TALABAT", "SNOONU", "KEETA", "RAFEEQ", "DELIVEROO"];

// GET /api/mapping — every menu item with its per-platform SKUs.
// Response: { platforms, items: [{ id, name, category, skus: { TALABAT: "..", ... } }] }
router.get("/", ...adminOnly, async (req, res, next) => {
  try {
    const [items, maps] = await Promise.all([
      prisma.menuItem.findMany({
        orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
        include: { category: { select: { name: true } } },
      }),
      prisma.platformItemMap.findMany(),
    ]);
    const byItem = {};
    for (const m of maps) {
      byItem[m.menuItemId] = byItem[m.menuItemId] || {};
      byItem[m.menuItemId][m.platform] = m.sku;
    }
    res.json({
      platforms: MAP_PLATFORMS,
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category?.name,
        skus: byItem[i.id] || {},
      })),
    });
  } catch (e) {
    next(e);
  }
});

// PUT /api/mapping — set (or clear) one SKU.
// body: { platform, menuItemId, sku }  (empty sku clears the mapping)
router.put("/", ...adminOnly, async (req, res, next) => {
  try {
    const platform = String(req.body?.platform || "").toUpperCase();
    const menuItemId = Number(req.body?.menuItemId);
    const sku = (req.body?.sku ?? "").toString().trim();
    if (!MAP_PLATFORMS.includes(platform)) return res.status(400).json({ error: "Unknown platform" });
    if (!menuItemId) return res.status(400).json({ error: "menuItemId required" });

    // Clearing: remove this item's mapping for the platform.
    if (!sku) {
      await prisma.platformItemMap.deleteMany({ where: { platform, menuItemId } });
      return res.json({ ok: true, cleared: true });
    }

    // A SKU is unique per platform — make sure it isn't already used by another item.
    const clash = await prisma.platformItemMap.findUnique({
      where: { platform_sku: { platform, sku } },
    });
    if (clash && clash.menuItemId !== menuItemId) {
      return res.status(409).json({ error: `SKU "${sku}" is already mapped to another item for ${platform}` });
    }

    // One SKU per item per platform: remove any previous SKU for this item+platform, then set.
    await prisma.$transaction([
      prisma.platformItemMap.deleteMany({ where: { platform, menuItemId } }),
      prisma.platformItemMap.upsert({
        where: { platform_sku: { platform, sku } },
        update: { menuItemId },
        create: { platform, sku, menuItemId },
      }),
      // this SKU is now mapped — drop any pending suggestion for it
      prisma.platformSkuSuggestion.deleteMany({ where: { platform, sku } }),
    ]);
    // Any previously failed orders that are now mappable become real orders.
    const reprocessed = await reprocessFailed(platform);
    res.json({ ok: true, reprocessed });
  } catch (e) {
    next(e);
  }
});

// ---------- Auto-learned SKU suggestions ----------

// GET /api/mapping/suggestions — pending SKUs seen from delivery orders, each
// with the platform's product name and a best-guess menu item, plus the full
// item list for the dropdown.
router.get("/suggestions", ...adminOnly, async (req, res, next) => {
  try {
    const [suggestions, items] = await Promise.all([
      prisma.platformSkuSuggestion.findMany({ orderBy: [{ seenCount: "desc" }, { updatedAt: "desc" }] }),
      prisma.menuItem.findMany({
        orderBy: [{ categoryId: "asc" }, { id: "asc" }],
        select: { id: true, name: true, category: { select: { name: true } } },
      }),
    ]);
    res.json({
      suggestions: suggestions.map((s) => ({
        id: s.id,
        platform: s.platform,
        sku: s.sku,
        name: s.name,
        suggestedMenuItemId: s.suggestedMenuItemId,
        seenCount: s.seenCount,
      })),
      items: items.map((i) => ({ id: i.id, name: i.name, category: i.category?.name })),
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/mapping/suggestions/:id/approve  { menuItemId }
// Creates the mapping, removes the suggestion, and re-processes pending orders.
router.post("/suggestions/:id/approve", ...adminOnly, async (req, res, next) => {
  try {
    const suggestion = await prisma.platformSkuSuggestion.findUnique({ where: { id: Number(req.params.id) } });
    if (!suggestion) return res.status(404).json({ error: "Suggestion not found" });
    const menuItemId = Number(req.body?.menuItemId || suggestion.suggestedMenuItemId);
    if (!menuItemId) return res.status(400).json({ error: "Pick a menu item to map to" });

    const clash = await prisma.platformItemMap.findUnique({
      where: { platform_sku: { platform: suggestion.platform, sku: suggestion.sku } },
    });
    if (clash && clash.menuItemId !== menuItemId) {
      return res.status(409).json({ error: "This SKU is already mapped to another item" });
    }

    await prisma.$transaction([
      prisma.platformItemMap.upsert({
        where: { platform_sku: { platform: suggestion.platform, sku: suggestion.sku } },
        update: { menuItemId },
        create: { platform: suggestion.platform, sku: suggestion.sku, menuItemId },
      }),
      prisma.platformSkuSuggestion.delete({ where: { id: suggestion.id } }),
    ]);
    const reprocessed = await reprocessFailed(suggestion.platform);
    res.json({ ok: true, reprocessed });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/mapping/suggestions/:id — dismiss a suggestion.
router.delete("/suggestions/:id", ...adminOnly, async (req, res, next) => {
  try {
    await prisma.platformSkuSuggestion.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// GET /api/mapping/failed — platform orders that were logged but never mapped
// to an internal order (e.g. unmapped SKUs), so the admin can fix & investigate.
router.get("/failed", ...adminOnly, async (req, res, next) => {
  try {
    const rows = await prisma.platformOrder.findMany({
      where: { mappedOrderId: null },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ rows });
  } catch (e) {
    next(e);
  }
});

export default router;
