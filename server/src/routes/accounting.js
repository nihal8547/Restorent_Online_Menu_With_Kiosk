import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getSettings } from "../utils/settings.js";

const router = Router();
const adminOnly = [requireAuth, requireRole("ADMIN")];

// ---------- helpers ----------

function rangeFromQuery(q) {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

const n2 = (v) => Number(v || 0).toFixed(2);

// CSV cell escaping (RFC 4180).
function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function sendCsv(res, filename, csv) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("﻿" + csv); // BOM for Excel
}

// Expense category is encoded as "[Category] title".
function expenseCategory(title) {
  const m = String(title).match(/^\[(.*?)\]/);
  return m ? m[1] : "General";
}

const PAYMENT_ACCOUNT = { CASH: "Cash", CARD: "Bank (Card)", ONLINE: "Bank (Online)" };

// Load paid orders + expenses for a range, plus settings.
async function loadBooks(from, to) {
  const [orders, expenses, settings] = await Promise.all([
    prisma.order.findMany({
      where: { paymentStatus: "PAID", createdAt: { gte: from, lte: to } },
      include: { payments: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.expense.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { date: "asc" } }),
    getSettings(),
  ]);
  return { orders, expenses, settings };
}

// ---------- 1. Financial summary (P&L) ----------
// GET /api/accounting/summary?from&to
router.get("/summary", ...adminOnly, async (req, res, next) => {
  try {
    const { from, to } = rangeFromQuery(req.query);
    const { orders, expenses, settings } = await loadBooks(from, to);

    let netSales = 0,
      tax = 0,
      gross = 0,
      discount = 0;
    const byMode = {};
    for (const o of orders) {
      const base = Number(o.subtotal) - Number(o.discount);
      netSales += base;
      tax += Number(o.tax);
      gross += Number(o.total);
      discount += Number(o.discount);
      for (const p of o.payments) {
        byMode[p.mode] = (byMode[p.mode] || 0) + Number(p.amount);
      }
    }

    const expByCat = {};
    let expenseTotal = 0;
    for (const e of expenses) {
      const c = expenseCategory(e.title);
      expByCat[c] = (expByCat[c] || 0) + Number(e.amount);
      expenseTotal += Number(e.amount);
    }

    res.json({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      currency: settings.currency || "",
      taxLabel: settings.taxLabel || "Tax",
      netSales: +netSales.toFixed(2),
      discount: +discount.toFixed(2),
      taxCollected: +tax.toFixed(2),
      grossCollected: +gross.toFixed(2),
      paymentsByMode: Object.fromEntries(Object.entries(byMode).map(([k, v]) => [k, +v.toFixed(2)])),
      expenseTotal: +expenseTotal.toFixed(2),
      expensesByCategory: Object.fromEntries(Object.entries(expByCat).map(([k, v]) => [k, +v.toFixed(2)])),
      netProfit: +(netSales - expenseTotal).toFixed(2),
      invoiceCount: orders.length,
      expenseCount: expenses.length,
    });
  } catch (e) {
    next(e);
  }
});

// ---------- 2. Double-entry journal (JSON) ----------
// GET /api/accounting/journal?from&to
function buildJournal(orders, expenses, taxLabel) {
  const entries = [];
  for (const o of orders) {
    const base = Number(o.subtotal) - Number(o.discount);
    const date = o.createdAt.toISOString().slice(0, 10);
    const ref = o.invoiceNo || o.orderNo;
    const mode = o.payments[0]?.mode || "CASH";
    const lines = [
      { account: PAYMENT_ACCOUNT[mode] || "Cash", debit: Number(o.total), credit: 0 },
      { account: "Sales Revenue", debit: 0, credit: +base.toFixed(2) },
    ];
    if (Number(o.tax) > 0) {
      lines.push({ account: `${taxLabel} Payable`, debit: 0, credit: Number(o.tax) });
    }
    entries.push({ date, ref, type: "Sales", narration: `Sale ${ref}`, lines });
  }
  for (const e of expenses) {
    const date = e.date.toISOString().slice(0, 10);
    entries.push({
      date,
      ref: `EXP-${e.id}`,
      type: "Payment",
      narration: e.title,
      lines: [
        { account: `Expense: ${expenseCategory(e.title)}`, debit: Number(e.amount), credit: 0 },
        { account: "Cash", debit: 0, credit: Number(e.amount) },
      ],
    });
  }
  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

router.get("/journal", ...adminOnly, async (req, res, next) => {
  try {
    const { from, to } = rangeFromQuery(req.query);
    const { orders, expenses, settings } = await loadBooks(from, to);
    const entries = buildJournal(orders, expenses, settings.taxLabel || "Tax");
    const totalDebit = entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.debit, 0), 0);
    const totalCredit = entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.credit, 0), 0);
    res.json({ entries, totalDebit: +totalDebit.toFixed(2), totalCredit: +totalCredit.toFixed(2) });
  } catch (e) {
    next(e);
  }
});

// ---------- 3. CSV exports (Excel / QuickBooks / Zoho) ----------

