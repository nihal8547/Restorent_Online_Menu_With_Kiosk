import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const adminOnly = [requireAuth, requireRole("ADMIN", "CASHIER")];

function dayRange(dateStr) {
  const day = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// GET /api/reports/daily?date=YYYY-MM-DD
// Sales, payments by mode, order counts, expenses and profit for a day.
router.get("/daily", ...adminOnly, async (req, res, next) => {
  try {
    const { start, end } = dayRange(req.query.date);

    const paidOrders = await prisma.order.findMany({
      where: { paymentStatus: "PAID", createdAt: { gte: start, lt: end } },
      select: { total: true, type: true },
    });
    const sales = paidOrders.reduce((s, o) => s + Number(o.total), 0);

    const orderCount = await prisma.order.count({ where: { createdAt: { gte: start, lt: end } } });
    const paidCount = paidOrders.length;

    const payments = await prisma.payment.groupBy({
      by: ["mode"],
      where: { paidAt: { gte: start, lt: end } },
      _sum: { amount: true },
    });
    const byMode = payments.reduce((acc, p) => {
      acc[p.mode] = Number(p._sum.amount || 0);
      return acc;
    }, {});

    const byType = paidOrders.reduce((acc, o) => {
      acc[o.type] = (acc[o.type] || 0) + Number(o.total);
      return acc;
    }, {});

    const expenseAgg = await prisma.expense.aggregate({
      where: { date: { gte: start, lt: end } },
      _sum: { amount: true },
    });
    const expenses = Number(expenseAgg._sum.amount || 0);

    res.json({
      date: start.toISOString().slice(0, 10),
      sales: +sales.toFixed(2),
      expenses: +expenses.toFixed(2),
      profit: +(sales - expenses).toFixed(2),
      orderCount,
      paidCount,
      pendingCount: orderCount - paidCount,
      paymentsByMode: byMode,
      salesByType: byType,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/reports/items?date=YYYY-MM-DD  — item-wise sales for a day
router.get("/items", ...adminOnly, async (req, res, next) => {
  try {
    const { start, end } = dayRange(req.query.date);
    const items = await prisma.orderItem.findMany({
      where: { order: { paymentStatus: "PAID", createdAt: { gte: start, lt: end } } },
      select: { name: true, qty: true, price: true },
    });
    const map = new Map();
    for (const it of items) {
      const cur = map.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += Number(it.price) * it.qty;
      map.set(it.name, cur);
    }
    const rows = [...map.values()]
      .map((r) => ({ ...r, revenue: +r.revenue.toFixed(2) }))
      .sort((a, b) => b.qty - a.qty);
    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

// GET /api/reports/range?from=YYYY-MM-DD&to=YYYY-MM-DD — daily totals across a range
router.get("/range", ...adminOnly, async (req, res, next) => {
  try {
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 6 * 864e5);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const orders = await prisma.order.findMany({
      where: { paymentStatus: "PAID", createdAt: { gte: from, lte: to } },
      select: { total: true, createdAt: true },
    });
    const map = {};
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      map[key] = (map[key] || 0) + Number(o.total);
    }
    const rows = Object.entries(map)
      .map(([date, sales]) => ({ date, sales: +sales.toFixed(2) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    res.json({ rows });
  } catch (e) {
    next(e);
  }
});

export default router;
