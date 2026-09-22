import React, { useEffect, useState, useCallback } from "react";
import { api } from "../../api.js";
import { Truck, Copy, Check, Plug, Save, Sparkles } from "lucide-react";

// Admin → Settings: manage delivery-partner API integrations.
// Secrets are write-only from the UI (masked/never returned); leaving a secret
// field blank keeps the stored value.
export default function DeliveryIntegrations({ onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({}); // platform -> { storeId, baseUrl, apiKey, apiSecret, webhookSecret }
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/integrations");
      setItems(data.integrations);
      const d = {};
      data.integrations.forEach((i) => {
        d[i.platform] = { storeId: i.storeId || "", baseUrl: i.baseUrl || "", apiKey: "", apiSecret: "", webhookSecret: "" };
      });
      setDrafts(d);
    } catch (e) {
      onToast?.(e.message);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (p, k, v) => setDrafts((d) => ({ ...d, [p]: { ...d[p], [k]: v } }));

  const save = async (it, enabled) => {
    setBusy(it.platform);
    try {
      const d = drafts[it.platform] || {};
      const payload = { storeId: d.storeId, baseUrl: d.baseUrl };
      if (enabled !== undefined) payload.enabled = enabled;
      // Only send secrets if the admin typed something new.
      if (d.apiKey) payload.apiKey = d.apiKey;
      if (d.apiSecret) payload.apiSecret = d.apiSecret;
      if (d.webhookSecret) payload.webhookSecret = d.webhookSecret;
      await api.put(`/integrations/${it.platform}`, payload);
      onToast?.(`${it.label} saved`);
      await load();
    } catch (e) {
      onToast?.(e.message);
    } finally {
      setBusy("");
    }
  };

  const test = async (it) => {
    setBusy(it.platform + ":test");
    try {
      const { data } = await api.post(`/integrations/${it.platform}/test`);
      onToast?.(`${it.label}: ${data.message}${data.baseUrlProbe != null ? ` (probe: ${data.baseUrlProbe})` : ""}`);
    } catch (e) {
      onToast?.(e.message);
    } finally {
      setBusy("");
    }
  };

  const simulate = async (platform = "ALL") => {
    setBusy("simulate:" + platform);
    try {
      const { data } = await api.post("/integrations/simulate", { platform });
      onToast?.(data.message || `Simulated ${data.count} partner orders! Check Billing & Kitchen.`);
    } catch (e) {
      onToast?.(e.message || "Simulation failed");
    } finally {
      setBusy("");
    }
  };

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      onToast?.("Copy failed — select and copy manually");
    }
  };

  if (loading) return <div className="card p-6 text-sm text-slate-500">Loading integrations…</div>;

  return (
    <div className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Delivery Partner Integrations</h2>
            <p className="text-xs text-slate-500">
              Connect Snoonu, Talabat, Keeta, Rafeeq and Deliveroo webhook &amp; API credentials.
            </p>
          </div>
        </div>

        <button
          onClick={() => simulate("ALL")}
          disabled={busy.startsWith("simulate")}
          className="btn-outline btn-sm !border-amber-400 !bg-amber-50 !text-amber-900 hover:!bg-amber-100 flex items-center gap-1.5 font-bold shadow-sm"
          title="Create realistic sample webhook orders from all 5 online delivery partners"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
          <span>{busy === "simulate:ALL" ? "Simulating..." : "Simulate All 5 Partner Orders"}</span>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((it) => {
          const d = drafts[it.platform] || {};
          return (
            <div key={it.platform} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{it.label}</span>
                  <span
                    className={`badge ${it.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {it.enabled ? "Enabled" : "Disabled"}
                  </span>
                  {it.configured && !it.enabled && <span className="badge bg-amber-100 text-amber-700">Configured</span>}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={it.enabled}
                    onChange={(e) => save(it, e.target.checked)}
                    className="h-4 w-4 accent-brand"
                  />
                  Enable
                </label>
              </div>

              {/* Webhook URL (give this to the platform) */}
              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Webhook URL (give to {it.label})
                </label>
                <div className="flex items-center gap-2">
                  <input readOnly className="input !bg-slate-50 text-xs" value={it.webhookUrl} />
                  <button
                    type="button"
                    onClick={() => copy(it.webhookUrl, it.platform + ":url")}
                    className="btn-outline btn-sm shrink-0"
                    title="Copy"
                  >
                    {copied === it.platform + ":url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Store / Vendor ID">
                  <input className="input" value={d.storeId} onChange={(e) => setField(it.platform, "storeId", e.target.value)} placeholder="platform store id" />
                </Field>
                <Field label="API Base URL">
                  <input className="input" value={d.baseUrl} onChange={(e) => setField(it.platform, "baseUrl", e.target.value)} placeholder="https://api.platform.com" />
                </Field>
                <Field label={`API Key ${it.hasApiKey ? `(saved ${it.apiKeyMask})` : ""}`}>
                  <input className="input" type="password" value={d.apiKey} onChange={(e) => setField(it.platform, "apiKey", e.target.value)} placeholder={it.hasApiKey ? "•••• keep existing" : "paste API key"} />
                </Field>
                <Field label={`API Secret ${it.hasApiSecret ? "(saved)" : ""}`}>
                  <input className="input" type="password" value={d.apiSecret} onChange={(e) => setField(it.platform, "apiSecret", e.target.value)} placeholder={it.hasApiSecret ? "•••• keep existing" : "paste API secret"} />
                </Field>
                <Field label={`Webhook Secret ${it.hasWebhookSecret ? "(saved)" : ""}`}>
                  <input className="input" type="password" value={d.webhookSecret} onChange={(e) => setField(it.platform, "webhookSecret", e.target.value)} placeholder={it.hasWebhookSecret ? "•••• keep existing" : "shared secret"} />
                </Field>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button className="btn-primary btn-sm" disabled={busy === it.platform} onClick={() => save(it)}>
                  <Save className="mr-1 inline h-3.5 w-3.5" />
                  {busy === it.platform ? "Saving…" : "Save"}
                </button>
                <button className="btn-outline btn-sm" disabled={busy === it.platform + ":test"} onClick={() => test(it)}>
                  <Plug className="mr-1 inline h-3.5 w-3.5" />
                  {busy === it.platform + ":test" ? "Testing…" : "Test"}
                </button>
                <button 
                  className="btn-outline btn-sm !border-amber-300 !bg-amber-50/70 text-amber-900 hover:!bg-amber-100 ml-auto flex items-center gap-1 font-bold" 
                  disabled={busy === "simulate:" + it.platform} 
                  onClick={() => simulate(it.platform)}
                  title={`Simulate an incoming ${it.label} order`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>{busy === "simulate:" + it.platform ? "Simulating..." : `Simulate ${it.label}`}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
      {children}
    </div>
  );
}
