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

// POST /api/expenses  { title, amount, note?, date? } OR { items: [...], date? }
router.post("/", ...adminOnly, async (req, res, next) => {
  try {
    const { items, title, amount, note, date } = req.body || {};

    // Support batch creation
    if (Array.isArray(items) && items.length > 0) {
      const entryDate = date ? new Date(date) : new Date();
      const validItems = items
        .filter((it) => it && it.title && it.amount !== undefined && !isNaN(Number(it.amount)))
        .map((it) => ({
          title: String(it.title).trim(),
          amount: Number(it.amount),
          note: it.note ? String(it.note).trim() : null,
          date: it.date ? new Date(it.date) : entryDate,
        }));

      if (validItems.length === 0) {
        return res.status(400).json({ error: "No valid expense items provided" });
      }

      const created = await prisma.$transaction(
        validItems.map((data) => prisma.expense.create({ data }))
      );
      return res.status(201).json({ expenses: created, count: created.length });
    }

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

// GET /api/expenses/range?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/range", ...adminOnly, async (req, res, next) => {
  try {
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 6 * 864e5);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const expenses = await prisma.expense.findMany({
      where: { date: { gte: from, lte: to } },
      select: { amount: true, date: true },
    });
    const map = {};
    for (const e of expenses) {
      const key = e.date.toISOString().slice(0, 10);
      map[key] = (map[key] || 0) + Number(e.amount);
    }
    const rows = Object.entries(map)
      .map(([date, total]) => ({ date, total: +total.toFixed(2) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    res.json({ rows });
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
