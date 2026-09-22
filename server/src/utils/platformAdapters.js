// Delivery-platform payload adapters.
//
// Each platform posts orders in its OWN JSON shape. These adapters translate a
// platform payload into our normalised order shape:
//
//   {
//     externalId,
//     customer: { name, phone },
//     delivery: { name, phone, street, buildingNo, room, zone },
//     items:    [ { sku?, menuItemId?, qty, note? } ],
//     note
//   }
//
// The adapters are written defensively (they accept several common field names)
// because exact field names differ per integration contract. When you receive a
// platform's real API docs, tighten the field paths in that platform's adapter.
// Line items (name / price / qty) are used as-is to create external orders — no
// internal menu link is required.

// Return the first defined, non-empty value among the given paths.
function pick(obj, ...paths) {
  for (const p of paths) {
    const val = p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return undefined;
}

function digits(v) {
  return v == null ? "" : String(v).replace(/[^\d+]/g, "");
}

function fullName(...parts) {
  return parts.filter(Boolean).join(" ").trim();
}

// Coerce a price that may be a number, a numeric string, or a nested object
// like { amount: 32 } / { value: 32 } / { amount: 3200, ... } (cents handled by
// the platform; we take the value as-is).
function priceOf(raw) {
  const v = pick(raw, "unit_price", "unitPrice", "price", "amount", "item_price", "itemPrice", "cost");
  if (v == null) return 0;
  if (typeof v === "object") return Number(pick(v, "amount", "value", "amount_decimal", "total")) || 0;
  return Number(v) || 0;
}

// Collect modifier / add-on / option names so the kitchen sees them.
function modifiersOf(raw) {
  const mods = pick(raw, "modifiers", "options", "addons", "add_ons", "extras", "choices", "toppings");
  if (!Array.isArray(mods)) return [];
  return mods
    .map((m) => (typeof m === "string" ? m : pick(m, "name", "title", "label", "option_name")))
    .filter(Boolean);
}

// Normalise one line item from any of the common shapes. Never returns a blank
// name (falls back to the SKU/code, then "Item") so nothing shows empty.
function normItem(raw) {
  const sku = pick(raw, "sku", "plu", "product_id", "productId", "item_id", "itemId", "pos_item_id", "posItemId", "code");
  const name = pick(raw, "name", "product_name", "productName", "item_name", "itemName", "title", "description");
  const baseNote = pick(raw, "special_instructions", "specialInstructions", "notes", "note", "remark", "comment");
  const mods = modifiersOf(raw);
  const note = [baseNote, mods.length ? `+ ${mods.join(", ")}` : ""].filter(Boolean).join(" ") || null;
  return {
    sku,
    menuItemId: pick(raw, "menuItemId"), // already-mapped payloads (e.g. internal tests)
    name: name || (sku ? String(sku) : "Item"),
    price: priceOf(raw),
    qty: Math.max(1, Number(pick(raw, "quantity", "qty", "count", "units") ?? 1) || 1),
    note,
  };
}

// The platform's own order total, if provided (already includes their tax/fees).
export function platformTotal(body) {
  const t =
    pick(body, "total", "order_total", "orderTotal", "grand_total", "grandTotal", "amount", "price.total") ?? null;
  return t == null ? null : Number(t) || 0;
}

// The platform's human-readable order number/reference, if any.
export function platformRef(body) {
  return (
    pick(body, "order_number", "orderNumber", "short_code", "shortCode", "display_id", "reference", "order_id", "orderId") ||
    null
  );
}

function normItems(raw) {
  const arr = pick(raw, "items", "products", "order_items", "orderItems", "lineItems", "line_items") || [];
  return (Array.isArray(arr) ? arr : []).map(normItem);
}

// Address block, tolerant of many field names.
function normDelivery(raw, name, phone) {
  const a = pick(raw, "delivery_address", "deliveryAddress", "address", "customer_address", "shipping_address") || {};
  return {
    name,
    phone,
    street: pick(a, "street_name", "street", "streetName", "line1", "address_line1", "road") || "",
    buildingNo: pick(a, "building", "building_no", "buildingNumber", "house_no", "building_number") || "",
    room: pick(a, "flat_number", "flatNumber", "apartment", "room", "unit", "flat") || null,
    zone: pick(a, "area", "zone", "district", "neighbourhood", "neighborhood", "region") || "",
  };
}

// ---- Talabat ----
function mapTalabat(body) {
  const name = fullName(
    pick(body, "customer.first_name", "customer.firstName", "customer.name"),
    pick(body, "customer.last_name", "customer.lastName")
  );
  const phone = digits(pick(body, "customer.mobile", "customer.phone", "customer_phone", "phone"));
  return {
    externalId: String(pick(body, "order_id", "orderId", "id", "externalId", "reference") || "").trim(),
    customer: { name, phone },
    delivery: normDelivery(body, name, phone),
    items: normItems(body),
    note: pick(body, "note", "comments", "order_note") || null,
  };
}

// ---- Snoonu ----
function mapSnoonu(body) {
  const name = fullName(pick(body, "customer.name", "customer.fullName", "user.name"));
  const phone = digits(pick(body, "customer.phone", "customer.mobile", "user.phone", "phone"));
  return {
    externalId: String(pick(body, "orderId", "order_id", "id", "externalId") || "").trim(),
    customer: { name, phone },
    delivery: normDelivery(body, name, phone),
    items: normItems(body),
    note: pick(body, "note", "instructions") || null,
  };
}

// ---- Keeta ----
function mapKeeta(body) {
  const name = fullName(pick(body, "recipient.name", "customer.name", "buyer.name"));
  const phone = digits(pick(body, "recipient.phone", "customer.phone", "buyer.phone", "phone"));
  return {
    externalId: String(pick(body, "orderId", "order_id", "poi_id", "id") || "").trim(),
    customer: { name, phone },
    delivery: normDelivery(body, name, phone),
    items: normItems(body),
    note: pick(body, "caution", "note", "remark") || null,
  };
}

// ---- Rafeeq ----
function mapRafeeq(body) {
  const name = fullName(pick(body, "customer.name", "client.name"));
  const phone = digits(pick(body, "customer.phone", "client.phone", "phone"));
  return {
    externalId: String(pick(body, "order_id", "orderId", "id", "reference") || "").trim(),
    customer: { name, phone },
    delivery: normDelivery(body, name, phone),
    items: normItems(body),
    note: pick(body, "note", "notes") || null,
  };
}

// ---- Deliveroo ----
function mapDeliveroo(body) {
  const name = fullName(pick(body, "customer.first_name", "customer.name"), pick(body, "customer.last_name"));
  const phone = digits(pick(body, "customer.phone_number", "customer.contact_number", "customer.phone", "phone"));
  return {
    externalId: String(pick(body, "order_id", "id", "order.id", "reference") || "").trim(),
    customer: { name, phone },
    delivery: normDelivery(body, name, phone),
    items: normItems(body),
    note: pick(body, "notes", "note") || null,
  };
}

const ADAPTERS = {
  TALABAT: mapTalabat,
  SNOONU: mapSnoonu,
  KEETA: mapKeeta,
  RAFEEQ: mapRafeeq,
  DELIVEROO: mapDeliveroo,
};

/**
 * Normalise a raw platform payload. Falls back to a passthrough for the
 * already-normalised internal shape (items with menuItemId).
 */
export function normalizePayload(platform, body) {
  const adapter = ADAPTERS[platform];
  if (!adapter) {
    // passthrough (already normalised)
    return {
      externalId: String(body.externalId || body.orderId || "").trim(),
      customer: body.customer || {},
      delivery: body.delivery || null,
      items: normItems(body),
      note: body.note || null,
    };
  }
  return adapter(body);
}
