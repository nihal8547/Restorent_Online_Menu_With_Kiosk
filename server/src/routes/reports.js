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

// GET /api/reports/top-items?from=&to=  — total units sold & revenue per item.
// No date params → all-time totals. Grouped by the live menu item.
router.get("/top-items", ...adminOnly, async (req, res, next) => {
  try {
    const where = { order: { paymentStatus: "PAID" } };
    if (req.query.from || req.query.to) {
      const from = req.query.from ? new Date(req.query.from) : new Date(0);
      const to = req.query.to ? new Date(req.query.to) : new Date();
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      where.order = { paymentStatus: "PAID", createdAt: { gte: from, lte: to } };
    }

    const grouped = await prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where,
      _sum: { qty: true },
    });

    // Resolve current names/prices and compute revenue per item.
    const ids = grouped.map((g) => g.menuItemId);
    const items = await prisma.menuItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, price: true, stockQty: true, trackStock: true },
    });
    const byId = new Map(items.map((m) => [m.id, m]));

    // Revenue from snapshot prices in order_items (accurate historical revenue).
    const revenueRows = await prisma.orderItem.findMany({
      where,
      select: { menuItemId: true, qty: true, price: true },
    });
    const revenueById = {};
    for (const r of revenueRows) {
      revenueById[r.menuItemId] = (revenueById[r.menuItemId] || 0) + Number(r.price) * r.qty;
    }

    const rows = grouped
      .map((g) => {
        const item = byId.get(g.menuItemId);
        return {
          menuItemId: g.menuItemId,
          name: item?.name || "(deleted item)",
          soldQty: g._sum.qty || 0,
          revenue: +(revenueById[g.menuItemId] || 0).toFixed(2),
          stockQty: item?.trackStock ? item.stockQty : null,
        };
      })
      .sort((a, b) => b.soldQty - a.soldQty);

    const totalUnits = rows.reduce((s, r) => s + r.soldQty, 0);
    res.json({ rows, totalUnits });
  } catch (e) {
    next(e);
  }
});

function parseRange(queryFrom, queryTo) {
  let start, end;
  if (queryFrom) {
    start = new Date(queryFrom);
    if (isNaN(start.getTime())) start = new Date();
  } else {
    start = new Date();
    start.setDate(start.getDate() - 6);
  }
  start.setHours(0, 0, 0, 0);

  if (queryTo) {
    end = new Date(queryTo);
    if (isNaN(end.getTime())) end = new Date();
  } else {
    end = new Date();
  }
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function toCSV(columns, rows) {
  const escape = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };
  const headerRow = columns.map((col) => escape(col.label)).join(",");
  const dataRows = rows.map((row) =>
    columns.map((col) => escape(typeof col.key === "function" ? col.key(row) : row[col.key])).join(",")
  );
  return [headerRow, ...dataRows].join("\r\n");
}

