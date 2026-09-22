import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const adminOnly = [requireAuth, requireRole("ADMIN")];

function dayRange(dateStr) {
  const day = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// GET /api/waiters?date=YYYY-MM-DD
// Returns all waiters with their daily collection total and orders placed count
router.get("/", ...adminOnly, async (req, res, next) => {
  try {
    const { start, end } = dayRange(req.query.date);

    // Fetch all staff with role WAITER
    const waiters = await prisma.user.findMany({
      where: { role: "WAITER" },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    // Fetch daily payments collected by these waiters
    const payments = await prisma.payment.groupBy({
      by: ["collectedById"],
      where: {
        paidAt: { gte: start, lt: end },
        collectedById: { in: waiters.map((w) => w.id) },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const paymentMap = new Map();
    payments.forEach((p) => {
      paymentMap.set(p.collectedById, {
        collectedTotal: Number(p._sum.amount || 0),
        paymentsCount: p._count.id || 0,
      });
    });

    // Fetch daily orders placed by these waiters
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        placedById: { in: waiters.map((w) => w.id) },
      },
      select: {
        placedById: true,
        total: true,
        paymentStatus: true,
      },
    });

    const orderMap = new Map();
    orders.forEach((o) => {
      const prev = orderMap.get(o.placedById) || {
        orderCount: 0,
        orderTotal: 0,
        paidOrderTotal: 0,
      };
      prev.orderCount += 1;
      prev.orderTotal += Number(o.total || 0);
      if (o.paymentStatus === "PAID") {
        prev.paidOrderTotal += Number(o.total || 0);
      }
      orderMap.set(o.placedById, prev);
    });

    // Combine into final list with daily stats
    const waitersWithStats = waiters.map((w) => {
      const pStats = paymentMap.get(w.id) || { collectedTotal: 0, paymentsCount: 0 };
      const oStats = orderMap.get(w.id) || { orderCount: 0, orderTotal: 0, paidOrderTotal: 0 };

      return {
        ...w,
        dailyStats: {
          collectedTotal: +pStats.collectedTotal.toFixed(2),
          paymentsCount: pStats.paymentsCount,
          ordersCount: oStats.orderCount,
          ordersTotal: +oStats.orderTotal.toFixed(2),
          paidOrderTotal: +oStats.paidOrderTotal.toFixed(2),
        },
      };
    });

    // Summary totals for all waiters
    const totalDailyCollected = waitersWithStats.reduce((sum, w) => sum + w.dailyStats.collectedTotal, 0);
    const totalDailyOrders = waitersWithStats.reduce((sum, w) => sum + w.dailyStats.ordersCount, 0);

    res.json({
      date: start.toISOString().slice(0, 10),
      waiters: waitersWithStats,
      summary: {
        totalWaiters: waiters.length,
        activeWaiters: waiters.filter((w) => w.active).length,
        totalDailyCollected: +totalDailyCollected.toFixed(2),
        totalDailyOrders,
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/waiters  { name, username, password }
// Create a new waiter account with username and password
router.post("/", ...adminOnly, async (req, res, next) => {
  try {
    const { name, username, password } = req.body || {};
    if (!name?.trim() || !username?.trim() || !password?.trim()) {
      return res.status(400).json({ error: "Name, username and password are required" });
    }

    const cleanUsername = String(username).trim().toLowerCase();

    // Check if username already taken
    const existing = await prisma.user.findUnique({ where: { username: cleanUsername } });
    if (existing) {
      return res.status(409).json({ error: "Username is already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const waiter = await prisma.user.create({
      data: {
        name: String(name).trim(),
        username: cleanUsername,
        passwordHash,
        role: "WAITER",
        active: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    res.status(201).json({ waiter });
  } catch (e) {
    next(e);
  }
});

// PUT /api/waiters/:id  { name, active, password? }
// Update waiter information or reset password
router.put("/:id", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, active, password } = req.body || {};

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (active !== undefined) data.active = !!active;
    if (password && String(password).trim()) {
      data.passwordHash = await bcrypt.hash(String(password).trim(), 10);
    }

    const waiter = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    res.json({ waiter });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/waiters/:id
// Delete a waiter
router.delete("/:id", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // Verify user is a waiter
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== "WAITER") {
      return res.status(404).json({ error: "Waiter not found" });
    }

    // Check if waiter has linked orders or payments
    const [orderCount, paymentCount] = await Promise.all([
      prisma.order.count({ where: { placedById: id } }),
      prisma.payment.count({ where: { collectedById: id } }),
    ]);

    if (orderCount > 0 || paymentCount > 0) {
      // Soft-deactivate if they have historical order/audit records
      await prisma.user.update({
        where: { id },
        data: { active: false },
      });
      return res.json({ ok: true, message: "Waiter has historical orders. Deactivated successfully." });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ ok: true, message: "Waiter deleted successfully." });
  } catch (e) {
    next(e);
  }
});

export default router;
