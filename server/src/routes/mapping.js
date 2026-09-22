import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

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
    ]);
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
