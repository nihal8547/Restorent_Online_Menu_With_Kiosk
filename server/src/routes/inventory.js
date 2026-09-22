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
    const rows = items.map((i) => {
      const isOut = !i.available || (i.trackStock && i.stockQty <= 0);
      const isLow = i.trackStock && i.stockQty > 0 && i.stockQty <= i.lowStockAt;
      return {
        id: i.id,
        name: i.name,
        price: Number(i.price),
        photoUrl: i.photoUrl,
        categoryId: i.categoryId,
        category: i.category?.name || "General",
        available: i.available,
        trackStock: i.trackStock,
        stockQty: i.stockQty,
        lowStockAt: i.lowStockAt,
        low: isLow,
        out: isOut,
        status: isOut ? "OUT_OF_STOCK" : isLow ? "LOW_STOCK" : i.trackStock ? "IN_STOCK" : "UNTRACKED",
      };
    });
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
      select: { id: true, name: true, stockQty: true, lowStockAt: true, available: true },
    });
    const low = items
      .filter((i) => i.stockQty <= i.lowStockAt)
      .sort((a, b) => a.stockQty - b.stockQty);
    res.json({ items: low, count: low.length });
  } catch (e) {
    next(e);
  }
});

// PUT /api/inventory/:id/config — toggle tracking, set threshold, update quantity.
router.put("/:id/config", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { trackStock, lowStockAt, stockQty, available } = req.body || {};

    const current = await prisma.menuItem.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "Item not found" });

    const newTrackStock = trackStock !== undefined ? !!trackStock : current.trackStock;
    const newStockQty = stockQty !== undefined ? Math.max(0, Number(stockQty) || 0) : current.stockQty;

    let newAvailable = current.available;
    if (available !== undefined) {
      newAvailable = !!available;
    } else if (newTrackStock) {
      newAvailable = newStockQty > 0;
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        trackStock: newTrackStock,
        stockQty: newStockQty,
        available: newAvailable,
        ...(lowStockAt !== undefined && { lowStockAt: Math.max(0, Number(lowStockAt) || 0) }),
      },
    });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

// PUT /api/inventory/:id/toggle-status — one-click In Stock / Out of Stock toggle.
router.put("/:id/toggle-status", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const current = await prisma.menuItem.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "Item not found" });

    const nextAvailable = !current.available || (current.trackStock && current.stockQty <= 0);
    const updateData = { available: nextAvailable };

    if (nextAvailable) {
      // Marking available
      if (current.trackStock && current.stockQty <= 0) {
        updateData.stockQty = 10; // Default restock to 10 so it stays available
      }
    } else {
      // Marking out of stock
      updateData.available = false;
      if (current.trackStock) {
        updateData.stockQty = 0;
      }
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data: updateData,
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
      const isAvailable = newQty > 0;

      const updated = await tx.menuItem.update({
        where: { id },
        data: {
          stockQty: newQty,
          trackStock: true, // adjusting stock implies tracking
          available: isAvailable, // Automatically sync menu availability!
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
