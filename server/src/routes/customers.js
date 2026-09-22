import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const staff = [requireAuth, requireRole("ADMIN", "CASHIER")];

// GET /api/customers?q=phone-or-name — CRM list with order/payment stats
router.get("/", ...staff, async (req, res, next) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : "";
    const customers = await prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { phone: { contains: q } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    // Attach lightweight stats per customer (orders + amount collected).
    const enriched = await Promise.all(
      customers.map(async (c) => {
        const orders = await prisma.order.findMany({
          where: { customerPhone: c.phone },
          select: { total: true, paymentStatus: true },
        });
        const collected = orders
          .filter((o) => o.paymentStatus === "PAID")
          .reduce((s, o) => s + Number(o.total), 0);
        return {
          ...c,
          orderCount: orders.length,
          collected: +collected.toFixed(2),
        };
      })
    );
    res.json({ customers: enriched });
  } catch (e) {
    next(e);
  }
});

// GET /api/customers/:phone/orders — a customer's order + payment history (staff view)
router.get("/:phone/orders", ...staff, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerPhone: req.params.phone },
      include: { items: true, payments: true, deliveryInfo: true, table: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ orders });
  } catch (e) {
    next(e);
  }
});

export default router;
