import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// ---------- Public: full menu (categories with available items) ----------
// GET /api/menu           -> customer-facing menu (only active categories & available items)
// GET /api/menu?all=1     -> admin view (everything), requires auth (handled below)
router.get("/", async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        items: {
          where: {
            available: true,
            OR: [
              { trackStock: false },
              { stockQty: { gt: 0 } },
            ],
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
      },
    });
    res.json({ categories });
  } catch (e) {
    next(e);
  }
});

// ---------- Admin: manage categories ----------
const adminOnly = [requireAuth, requireRole("ADMIN")];

router.get("/admin/categories", ...adminOnly, async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
    });
    res.json({ categories });
  } catch (e) {
    next(e);
  }
});

router.post("/admin/categories", ...adminOnly, async (req, res, next) => {
  try {
    const { name, sortOrder, active } = req.body || {};
    if (!name) return res.status(400).json({ error: "Category name is required" });
    const category = await prisma.category.create({
      data: { name: String(name).trim(), sortOrder: Number(sortOrder) || 0, active: active !== false },
    });
    res.status(201).json({ category });
  } catch (e) {
    next(e);
  }
});

router.put("/admin/categories/:id", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, sortOrder, active } = req.body || {};
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) || 0 }),
        ...(active !== undefined && { active: !!active }),
      },
    });
    res.json({ category });
  } catch (e) {
    next(e);
  }
});

router.delete("/admin/categories/:id", ...adminOnly, async (req, res, next) => {
  try {
    await prisma.category.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- Admin: manage menu items ----------

router.post("/admin/items", ...adminOnly, async (req, res, next) => {
  try {
    const { categoryId, name, description, price, photoUrl, available, sortOrder, trackStock, stockQty, lowStockAt } =
      req.body || {};
    if (!categoryId || !name || price === undefined) {
      return res.status(400).json({ error: "categoryId, name and price are required" });
    }
    const item = await prisma.menuItem.create({
      data: {
        categoryId: Number(categoryId),
        name: String(name).trim(),
        description: description ? String(description) : null,
        price: Number(price),
        photoUrl: photoUrl || null,
        available: available !== false,
        sortOrder: Number(sortOrder) || 0,
        trackStock: !!trackStock,
        stockQty: Math.max(0, Number(stockQty) || 0),
        ...(lowStockAt !== undefined && { lowStockAt: Math.max(0, Number(lowStockAt) || 0) }),
      },
    });
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
});

router.put("/admin/items/:id", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { categoryId, name, description, price, photoUrl, available, sortOrder, trackStock, stockQty, lowStockAt } =
      req.body || {};

    const current = await prisma.menuItem.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "Item not found" });

    const newTrackStock = trackStock !== undefined ? !!trackStock : current.trackStock;
    let newStockQty = stockQty !== undefined ? Math.max(0, Number(stockQty) || 0) : current.stockQty;
    let newAvailable = available !== undefined ? !!available : current.available;

    // If tracking is enabled and user turns available: true but stock is 0, auto-assign stock
    if (newTrackStock && newAvailable && newStockQty <= 0 && available === true) {
      newStockQty = 10;
    } else if (newTrackStock && newStockQty <= 0 && stockQty !== undefined) {
      newAvailable = false;
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(categoryId !== undefined && { categoryId: Number(categoryId) }),
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description ? String(description) : null }),
        ...(price !== undefined && { price: Number(price) }),
        ...(photoUrl !== undefined && { photoUrl: photoUrl || null }),
        available: newAvailable,
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) || 0 }),
        trackStock: newTrackStock,
        stockQty: newStockQty,
        ...(lowStockAt !== undefined && { lowStockAt: Math.max(0, Number(lowStockAt) || 0) }),
      },
    });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

router.delete("/admin/items/:id", ...adminOnly, async (req, res, next) => {
  try {
    await prisma.menuItem.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
