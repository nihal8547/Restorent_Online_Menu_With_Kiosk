import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// Get all banners (Admin) or active only (Customer)
router.get("/", async (req, res) => {
  const { admin } = req.query;
  try {
    const banners = await prisma.banner.findMany({
      where: admin ? undefined : { active: true },
      orderBy: { createdAt: "desc" },
      include: {
        menuItem: true, // Includes linked menu item details for customer click action
      },
    });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create banner
router.post("/", async (req, res) => {
  try {
    const { photoUrl, title, subtitle, menuItemId, active } = req.body;
    const banner = await prisma.banner.create({
      data: {
        photoUrl,
        title,
        subtitle,
        menuItemId: menuItemId ? Number(menuItemId) : null,
        active: active !== false,
      },
    });
    res.json(banner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update banner (includes hide/show toggle)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { photoUrl, title, subtitle, menuItemId, active } = req.body;
    const banner = await prisma.banner.update({
      where: { id: Number(id) },
      data: {
        photoUrl,
        title,
        subtitle,
        menuItemId: menuItemId ? Number(menuItemId) : null,
        active,
      },
    });
    res.json(banner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete banner
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.banner.delete({
      where: { id: Number(id) },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