// GET /api/reports/advanced
// Comprehensive analytics payload
router.get("/advanced", ...adminOnly, async (req, res, next) => {
  try {
    const { start, end } = parseRange(req.query.from, req.query.to);
    const { type, source } = req.query;

    const orderWhere = {
      createdAt: { gte: start, lte: end },
    };
    if (type && type !== "ALL") {
      orderWhere.type = type;
    }
    if (source && source !== "ALL") {
      orderWhere.source = source;
    }

    const [orders, expenses] = await Promise.all([
      prisma.order.findMany({
        where: orderWhere,
        include: {
          table: { select: { tableNo: true } },
          placedBy: { select: { id: true, name: true } },
          payments: {
            include: {
              collectedBy: { select: { id: true, name: true } },
            },
          },
          items: {
            include: {
              menuItem: {
                select: {
                  categoryId: true,
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.expense.findMany({
        where: { date: { gte: start, lte: end } },
        orderBy: { date: "desc" },
      }),
    ]);

    // Financial Metrics
    const totalOrders = orders.length;
    const paidOrders = orders.filter((o) => o.paymentStatus === "PAID");
    const cancelledOrders = orders.filter((o) => o.status === "CANCELLED");
    const pendingOrders = orders.filter((o) => o.paymentStatus === "PENDING" && o.status !== "CANCELLED");

    let grossSales = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let netSales = 0;
    let totalItemsSold = 0;

    for (const o of paidOrders) {
      const orderTotal = Number(o.total || 0);
      const orderSubtotal = Number(o.subtotal || 0);
      const orderTax = Number(o.tax || 0);
      const orderDiscount = Number(o.discount || 0);

      netSales += orderTotal;
      totalDiscount += orderDiscount;
      totalTax += orderTax;
      grossSales += orderSubtotal > 0 ? orderSubtotal : orderTotal + orderDiscount - orderTax;

      for (const it of o.items) {
        totalItemsSold += it.qty;
      }
    }

    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const netProfit = netSales - totalExpenses;
    const profitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;
    const avgOrderValue = paidOrders.length > 0 ? netSales / paidOrders.length : 0;

    // Timeline breakdown (by day)
    const dayMap = new Map();
    const curr = new Date(start);
    while (curr <= end) {
      const key = curr.toISOString().slice(0, 10);
      dayMap.set(key, { date: key, sales: 0, orders: 0, expenses: 0, profit: 0 });
      curr.setDate(curr.getDate() + 1);
    }

    for (const o of paidOrders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      if (dayMap.has(key)) {
        const d = dayMap.get(key);
        d.sales += Number(o.total);
        d.orders += 1;
      }
    }

    for (const exp of expenses) {
      const key = new Date(exp.date).toISOString().slice(0, 10);
      if (dayMap.has(key)) {
        const d = dayMap.get(key);
        d.expenses += Number(exp.amount);
      }
    }

    const timeline = Array.from(dayMap.values()).map((d) => ({
      ...d,
      sales: +d.sales.toFixed(2),
      expenses: +d.expenses.toFixed(2),
      profit: +(d.sales - d.expenses).toFixed(2),
    }));

    // Hourly Distribution (0 to 23)
    const hourly = Array.from({ length: 24 }, (_, i) => {
      const hour12 = i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`;
      return { hour: i, label: hour12, sales: 0, count: 0 };
    });

    for (const o of paidOrders) {
      const h = new Date(o.createdAt).getHours();
      if (hourly[h]) {
        hourly[h].sales += Number(o.total);
        hourly[h].count += 1;
      }
    }
    hourly.forEach((h) => {
      h.sales = +h.sales.toFixed(2);
    });

    // Breakdown by Order Type
    const typeCountMap = { DINE_IN: { count: 0, sales: 0 }, TAKEAWAY: { count: 0, sales: 0 }, DELIVERY: { count: 0, sales: 0 } };
    for (const o of paidOrders) {
      const t = o.type || "DINE_IN";
      if (!typeCountMap[t]) typeCountMap[t] = { count: 0, sales: 0 };
      typeCountMap[t].count += 1;
      typeCountMap[t].sales += Number(o.total);
    }
    const byType = Object.entries(typeCountMap).map(([typeName, val]) => ({
      type: typeName,
      count: val.count,
      sales: +val.sales.toFixed(2),
      percentage: netSales > 0 ? +((val.sales / netSales) * 100).toFixed(1) : 0,
    }));

    // Breakdown by Order Source
    const sourceCountMap = {};
    for (const o of paidOrders) {
      const s = o.source || "IN_HOUSE";
      if (!sourceCountMap[s]) sourceCountMap[s] = { count: 0, sales: 0 };
      sourceCountMap[s].count += 1;
      sourceCountMap[s].sales += Number(o.total);
    }
    const bySource = Object.entries(sourceCountMap).map(([src, val]) => ({
      source: src,
      count: val.count,
      sales: +val.sales.toFixed(2),
      percentage: netSales > 0 ? +((val.sales / netSales) * 100).toFixed(1) : 0,
    })).sort((a, b) => b.sales - a.sales);

    // Breakdown by Payment Mode
    const paymentMap = {};
    for (const o of paidOrders) {
      for (const p of o.payments) {
        const mode = p.mode || "CASH";
        if (!paymentMap[mode]) paymentMap[mode] = { count: 0, amount: 0 };
        paymentMap[mode].count += 1;
        paymentMap[mode].amount += Number(p.amount);
      }
    }
    const totalPayments = Object.values(paymentMap).reduce((s, p) => s + p.amount, 0);
    const byPaymentMode = Object.entries(paymentMap).map(([mode, val]) => ({
      mode,
      count: val.count,
      amount: +val.amount.toFixed(2),
      percentage: totalPayments > 0 ? +((val.amount / totalPayments) * 100).toFixed(1) : 0,
    }));

    // Category and Item Analysis
    const categoryMap = {};
    const itemMap = {};
    for (const o of paidOrders) {
      for (const it of o.items) {
        const catName = it.menuItem?.category?.name || "General / Uncategorized";
        if (!categoryMap[catName]) categoryMap[catName] = { name: catName, qty: 0, revenue: 0 };
        categoryMap[catName].qty += it.qty;
        categoryMap[catName].revenue += Number(it.price) * it.qty;

        const itName = it.name;
        if (!itemMap[itName]) {
          itemMap[itName] = {
            name: itName,
            category: catName,
            qty: 0,
            revenue: 0,
            avgPrice: Number(it.price),
          };
        }
        itemMap[itName].qty += it.qty;
        itemMap[itName].revenue += Number(it.price) * it.qty;
      }
    }

    const byCategory = Object.values(categoryMap)
      .map((c) => ({
        ...c,
        revenue: +c.revenue.toFixed(2),
        percentage: netSales > 0 ? +((c.revenue / netSales) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const topItems = Object.values(itemMap)
      .map((it) => ({
        ...it,
        revenue: +it.revenue.toFixed(2),
        avgPrice: +(it.revenue / (it.qty || 1)).toFixed(2),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Staff Performance
    const waiterMap = {};
    for (const o of paidOrders) {
      if (o.placedBy) {
        const wId = o.placedBy.id;
        if (!waiterMap[wId]) {
          waiterMap[wId] = { id: wId, name: o.placedBy.name, count: 0, sales: 0 };
        }
        waiterMap[wId].count += 1;
        waiterMap[wId].sales += Number(o.total);
      }
    }
    const waiters = Object.values(waiterMap)
      .map((w) => ({
        ...w,
        sales: +w.sales.toFixed(2),
        avgTicket: +(w.sales / (w.count || 1)).toFixed(2),
      }))
      .sort((a, b) => b.sales - a.sales);

    const cashierMap = {};
    for (const o of paidOrders) {
      for (const p of o.payments) {
        if (p.collectedBy) {
          const cId = p.collectedBy.id;
          if (!cashierMap[cId]) {
            cashierMap[cId] = {
              id: cId,
              name: p.collectedBy.name,
              count: 0,
              cash: 0,
              card: 0,
              online: 0,
              total: 0,
            };
          }
          cashierMap[cId].count += 1;
          const amt = Number(p.amount);
          cashierMap[cId].total += amt;
          if (p.mode === "CASH") cashierMap[cId].cash += amt;
          else if (p.mode === "CARD") cashierMap[cId].card += amt;
          else cashierMap[cId].online += amt;
        }
      }
    }
    const cashiers = Object.values(cashierMap)
      .map((c) => ({
        ...c,
        total: +c.total.toFixed(2),
        cash: +c.cash.toFixed(2),
        card: +c.card.toFixed(2),
        online: +c.online.toFixed(2),
      }))
      .sort((a, b) => b.total - a.total);

    // Table Performance
    const tableMap = {};
    for (const o of paidOrders) {
      const tbl = o.table?.tableNo ? `Table ${o.table.tableNo}` : o.type === "DINE_IN" ? "Dine-In" : o.type;
      if (!tableMap[tbl]) tableMap[tbl] = { table: tbl, count: 0, sales: 0 };
      tableMap[tbl].count += 1;
      tableMap[tbl].sales += Number(o.total);
    }
    const tables = Object.values(tableMap)
      .map((t) => ({
        ...t,
        sales: +t.sales.toFixed(2),
        avgTicket: +(t.sales / (t.count || 1)).toFixed(2),
      }))
      .sort((a, b) => b.sales - a.sales);

    // Recent / Audit orders
    const auditOrders = orders.slice(0, 150).map((o) => ({
      id: o.id,
      orderNo: o.orderNo || `#${o.id}`,
      invoiceNo: o.invoiceNo,
      createdAt: o.createdAt,
      type: o.type,
      source: o.source,
      status: o.status,
      paymentStatus: o.paymentStatus,
      total: Number(o.total),
      subtotal: Number(o.subtotal),
      discount: Number(o.discount),
      tax: Number(o.tax),
      tableNo: o.table?.tableNo || null,
      placedBy: o.placedBy?.name || "Customer",
      itemsSummary: o.items.map((i) => `${i.qty}x ${i.name}`).join(", "),
      paymentModes: o.payments.map((p) => p.mode).join(", ") || "-",
      customerPhone: o.customerPhone,
    }));

    res.json({
      range: {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      },
      summary: {
        grossSales: +grossSales.toFixed(2),
        totalDiscount: +totalDiscount.toFixed(2),
        totalTax: +totalTax.toFixed(2),
        netSales: +netSales.toFixed(2),
        totalExpenses: +totalExpenses.toFixed(2),
        netProfit: +netProfit.toFixed(2),
        profitMargin: +profitMargin.toFixed(1),
        totalOrders,
        paidOrders: paidOrders.length,
        cancelledOrders: cancelledOrders.length,
        pendingOrders: pendingOrders.length,
        avgOrderValue: +avgOrderValue.toFixed(2),
        totalItemsSold,
      },
      timeline,
      hourly,
      byType,
      bySource,
      byPaymentMode,
      byCategory,
      topItems,
      staff: {
        waiters,
        cashiers,
      },
      tables,
      expenses: expenses.map((e) => ({
        id: e.id,
        date: e.date,
        title: e.title,
        amount: Number(e.amount),
        note: e.note,
      })),
      orders: auditOrders,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/reports/export/orders.csv
router.get("/export/orders.csv", ...adminOnly, async (req, res, next) => {
  try {
    const { start, end } = parseRange(req.query.from, req.query.to);
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        table: { select: { tableNo: true } },
        placedBy: { select: { name: true } },
        payments: { select: { mode: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const columns = [
      { label: "Date & Time", key: (o) => new Date(o.createdAt).toLocaleString() },
      { label: "Order No", key: (o) => o.orderNo || `#${o.id}` },
      { label: "Invoice No", key: "invoiceNo" },
      { label: "Type", key: "type" },
      { label: "Source", key: "source" },
      { label: "Table", key: (o) => o.table?.tableNo || "-" },
      { label: "Placed By", key: (o) => o.placedBy?.name || "Self-Order" },
      { label: "Status", key: "status" },
      { label: "Payment Status", key: "paymentStatus" },
      { label: "Subtotal", key: (o) => Number(o.subtotal).toFixed(2) },
      { label: "Discount", key: (o) => Number(o.discount).toFixed(2) },
      { label: "Tax", key: (o) => Number(o.tax).toFixed(2) },
      { label: "Total", key: (o) => Number(o.total).toFixed(2) },
      { label: "Payment Modes", key: (o) => o.payments.map((p) => p.mode).join(", ") || "-" },
      { label: "Customer Phone", key: "customerPhone" },
    ];

    const csv = toCSV(columns, orders);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="orders_${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

// GET /api/reports/export/items.csv
router.get("/export/items.csv", ...adminOnly, async (req, res, next) => {
  try {
    const { start, end } = parseRange(req.query.from, req.query.to);
    const items = await prisma.orderItem.findMany({
      where: { order: { paymentStatus: "PAID", createdAt: { gte: start, lte: end } } },
      include: {
        menuItem: {
          select: {
            category: { select: { name: true } },
          },
        },
      },
    });

    const map = new Map();
    for (const it of items) {
      const cat = it.menuItem?.category?.name || "General";
      const key = it.name;
      const cur = map.get(key) || { name: key, category: cat, qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += Number(it.price) * it.qty;
      map.set(key, cur);
    }

    const rows = Array.from(map.values())
      .map((r) => ({
        ...r,
        revenue: +r.revenue.toFixed(2),
        avgPrice: +(r.revenue / (r.qty || 1)).toFixed(2),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const columns = [
      { label: "Item Name", key: "name" },
      { label: "Category", key: "category" },
      { label: "Units Sold", key: "qty" },
      { label: "Average Unit Price", key: "avgPrice" },
      { label: "Total Revenue", key: "revenue" },
    ];

    const csv = toCSV(columns, rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="items_sales_${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

// GET /api/reports/export/summary.csv
router.get("/export/summary.csv", ...adminOnly, async (req, res, next) => {
  try {
    const { start, end } = parseRange(req.query.from, req.query.to);
    const [orders, expenses] = await Promise.all([
      prisma.order.findMany({
        where: { paymentStatus: "PAID", createdAt: { gte: start, lte: end } },
        select: { createdAt: true, total: true, subtotal: true, discount: true, tax: true },
      }),
      prisma.expense.findMany({
        where: { date: { gte: start, lte: end } },
        select: { date: true, amount: true },
      }),
    ]);

    const dayMap = new Map();
    const curr = new Date(start);
    while (curr <= end) {
      const key = curr.toISOString().slice(0, 10);
      dayMap.set(key, { date: key, orders: 0, gross: 0, discount: 0, tax: 0, net: 0, expenses: 0 });
      curr.setDate(curr.getDate() + 1);
    }

    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      if (dayMap.has(key)) {
        const d = dayMap.get(key);
        d.orders += 1;
        d.net += Number(o.total);
        d.discount += Number(o.discount);
        d.tax += Number(o.tax);
        d.gross += Number(o.subtotal) || Number(o.total);
      }
    }

    for (const exp of expenses) {
      const key = new Date(exp.date).toISOString().slice(0, 10);
      if (dayMap.has(key)) {
        const d = dayMap.get(key);
        d.expenses += Number(exp.amount);
      }
    }

    const rows = Array.from(dayMap.values()).map((d) => ({
      date: d.date,
      orders: d.orders,
      gross: +d.gross.toFixed(2),
      discount: +d.discount.toFixed(2),
      tax: +d.tax.toFixed(2),
      net: +d.net.toFixed(2),
      expenses: +d.expenses.toFixed(2),
      profit: +(d.net - d.expenses).toFixed(2),
    }));

    const columns = [
      { label: "Date", key: "date" },
      { label: "Orders Count", key: "orders" },
      { label: "Gross Sales", key: "gross" },
      { label: "Discounts", key: "discount" },
      { label: "Tax", key: "tax" },
      { label: "Net Sales", key: "net" },
      { label: "Expenses", key: "expenses" },
      { label: "Net Profit", key: "profit" },
    ];

    const csv = toCSV(columns, rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="financial_summary_${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

export default router;
