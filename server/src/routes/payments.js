import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { emitOrderEvent, emitToOrder, emitGlobal } from "../socket.js";
import { getTaxRate, nextInvoiceNo } from "../utils/settings.js";

const router = Router();
const billing = [requireAuth, requireRole("CASHIER", "ADMIN")];

// POST /api/payments  { orderId, amount, mode, discount? }
// Records a payment and marks the order PAID when fully covered.
router.post("/", ...billing, async (req, res, next) => {
  try {
    const { orderId, amount, mode, discount } = req.body || {};
    if (!orderId || amount === undefined) {
      return res.status(400).json({ error: "orderId and amount are required" });
    }
    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
      include: { payments: true },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const taxRate = await getTaxRate();

    const result = await prisma.$transaction(async (tx) => {
      // optional last-minute discount adjustment (recompute tax on the discounted base)
      let current = order;
      if (discount !== undefined && Number(discount) !== Number(order.discount)) {
        const taxable = Math.max(0, Number(order.subtotal) - Number(discount));
        const newTax = +(taxable * taxRate).toFixed(2);
        const newTotal = +(taxable + newTax).toFixed(2);
        current = await tx.order.update({
          where: { id: order.id },
          data: { discount: Number(discount), tax: newTax, total: newTotal },
          include: { payments: true },
        });
      }

      await tx.payment.create({
        data: {
          orderId: current.id,
          amount: Number(amount),
          mode: mode || "CASH",
          collectedById: req.user.id,
        },
      });

      const paidAgg = await tx.payment.aggregate({
        where: { orderId: current.id },
        _sum: { amount: true },
      });
      const paid = Number(paidAgg._sum.amount || 0);
      const fullyPaid = paid + 1e-9 >= Number(current.total);

      // Assign a sequential fiscal invoice number the first time it is fully paid.
      let invoiceNo = current.invoiceNo;
      if (fullyPaid && !invoiceNo) {
        invoiceNo = await nextInvoiceNo(tx);
      }

      return tx.order.update({
        where: { id: current.id },
        data: { paymentStatus: fullyPaid ? "PAID" : "PENDING", invoiceNo },
        include: {
          items: true,
          payments: {
            include: {
              collectedBy: { select: { id: true, name: true, role: true, username: true } },
            },
            orderBy: { paidAt: "desc" },
          },
          table: true,
          deliveryInfo: true,
          placedBy: { select: { id: true, name: true, role: true, username: true } },
        },
      });
    });

    emitOrderEvent("order:updated", result);
    // Notify the specific customer watching this order (OrderSlip / BillView)
    emitToOrder(result.orderToken, "order:status", {
      orderToken: result.orderToken,
      status: result.status,
      paymentStatus: result.paymentStatus,
    });
    // Notify dashboard / reports globally so KPIs refresh
    emitGlobal("payment:done", { orderId: result.id, total: Number(result.total) });
    res.status(201).json({ order: result });
  } catch (e) {
    next(e);
  }
});

export default router;
