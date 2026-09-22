import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// Get all settings (returns an object { key: value })
router.get("/", async (req, res) => {
  try {
    const settingsList = await prisma.setting.findMany();
    const settings = settingsList.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update settings (accepts an object of { key: value } pairs)
router.put("/", async (req, res) => {
  try {
    const updates = Object.entries(req.body).map(([key, value]) => {
      return prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    });
    await prisma.$transaction(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
