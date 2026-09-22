// ---------------------------------------------------------------------------
// Per-platform delivery API wiring.
//
// Each delivery partner has its own authentication, webhook-signature method,
// outbound status endpoint and status vocabulary. This registry encodes those
// per platform so inbound (webhook verification) and outbound (status push) are
// individually wired and pluggable.
//
// The exact paths / vocabularies below are sensible defaults based on common
// partner-API patterns. When you get a platform's real partner-API docs, adjust
// that platform's block here — OR override any field at runtime, without a code
// change, via the integration's `config` JSON in Admin → Settings → Delivery
// Partners (config wins over these defaults).
//
// Spec shape:
//   inbound:  { signature: "shared-secret" | "hmac-sha256",
//               signatureHeader, digest: "hex" | "base64" }
//   outbound: { authScheme: "bearer" | "apiKey" | "none",
//               authHeader, statusPath, method, statusField, extraHeaders,
//               actionMap: { OUR_STATUS: "their_value" } }
// ---------------------------------------------------------------------------

const STATUS_STANDARD = {
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  READY: "ready",
  PICKED_UP: "picked_up",
  OUT_FOR_DELIVERY: "out_for_delivery",
};

const SPECS = {
  TALABAT: {
    label: "Talabat",
    inbound: { signature: "shared-secret", signatureHeader: "x-webhook-secret" },
    outbound: {
      authScheme: "bearer",
      statusPath: "/v2/orders/{externalId}/status",
      method: "POST",
      statusField: "status",
      actionMap: { ...STATUS_STANDARD, ACCEPTED: "order_accepted", REJECTED: "order_rejected" },
    },
  },

  SNOONU: {
    label: "Snoonu",
    inbound: { signature: "shared-secret", signatureHeader: "x-webhook-secret" },
    outbound: {
      authScheme: "apiKey",
      authHeader: "X-Api-Key",
      statusPath: "/partner/orders/{externalId}/status",
      method: "PUT",
      statusField: "status",
      actionMap: STATUS_STANDARD,
    },
  },

  KEETA: {
    label: "Keeta",
    // Keeta (Meituan family) typically signs webhooks with an HMAC.
    inbound: { signature: "hmac-sha256", signatureHeader: "x-keeta-signature", digest: "hex" },
    outbound: {
      authScheme: "bearer",
      statusPath: "/open/order/{externalId}/status",
      method: "POST",
      statusField: "orderStatus",
      actionMap: STATUS_STANDARD,
    },
  },

  RAFEEQ: {
    label: "Rafeeq",
    inbound: { signature: "shared-secret", signatureHeader: "x-webhook-secret" },
    outbound: {
      authScheme: "bearer",
      statusPath: "/api/orders/{externalId}/status",
      method: "POST",
      statusField: "status",
      actionMap: STATUS_STANDARD,
    },
  },

  DELIVEROO: {
    label: "Deliveroo",
    // Deliveroo signs webhooks with an HMAC-SHA256 (hex) over the raw body.
    inbound: { signature: "hmac-sha256", signatureHeader: "x-deliveroo-hmac-sha256", digest: "hex" },
    outbound: {
      authScheme: "bearer",
      statusPath: "/order/v1/orders/{externalId}/sync_status",
      method: "POST",
      statusField: "status",
      actionMap: {
        ...STATUS_STANDARD,
        ACCEPTED: "accepted",
        REJECTED: "rejected",
        READY: "ready_for_collection",
      },
    },
  },
};

const DEFAULT_SPEC = {
  inbound: { signature: "shared-secret", signatureHeader: "x-webhook-secret" },
  outbound: {
    authScheme: "bearer",
    statusPath: "/orders/{externalId}/status",
    method: "POST",
    statusField: "status",
    actionMap: STATUS_STANDARD,
  },
};

// Resolve a platform's spec, merged with any runtime `config` overrides stored
// on the integration (config.inbound / config.outbound take precedence).
export function getPlatformSpec(platform, config = {}) {
  const base = SPECS[platform] || DEFAULT_SPEC;
  return {
    inbound: { ...base.inbound, ...(config.inbound || {}) },
    outbound: { ...base.outbound, ...(config.outbound || {}) },
  };
}
