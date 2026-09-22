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
          where: { available: true },
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
    const { categoryId, name, description, price, photoUrl, available, sortOrder } = req.body || {};
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
    const { categoryId, name, description, price, photoUrl, available, sortOrder } = req.body || {};
    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(categoryId !== undefined && { categoryId: Number(categoryId) }),
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description ? String(description) : null }),
        ...(price !== undefined && { price: Number(price) }),
        ...(photoUrl !== undefined && { photoUrl: photoUrl || null }),
        ...(available !== undefined && { available: !!available }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) || 0 }),
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
