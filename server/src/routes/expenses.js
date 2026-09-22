import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const adminOnly = [requireAuth, requireRole("ADMIN")];

// GET /api/expenses?date=YYYY-MM-DD  (defaults to today)
router.get("/", ...adminOnly, async (req, res, next) => {
  try {
    const day = req.query.date ? new Date(req.query.date) : new Date();
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const expenses = await prisma.expense.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
    });
    const totalAgg = await prisma.expense.aggregate({
      where: { date: { gte: start, lt: end } },
      _sum: { amount: true },
    });
    res.json({ expenses, total: Number(totalAgg._sum.amount || 0) });
  } catch (e) {
    next(e);
  }
});

// POST /api/expenses  { title, amount, note?, date? }
router.post("/", ...adminOnly, async (req, res, next) => {
  try {
    const { title, amount, note, date } = req.body || {};
    if (!title || amount === undefined) {
      return res.status(400).json({ error: "title and amount are required" });
    }
    const expense = await prisma.expense.create({
      data: {
        title: String(title).trim(),
        amount: Number(amount),
        note: note ? String(note) : null,
        ...(date && { date: new Date(date) }),
      },
    });
    res.status(201).json({ expense });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/expenses/:id
router.delete("/:id", ...adminOnly, async (req, res, next) => {
  try {
    await prisma.expense.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
