import { prisma } from "../prisma.js";

// Read all settings as a plain object { key: value }.
export async function getSettings() {
  const list = await prisma.setting.findMany();
  return list.reduce((acc, s) => {
    acc[s.key] = s.value;
    return acc;
  }, {});
}

// Tax rate as a fraction (e.g. "5" -> 0.05). Defaults to 0 (no tax).
export async function getTaxRate() {
  const s = await prisma.setting.findUnique({ where: { key: "taxRate" } });
  const pct = Number(s?.value ?? 0);
  return Number.isFinite(pct) && pct > 0 ? pct / 100 : 0;
}

/**
 * Assign the next sequential fiscal invoice number inside a transaction.
 * Uses a Setting row "invoiceCounter" as an atomic-ish counter.
 * Returns a formatted string, e.g. "INV-000123".
 */
export async function nextInvoiceNo(tx) {
  const prefixRow = await tx.setting.findUnique({ where: { key: "invoicePrefix" } });
  const prefix = prefixRow?.value || "INV";

  const counterRow = await tx.setting.findUnique({ where: { key: "invoiceCounter" } });
  const next = Number(counterRow?.value || 0) + 1;

  await tx.setting.upsert({
    where: { key: "invoiceCounter" },
    update: { value: String(next) },
    create: { key: "invoiceCounter", value: String(next) },
  });

  return `${prefix}-${String(next).padStart(6, "0")}`;
}
