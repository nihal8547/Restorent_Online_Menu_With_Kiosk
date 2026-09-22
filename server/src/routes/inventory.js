import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const adminOnly = [requireAuth, requireRole("ADMIN")];

// GET /api/inventory — all menu items with stock info, grouped by category.
router.get("/", ...adminOnly, async (req, res, next) => {
  try {
    const items = await prisma.menuItem.findMany({
      orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      include: { category: { select: { name: true } } },
    });
    const rows = items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category?.name,
      available: i.available,
      trackStock: i.trackStock,
      stockQty: i.stockQty,
      lowStockAt: i.lowStockAt,
      low: i.trackStock && i.stockQty <= i.lowStockAt,
      out: i.trackStock && i.stockQty <= 0,
    }));
    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

// GET /api/inventory/low — items at or below their low-stock threshold.
router.get("/low", ...adminOnly, async (req, res, next) => {
  try {
    const items = await prisma.menuItem.findMany({
      where: { trackStock: true },
      select: { id: true, name: true, stockQty: true, lowStockAt: true },
    });
    const low = items
      .filter((i) => i.stockQty <= i.lowStockAt)
      .sort((a, b) => a.stockQty - b.stockQty);
    res.json({ items: low, count: low.length });
  } catch (e) {
    next(e);
  }
});

// PUT /api/inventory/:id/config — toggle tracking, set threshold.
// body: { trackStock, lowStockAt }
router.put("/:id/config", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { trackStock, lowStockAt } = req.body || {};
    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(trackStock !== undefined && { trackStock: !!trackStock }),
        ...(lowStockAt !== undefined && { lowStockAt: Math.max(0, Number(lowStockAt) || 0) }),
      },
    });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

// POST /api/inventory/:id/adjust — restock / adjust / waste.
// body: { change (int, +/-), reason: RESTOCK|ADJUST|WASTE, note? }
router.post("/:id/adjust", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const change = parseInt(req.body?.change, 10);
    const reason = String(req.body?.reason || "ADJUST").toUpperCase();
    const note = req.body?.note ? String(req.body.note).slice(0, 200) : null;
    if (!Number.isFinite(change) || change === 0) {
      return res.status(400).json({ error: "A non-zero change is required" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.findUnique({ where: { id } });
      if (!item) throw Object.assign(new Error("Item not found"), { status: 404 });
      const newQty = Math.max(0, item.stockQty + change);
      const updated = await tx.menuItem.update({
        where: { id },
        data: {
          stockQty: newQty,
          trackStock: true, // adjusting stock implies tracking
          // Restocking a zero item makes it available again.
          ...(newQty > 0 && !item.available && change > 0 ? { available: true } : {}),
        },
      });
      await tx.stockMovement.create({
        data: { menuItemId: id, change, balance: newQty, reason, note },
      });
      return updated;
    });

    res.json({ item: result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// GET /api/inventory/:id/movements — stock history for one item.
router.get("/:id/movements", ...adminOnly, async (req, res, next) => {
  try {
    const movements = await prisma.stockMovement.findMany({
      where: { menuItemId: Number(req.params.id) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ movements });
  } catch (e) {
    next(e);
  }
});

export default router;
