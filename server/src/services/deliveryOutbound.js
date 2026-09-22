import { getIntegration } from "../routes/integrations.js";

// Default per-platform status vocabulary. Real platforms differ; override via the
// integration's `config.actionMap` JSON when you have their API docs.
const DEFAULT_ACTION_MAP = {
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  READY: "ready",
  PICKED_UP: "picked_up",
  OUT_FOR_DELIVERY: "out_for_delivery",
};

/**
 * Push an order's new status to the delivery platform's API.
 *
 * Best-effort and NON-BLOCKING for the caller: it never throws — it returns a
 * result object so the local status update always succeeds even if the platform
 * call fails. Configure per platform via the stored integration:
 *   baseUrl   — platform API base
 *   apiKey    — bearer token
 *   config.statusPath   — path template, default "/orders/{externalId}/status"
 *   config.statusField  — body field name, default "status"
 *   config.actionMap    — { OUR_STATUS: "their_value" }
 *   config.method       — HTTP method, default "POST"
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

    const cfg = it.config || {};
    const actionMap = { ...DEFAULT_ACTION_MAP, ...(cfg.actionMap || {}) };
    const mapped = actionMap[platformStatus] || String(platformStatus).toLowerCase();

    const pathTpl = cfg.statusPath || "/orders/{externalId}/status";
    const path = pathTpl.replace("{externalId}", encodeURIComponent(order.externalId));
    const url = `${it.baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
    const field = cfg.statusField || "status";
    const method = (cfg.method || "POST").toUpperCase();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let resp;
    try {
      resp = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${it.apiKey}`,
          ...(it.storeId ? { "X-Store-Id": it.storeId } : {}),
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
