import { Router } from "express";
import QRCode from "qrcode";
import { randomUUID } from "crypto";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const adminOnly = [requireAuth, requireRole("ADMIN")];

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Public: resolve a QR token to a table (used by the customer app after scan)
// GET /api/tables/resolve/:qrToken and /api/tables/token/:qrToken
const resolveQrToken = async (req, res, next) => {
  try {
    const table = await prisma.restaurantTable.findUnique({
      where: { qrToken: req.params.qrToken },
      select: { id: true, tableNo: true, active: true },
    });
    if (!table || !table.active) return res.status(404).json({ error: "Table not found" });
    res.json({ table });
  } catch (e) {
    next(e);
  }
};
router.get("/resolve/:qrToken", resolveQrToken);
router.get("/token/:qrToken", resolveQrToken);


// Staff (any role): active tables for placing an order — minimal fields.
router.get("/for-order", requireAuth, async (req, res, next) => {
  try {
    const tables = await prisma.restaurantTable.findMany({
      where: { active: true },
      select: { id: true, tableNo: true },
      orderBy: { id: "asc" },
    });
    res.json({ tables });
  } catch (e) {
    next(e);
  }
});

// Admin: list tables
router.get("/", ...adminOnly, async (req, res, next) => {
  try {
    const tables = await prisma.restaurantTable.findMany({ orderBy: { id: "asc" } });
    const withUrls = tables.map((t) => ({ ...t, menuUrl: `${CLIENT_URL}/t/${t.qrToken}` }));
    res.json({ tables: withUrls });
  } catch (e) {
    next(e);
  }
});

// Admin: create a table
router.post("/", ...adminOnly, async (req, res, next) => {
  try {
    const { tableNo } = req.body || {};
    if (!tableNo) return res.status(400).json({ error: "tableNo is required" });
    const table = await prisma.restaurantTable.create({
      data: { tableNo: String(tableNo).trim() },
    });
    res.status(201).json({ table: { ...table, menuUrl: `${CLIENT_URL}/t/${table.qrToken}` } });
  } catch (e) {
    if (e.code === "P2002") return res.status(409).json({ error: "Table number already exists" });
    next(e);
  }
});

// Admin: update a table (rename / activate)
router.put("/:id", ...adminOnly, async (req, res, next) => {
  try {
    const { tableNo, active } = req.body || {};
    const table = await prisma.restaurantTable.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(tableNo !== undefined && { tableNo: String(tableNo).trim() }),
        ...(active !== undefined && { active: !!active }),
      },
    });
    res.json({ table: { ...table, menuUrl: `${CLIENT_URL}/t/${table.qrToken}` } });
  } catch (e) {
    next(e);
  }
});

// Admin: regenerate the QR token (so the printed QR can be "changed")
router.post("/:id/regenerate", ...adminOnly, async (req, res, next) => {
  try {
    const table = await prisma.restaurantTable.update({
      where: { id: Number(req.params.id) },
      data: { qrToken: randomUUID() },
    });
    res.json({ table: { ...table, menuUrl: `${CLIENT_URL}/t/${table.qrToken}` } });
  } catch (e) {
    next(e);
  }
});

// Admin: get QR code image (PNG data URL) for a table
router.get("/:id/qr", ...adminOnly, async (req, res, next) => {
  try {
    const table = await prisma.restaurantTable.findUnique({ where: { id: Number(req.params.id) } });
    if (!table) return res.status(404).json({ error: "Table not found" });
    const url = `${CLIENT_URL}/t/${table.qrToken}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 1 });
    res.json({ tableNo: table.tableNo, url, dataUrl });
  } catch (e) {
    next(e);
  }
});

// Admin: delete a table
router.delete("/:id", ...adminOnly, async (req, res, next) => {
  try {
    await prisma.restaurantTable.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
