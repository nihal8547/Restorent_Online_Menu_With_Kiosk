import { getIntegration } from "../routes/integrations.js";
import { getPlatformSpec } from "../integrations/platformSpecs.js";

/**
 * Push an order's new status to the delivery platform's API.
 *
 * Best-effort and NON-BLOCKING for the caller: it never throws — it returns a
 * result object so the local status update always succeeds even if the platform
 * call fails.
 *
 * The per-platform wiring (endpoint, HTTP method, status vocabulary, auth
 * scheme) comes from `getPlatformSpec(platform, config)` — see
 * `server/src/integrations/platformSpecs.js`. Any field can be overridden at
 * runtime, without a code change, via the integration's `config.outbound` JSON:
 *   config.outbound.statusPath   — path template, {externalId} is substituted
 *   config.outbound.statusField  — body field name for the status
 *   config.outbound.actionMap    — { OUR_STATUS: "their_value" }
 *   config.outbound.method       — HTTP method
 *   config.outbound.authScheme   — "bearer" | "apiKey" | "none"
 *   config.outbound.authHeader   — header name when authScheme is "apiKey"
 *   config.outbound.extraHeaders — extra static headers
 *
 * @param {string} platform   e.g. "TALABAT"
 * @param {object} order      the order (needs externalId, platformStatus)
 * @param {string} platformStatus  our status, e.g. "ACCEPTED"
 */
export async function pushStatus(platform, order, platformStatus) {
  try {
    const it = await getIntegration(platform);
    if (!it || !it.enabled) return { ok: false, skipped: true, reason: "integration disabled" };
    if (!it.baseUrl || !it.apiKey) return { ok: false, skipped: true, reason: "baseUrl/apiKey not set" };
    if (!order.externalId) return { ok: false, skipped: true, reason: "no externalId" };

    const { outbound } = getPlatformSpec(platform, it.config || {});

    const mapped = outbound.actionMap?.[platformStatus] || String(platformStatus).toLowerCase();

    const pathTpl = outbound.statusPath || "/orders/{externalId}/status";
    const path = pathTpl.replace("{externalId}", encodeURIComponent(order.externalId));
    const url = `${it.baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
    const field = outbound.statusField || "status";
    const method = (outbound.method || "POST").toUpperCase();

    // Auth header per platform scheme: bearer token, custom API-key header, or none.
    const authHeaders = {};
    const scheme = outbound.authScheme || "bearer";
    if (scheme === "bearer") {
      authHeaders.Authorization = `Bearer ${it.apiKey}`;
    } else if (scheme === "apiKey") {
      authHeaders[outbound.authHeader || "X-Api-Key"] = it.apiKey;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let resp;
    try {
      resp = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
          ...(it.storeId ? { "X-Store-Id": it.storeId } : {}),
          ...(outbound.extraHeaders || {}),
        },
        body: JSON.stringify({ [field]: mapped, externalId: order.externalId, orderNo: order.orderNo }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const ok = resp.ok;
    let detail = `${resp.status}`;
    try {
      detail = (await resp.text())?.slice(0, 300) || detail;
    } catch {
      /* ignore body read errors */
    }
    return { ok, httpStatus: resp.status, detail, pushed: mapped, url };
  } catch (err) {
    return { ok: false, error: err.name === "AbortError" ? "timeout" : err.message };
  }
}
