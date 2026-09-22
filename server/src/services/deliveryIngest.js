import { prisma } from "../prisma.js";
import { createOrder } from "../routes/orders.js";
import { normalizePayload } from "../utils/platformAdapters.js";
import { bestMenuItemMatch } from "../utils/nameMatch.js";

// Record unmapped SKUs as suggestions with a best-guess menu item.
async function recordSuggestions(platform, unmapped) {
  if (!unmapped.length) return;
  const items = await prisma.menuItem.findMany({ select: { id: true, name: true } });
  for (const u of unmapped) {
    if (!u.sku) continue;
    const best = bestMenuItemMatch(u.name, items);
    await prisma.platformSkuSuggestion.upsert({
      where: { platform_sku: { platform, sku: String(u.sku) } },
      update: {
        ...(u.name && { name: u.name }),
        ...(best && { suggestedMenuItemId: best.id }),
        seenCount: { increment: 1 },
      },
      create: {
        platform,
        sku: String(u.sku),
        name: u.name || null,
        suggestedMenuItemId: best?.id || null,
      },
    });
  }
}

/**
 * Ingest one delivery-platform order (from a webhook or a re-process).
 * Returns { status, ... } — never throws for expected cases.
 */
export async function ingestPlatformOrder(platform, body) {
  const norm = normalizePayload(platform, body);
  const externalId = norm.externalId;
  if (!externalId) return { status: 400, error: "externalId is required" };

  const existing = await prisma.platformOrder.findUnique({
    where: { platform_externalId: { platform, externalId } },
  });
  if (existing && existing.mappedOrderId) {
    return { status: 200, ok: true, duplicate: true, mappedOrderId: existing.mappedOrderId };
  }
  const log = existing || (await prisma.platformOrder.create({ data: { platform, externalId, payload: body } }));

  // Resolve line items to menu items (by menuItemId, else by SKU mapping).
  const skus = norm.items.filter((i) => !i.menuItemId && i.sku).map((i) => String(i.sku));
  const maps = skus.length
    ? await prisma.platformItemMap.findMany({ where: { platform, sku: { in: skus } } })
    : [];
  const skuToId = new Map(maps.map((m) => [m.sku, m.menuItemId]));

  const cart = [];
  const unmapped = [];
  for (const it of norm.items) {
    const menuItemId = it.menuItemId || skuToId.get(String(it.sku));
    if (!menuItemId) unmapped.push({ sku: it.sku, name: it.name });
    else cart.push({ menuItemId: Number(menuItemId), qty: it.qty, note: it.note });
  }

  if (unmapped.length || cart.length === 0) {
    await recordSuggestions(platform, unmapped);
    return {
      status: 422,
      error: cart.length === 0 ? "No mappable items in order" : "Some items are not mapped",
      unmappedSkus: unmapped.map((u) => u.sku),
    };
  }

  const order = await createOrder(cart, {
    type: "DELIVERY",
    source: platform,
    externalId,
    customerPhone: norm.customer?.phone || norm.delivery?.phone,
    note: norm.note,
    delivery: norm.delivery,
  });
  await prisma.platformOrder.update({ where: { id: log.id }, data: { mappedOrderId: order.id } });
  return { status: 201, ok: true, orderNo: order.orderNo, orderId: order.id };
}

/**
 * Re-process previously failed (unmapped) orders for a platform — called after
 * the admin adds a mapping so pending orders flow through without a resend.
 * Returns the number of orders that became real orders.
 */
export async function reprocessFailed(platform) {
  const failed = await prisma.platformOrder.findMany({
    where: { platform, mappedOrderId: null },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  let created = 0;
  for (const f of failed) {
    try {
      const r = await ingestPlatformOrder(platform, f.payload);
      if (r.status === 201) created++;
    } catch {
      /* skip and continue */
    }
  }
  return created;
}
