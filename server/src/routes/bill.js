import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

// Shape an order into a public-safe bill payload.
function publicBill(order) {
  return {
    orderNo: order.orderNo,
    invoiceNo: order.invoiceNo || null,
    orderToken: order.orderToken,
    type: order.type,
    status: order.status,
    createdAt: order.createdAt,
    table: order.table ? order.table.tableNo : null,
    items: order.items.map((i) => ({ name: i.name, qty: i.qty, price: Number(i.price), note: i.note })),
    subtotal: Number(order.subtotal),
    tax: Number(order.tax),
    discount: Number(order.discount),
    total: Number(order.total),
    paymentStatus: order.paymentStatus,
    paidAt: order.payments?.[0]?.paidAt || null,
  };
}

// GET /api/bill/:orderToken
// PUBLIC. Full bill is only revealed AFTER payment is completed.
router.get("/:orderToken", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderToken: req.params.orderToken },
      include: { items: true, table: true, payments: { orderBy: { paidAt: "asc" } } },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.paymentStatus !== "PAID") {
      // Do not expose amounts before payment.
      return res.json({
        paid: false,
        orderNo: order.orderNo,
        status: order.status,
        message: "Your bill will be available here after payment is completed.",
      });
    }
    res.json({ paid: true, bill: publicBill(order) });
  } catch (e) {
    next(e);
  }
});

// GET /api/bill/history/:phone
// PUBLIC. Returns ONLY paid orders for a phone number (order history).
// NOTE: for production, gate this behind an OTP sent to the phone. See README.
router.get("/history/:phone", async (req, res, next) => {
  try {
    const phone = String(req.params.phone).trim();
    if (!phone) return res.status(400).json({ error: "Phone required" });
    const orders = await prisma.order.findMany({
      where: { customerPhone: phone, paymentStatus: "PAID" },
      include: { items: true, table: true, payments: { orderBy: { paidAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ orders: orders.map(publicBill) });
  } catch (e) {
    next(e);
  }
});

export default router;
