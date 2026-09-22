import { prisma } from "../prisma.js";
import { createExternalOrder } from "../routes/orders.js";
import { normalizePayload, platformTotal, platformRef } from "../utils/platformAdapters.js";

/**
 * Ingest one delivery-platform order (from a webhook or a re-process).
 *
 * EXTERNAL model: the order is created directly from the platform's raw line
 * items (name / price / qty) WITHOUT linking to the internal menu — no SKU
 * mapping required. The order then appears in the Kitchen & Billing screens
 * where staff run the platform lifecycle (Accept → Ready → Picked up).
 *
 * Returns { status, ... } — never throws for expected cases.
 */
export async function ingestPlatformOrder(platform, body) {
  const norm = normalizePayload(platform, body);
  const externalId = norm.externalId;
  if (!externalId) return { status: 400, error: "externalId is required" };

  // Idempotency: ignore duplicate deliveries of the same platform order.
  const existing = await prisma.platformOrder.findUnique({
    where: { platform_externalId: { platform, externalId } },
  });
  if (existing && existing.mappedOrderId) {
    return { status: 200, ok: true, duplicate: true, mappedOrderId: existing.mappedOrderId };
  }
  const log = existing || (await prisma.platformOrder.create({ data: { platform, externalId, payload: body } }));

  if (!norm.items || norm.items.length === 0) {
    return { status: 422, error: "Order has no items" };
  }

  const order = await createExternalOrder(norm.items, {
    source: platform,
    externalId,
    platformRef: platformRef(body),
    customerPhone: norm.customer?.phone || norm.delivery?.phone,
    note: norm.note,
    delivery: norm.delivery,
    total: platformTotal(body),
  });

  await prisma.platformOrder.update({ where: { id: log.id }, data: { mappedOrderId: order.id } });
  return { status: 201, ok: true, orderNo: order.orderNo, orderId: order.id };
}

/**
 * Re-process any platform orders that were logged but not turned into orders.
 * With the external model this is normally a no-op (every order is created on
 * arrival), kept for the Menu-Mapping approve flow to call safely.
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