// Sales register — one row per paid invoice.
router.get("/export/sales.csv", ...adminOnly, async (req, res, next) => {
  try {
    const { from, to } = rangeFromQuery(req.query);
    const { orders, settings } = await loadBooks(from, to);
    const label = settings.taxLabel || "Tax";
    const header = ["Date", "Invoice No", "Order No", "Type", "Customer Phone", "Subtotal", "Discount", label, "Total", "Payment Mode"];
    const rows = [header];
    for (const o of orders) {
      rows.push([
        o.createdAt.toISOString().slice(0, 10),
        o.invoiceNo || "",
        o.orderNo,
        o.type,
        o.customerPhone || "",
        n2(o.subtotal),
        n2(o.discount),
        n2(o.tax),
        n2(o.total),
        o.payments[0]?.mode || "",
      ]);
    }
    sendCsv(res, `sales_${req.query.from || "start"}_${req.query.to || "today"}.csv`, toCsv(rows));
  } catch (e) {
    next(e);
  }
});

// Expense register.
router.get("/export/expenses.csv", ...adminOnly, async (req, res, next) => {
  try {
    const { from, to } = rangeFromQuery(req.query);
    const { expenses } = await loadBooks(from, to);
    const rows = [["Date", "Category", "Title", "Amount", "Note"]];
    for (const e of expenses) {
      rows.push([
        e.date.toISOString().slice(0, 10),
        expenseCategory(e.title),
        e.title.replace(/^\[.*?\]\s*/, ""),
        n2(e.amount),
        e.note || "",
      ]);
    }
    sendCsv(res, `expenses_${req.query.from || "start"}_${req.query.to || "today"}.csv`, toCsv(rows));
  } catch (e) {
    next(e);
  }
});

// Journal (double-entry) — one row per debit/credit line.
router.get("/export/journal.csv", ...adminOnly, async (req, res, next) => {
  try {
    const { from, to } = rangeFromQuery(req.query);
    const { orders, expenses, settings } = await loadBooks(from, to);
    const entries = buildJournal(orders, expenses, settings.taxLabel || "Tax");
    const rows = [["Date", "Voucher", "Type", "Account", "Debit", "Credit", "Narration"]];
    for (const en of entries) {
      for (const l of en.lines) {
        rows.push([en.date, en.ref, en.type, l.account, l.debit ? n2(l.debit) : "", l.credit ? n2(l.credit) : "", en.narration]);
      }
    }
    sendCsv(res, `journal_${req.query.from || "start"}_${req.query.to || "today"}.csv`, toCsv(rows));
  } catch (e) {
    next(e);
  }
});

// ---------- 4. Tally XML export (importable vouchers) ----------
function xmlEscape(s) {
  return String(s ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}
function tallyDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// A Sales voucher: debit party (Cash/Bank), credit Sales + Tax ledgers.
function salesVoucher(o, taxLedger) {
  const base = (Number(o.subtotal) - Number(o.discount)).toFixed(2);
  const mode = o.payments[0]?.mode || "CASH";
  const partyLedger = PAYMENT_ACCOUNT[mode] || "Cash";
  const date = tallyDate(o.createdAt);
  const ref = xmlEscape(o.invoiceNo || o.orderNo);
  const taxLine =
    Number(o.tax) > 0
      ? `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(taxLedger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>-${n2(o.tax)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`
      : "";
  return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER VCHTYPE="Sales" ACTION="Create">
        <DATE>${date}</DATE>
        <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${ref}</VOUCHERNUMBER>
        <PARTYLEDGERNAME>${xmlEscape(partyLedger)}</PARTYLEDGERNAME>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(partyLedger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>${n2(o.total)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Sales Revenue</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>-${base}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>${taxLine}
      </VOUCHER>
    </TALLYMESSAGE>`;
}

// A Payment voucher for an expense: debit Expense ledger, credit Cash.
function expenseVoucher(e) {
  return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER VCHTYPE="Payment" ACTION="Create">
        <DATE>${tallyDate(e.date)}</DATE>
        <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
        <VOUCHERNUMBER>EXP-${e.id}</VOUCHERNUMBER>
        <NARRATION>${xmlEscape(e.title)}</NARRATION>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape("Expense: " + expenseCategory(e.title))}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>${n2(e.amount)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Cash</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>-${n2(e.amount)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      </VOUCHER>
    </TALLYMESSAGE>`;
}

router.get("/export/tally.xml", ...adminOnly, async (req, res, next) => {
  try {
    const { from, to } = rangeFromQuery(req.query);
    const { orders, expenses, settings } = await loadBooks(from, to);
    const taxLedger = `${settings.taxLabel || "Tax"} Payable`;
    const company = settings.businessName || settings.shopName || "Zafran";

    const vouchers = [...orders.map((o) => salesVoucher(o, taxLedger)), ...expenses.map(expenseVoucher)].join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${xmlEscape(company)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tally_${req.query.from || "start"}_${req.query.to || "today"}.xml"`);
    res.send(xml);
  } catch (e) {
    next(e);
  }
});

export default router;
