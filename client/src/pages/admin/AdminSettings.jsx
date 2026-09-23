import React, { useState, useEffect } from "react";
import { api } from "../../api.js";
import { Toast } from "../../components/ui.jsx";
import { useAuth } from "../../store/auth.js";
import { useSettings } from "../../store/settings.js";
import { 
  User, 
  Store, 
  MessageCircle, 
  Phone, 
  Save, 
  Receipt, 
  Bell, 
  Layers, 
  HelpCircle, 
  ShieldCheck, 
  Volume2, 
  Eye, 
  EyeOff, 
  CheckCircle2,
  Sparkles
} from "lucide-react";
import DeliveryIntegrations from "../../components/admin/DeliveryIntegrations.jsx";

const SETTINGS_TABS = [
  { id: "assistance", label: "Waiter Assistance", icon: Bell, badge: "New" },
  { id: "shop", label: "Shop Details", icon: Store },
  { id: "profile", label: "Admin Profile", icon: User },
  { id: "tax", label: "Tax & Invoicing", icon: Receipt },
  { id: "integrations", label: "Delivery Channels", icon: Layers },
  { id: "support", label: "Help & Support", icon: HelpCircle },
];

export default function AdminSettings() {
  const { user } = useAuth();
  const { shopName, shopTagline, currency, shopLogo, callWaiterEnabled, updateSettings } = useSettings();

  const [activeTab, setActiveTab] = useState("assistance");
  const [toast, setToast] = useState("");

  // Customer Assistance Dongle Toggle
  const [assistanceEnabled, setAssistanceEnabled] = useState(callWaiterEnabled !== false);
  const [savingAssistance, setSavingAssistance] = useState(false);

  // Profile Form
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    password: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Shop Form
  const [shopForm, setShopForm] = useState({
    shopName: shopName || "",
    shopTagline: shopTagline || "",
    currency: currency || "",
    shopLogo: shopLogo || "/logo.svg",
  });
  const [savingShop, setSavingShop] = useState(false);

  // Tax / Fiscal Form
  const [taxForm, setTaxForm] = useState({
    businessName: "",
    businessAddress: "",
    taxNumber: "",
    taxRate: "",
    taxLabel: "VAT",
    invoicePrefix: "INV",
  });
  const [savingTax, setSavingTax] = useState(false);

  useEffect(() => {
    setShopForm({ shopName, shopTagline, currency, shopLogo: shopLogo || "/logo.svg" });
  }, [shopName, shopTagline, currency, shopLogo]);

  useEffect(() => {
    setAssistanceEnabled(callWaiterEnabled !== false);
  }, [callWaiterEnabled]);

  // Load fiscal settings
  useEffect(() => {
    api
      .get("/settings")
      .then(({ data }) => {
        setTaxForm({
          businessName: data.businessName || "",
          businessAddress: data.businessAddress || "",
          taxNumber: data.taxNumber || "",
          taxRate: data.taxRate || "",
          taxLabel: data.taxLabel || "VAT",
          invoicePrefix: data.invoicePrefix || "INV",
        });
        if (data.call_waiter_enabled !== undefined) {
          setAssistanceEnabled(data.call_waiter_enabled !== "0" && data.call_waiter_enabled !== false);
        }
      })
      .catch(() => {});
  }, []);

  // Save Customer Assistance Setting
  const saveAssistanceConfig = async () => {
    setSavingAssistance(true);
    try {
      await updateSettings({
        call_waiter_enabled: assistanceEnabled ? "1" : "0",
      });
      setToast(
        assistanceEnabled 
          ? "Customer Assistance Dongle is now ACTIVE on customer pages"
          : "Customer Assistance Dongle is now HIDDEN from customer pages"
      );
    } catch (err) {
      setToast(err.message || "Failed to update assistance setting");
    } finally {
      setSavingAssistance(false);
    }
  };

  const saveTax = async (e) => {
    e.preventDefault();
    setSavingTax(true);
    try {
      await api.put("/settings", taxForm);
      setToast("Tax & invoice settings saved");
    } catch (err) {
      setToast(err.message || "Failed to save tax settings");
    } finally {
      setSavingTax(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.put("/auth/profile", profileForm);
      localStorage.setItem("ev_user", JSON.stringify(data.user));
      setToast("Profile updated successfully. (Reload to see changes)");
      setProfileForm((f) => ({ ...f, password: "" }));
    } catch (err) {
      setToast(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveShopConfig = async (e) => {
    e.preventDefault();
    setSavingShop(true);
    try {
      await updateSettings(shopForm);
      setToast("Shop configuration updated successfully");
    } catch (err) {
      setToast(err.message || "Failed to update shop configuration");
    } finally {
      setSavingShop(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Settings &amp; Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Customize customer assistance dongle, store branding, fiscal invoicing, and integrations.
        </p>
      </div>

      {/* Main Settings Container with Internal Mini-Sidebar */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        
        {/* ========================================================= */}
        {/* MINI SIDEBAR                                              */}
        {/* ========================================================= */}
        <aside className="w-full md:w-64 shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-2 overflow-x-auto md:overflow-visible">
          <div className="flex md:flex-col gap-1">
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-left text-sm font-bold transition whitespace-nowrap md:whitespace-normal ${
                    isActive
                      ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-slate-400"}`} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && (
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      isActive ? "bg-amber-400 text-slate-950" : "bg-amber-100 text-amber-800"
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden md:block mt-6 pt-4 border-t border-slate-100 px-3 text-[11px] text-slate-400">
            <p className="font-semibold text-slate-500">System Mode</p>
            <p className="mt-0.5">Production Ready v1.0</p>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* SETTINGS CONTENT PANEL                                    */}
        {/* ========================================================= */}
        <main className="flex-1 w-full min-w-0">

          {/* TAB 1: WAITER ASSISTANCE & DONGLE */}
          {activeTab === "assistance" && (
            <div className="space-y-6">
              <div className="card p-6 border-slate-200 shadow-sm">
                <div className="flex items-start justify-between gap-4 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                      <Bell className="w-5 h-5 animate-wiggle" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Customer Assistance Dongle</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Manage the floating "Call Waiter" service bell on customer landing and menu pages.
                      </p>
                    </div>
                  </div>

                  <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 ${
                    assistanceEnabled 
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}>
                    {assistanceEnabled ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Visible to Guests</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        <span>Hidden / Disabled</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Switch Control Box */}
                <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-slate-50 p-5 border border-slate-200">
                  <div>
                    <p className="text-sm font-black text-slate-900">Enable Floating Assistance Dongle</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md">
                      When enabled, guests can tap the floating bell to ring for waiter assistance. When disabled, the bell is hidden completely from all customer screens.
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={assistanceEnabled}
                      onChange={(e) => setAssistanceEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {/* Features & Workflow Highlights */}
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-600 mb-2">
                      <Volume2 className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Two-Tone "Ding Dong" Chime</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Instant audible synthesized Ding-Dong chime alerts all waiters when any customer rings the assistance bell.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-emerald-600 mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Multi-Waiter Realtime Sync</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      When one waiter clicks <strong>"Accept Request"</strong>, the alert is automatically removed from all other staff screens in real time.
                    </p>
                  </div>
                </div>

                {/* Preview Box */}
                <div className="mt-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                      Live Customer Dongle Preview
                    </span>
                    <span className="text-xs text-slate-400">
                      {assistanceEnabled ? "Active" : "Hidden"}
                    </span>
                  </div>

                  <div className="h-24 bg-white/5 rounded-xl border border-white/10 relative flex items-center justify-end px-6">
                    <span className="text-xs text-slate-400 italic">Customer screen bottom area...</span>
                    {assistanceEnabled && (
                      <div className="relative flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 px-3.5 py-2.5 shadow-lg text-white text-xs font-black uppercase tracking-wide">
                        <Bell className="w-4 h-4 animate-wiggle" />
                        <span>Call Waiter</span>
                        <span className="rounded-full bg-black/30 px-1.5 py-0.5 text-[9px]">T-5</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Save Button */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={saveAssistanceConfig}
                    disabled={savingAssistance}
                    className="btn-primary flex items-center gap-2 !bg-amber-600 hover:!bg-amber-700"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingAssistance ? "Saving..." : "Save Assistance Setting"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SHOP CONFIGURATION */}
          {activeTab === "shop" && (
            <div className="card p-6 border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Shop Configuration</h2>
                  <p className="text-xs text-slate-500">Configure your store brand identity and currency.</p>
                </div>
              </div>

              <form onSubmit={saveShopConfig} className="space-y-4">
                {/* Company Logo Setting */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Company Logo
                  </label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="h-16 w-16 rounded-2xl bg-white border border-slate-200 p-2 flex items-center justify-center shrink-0 shadow-sm">
                      <img
                        src={shopForm.shopLogo || "/logo.svg"}
                        alt="Logo Preview"
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/logo.svg";
                        }}
                      />
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <input
                        type="text"
                        placeholder="Logo image URL (e.g. /logo.svg or https://...)"
                        className="input text-xs"
                        value={shopForm.shopLogo}
                        onChange={(e) => setShopForm({ ...shopForm, shopLogo: e.target.value })}
                      />
                      <div className="flex items-center gap-2">
                        <label className="btn-outline !py-1 !px-3 text-xs cursor-pointer inline-flex items-center gap-1.5 hover:bg-slate-100">
                          <span>Upload Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  setShopForm((prev) => ({ ...prev, shopLogo: reader.result }));
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setShopForm({ ...shopForm, shopLogo: "/logo.svg" })}
                          className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                        >
                          Reset Default Logo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Shop / Header Name
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={shopForm.shopName}
                    onChange={(e) => setShopForm({ ...shopForm, shopName: e.target.value })}
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    This will change the brand name shown on the customer menu and admin panel.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Shop Tagline
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={shopForm.shopTagline}
                    onChange={(e) => setShopForm({ ...shopForm, shopTagline: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Currency Prefix
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={shopForm.currency}
                    onChange={(e) => setShopForm({ ...shopForm, currency: e.target.value })}
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">E.g. QR, $, ₹, AED</p>
                </div>

                <div className="pt-2 text-right">
                  <button
                    type="submit"
                    className="btn-primary flex items-center gap-2 ml-auto !bg-indigo-600 hover:!bg-indigo-700"
                    disabled={savingShop}
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingShop ? "Saving..." : "Save Shop Config"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: PROFILE MANAGEMENT */}
          {activeTab === "profile" && (
            <div className="card p-6 border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Admin Profile</h2>
                  <p className="text-xs text-slate-500">Update your username, name, or password.</p>
                </div>
              </div>

              <form onSubmit={saveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Name</label>
                  <input
                    type="text"
                    className="input"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Username</label>
                  <input
                    type="text"
                    className="input"
                    value={profileForm.username}
                    onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    New Password (Leave blank to keep current)
                  </label>
                  <input
                    type="password"
                    className="input"
                    placeholder="********"
                    value={profileForm.password}
                    onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                  />
                </div>

                <div className="pt-2 text-right">
                  <button type="submit" className="btn-primary flex items-center gap-2 ml-auto" disabled={savingProfile}>
                    <Save className="w-4 h-4" />
                    <span>{savingProfile ? "Saving..." : "Save Profile"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: TAX & INVOICE */}
          {activeTab === "tax" && (
            <div className="card p-6 border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Tax &amp; Invoice (Fiscal)</h2>
                  <p className="text-xs text-slate-500">Configure compliant receipt details, VAT/TRN numbers, and tax rates.</p>
                </div>
              </div>

              <form onSubmit={saveTax} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Registered Business Name
                  </label>
                  <input
                    className="input"
                    value={taxForm.businessName}
                    onChange={(e) => setTaxForm({ ...taxForm, businessName: e.target.value })}
                    placeholder="Zafran Restaurant W.L.L."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Business Address
                  </label>
                  <input
                    className="input"
                    value={taxForm.businessAddress}
                    onChange={(e) => setTaxForm({ ...taxForm, businessAddress: e.target.value })}
                    placeholder="Street, City, Country"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Tax Registration No. (TRN / VAT No.)
                  </label>
                  <input
                    className="input"
                    value={taxForm.taxNumber}
                    onChange={(e) => setTaxForm({ ...taxForm, taxNumber: e.target.value })}
                    placeholder="TRN-XXXXXXXXX"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Tax %</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={taxForm.taxRate}
                      onChange={(e) => setTaxForm({ ...taxForm, taxRate: e.target.value })}
                      placeholder="5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Label</label>
                    <input
                      className="input"
                      value={taxForm.taxLabel}
                      onChange={(e) => setTaxForm({ ...taxForm, taxLabel: e.target.value })}
                      placeholder="VAT"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Inv. Prefix</label>
                    <input
                      className="input"
                      value={taxForm.invoicePrefix}
                      onChange={(e) => setTaxForm({ ...taxForm, invoicePrefix: e.target.value })}
                      placeholder="INV"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-slate-500">
                  Set Tax % to 0 to disable tax. Once set, every order applies this tax and each paid order gets a sequential invoice number for compliant receipts.
                </p>

                <div className="pt-2 text-right">
                  <button
                    type="submit"
                    className="btn-primary flex items-center gap-2 ml-auto !bg-emerald-600 hover:!bg-emerald-700"
                    disabled={savingTax}
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingTax ? "Saving..." : "Save Tax Settings"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 5: DELIVERY INTEGRATIONS */}
          {activeTab === "integrations" && (
            <div className="space-y-6">
              <DeliveryIntegrations onToast={setToast} />
            </div>
          )}

          {/* TAB 6: SUPPORT & ABOUT */}
          {activeTab === "support" && (
            <div className="card p-6 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-300/80 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Need Technical Help?</h2>
                  <p className="text-xs text-slate-500">Our engineering and operations team is available 24/7.</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Contact us via WhatsApp or Direct Call for any software assistance, feature requests, or troubleshooting.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href="https://wa.me/97430954643"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-3 rounded-2xl bg-[#25D366] text-white py-4 font-bold hover:brightness-110 active:scale-95 transition shadow-lg shadow-[#25D366]/20 text-sm"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>Chat on WhatsApp (+974 30954643)</span>
                </a>

                <a
                  href="tel:+97430954643"
                  className="flex items-center justify-center gap-3 rounded-2xl bg-slate-900 text-white py-4 font-bold hover:bg-slate-800 active:scale-95 transition shadow-lg shadow-slate-900/20 text-sm"
                >
                  <Phone className="w-5 h-5" />
                  <span>Call Support (+974 30954643)</span>
                </a>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                <p>Licensed to <strong className="text-slate-800">{shopName}</strong></p>
                <p>Software Version 1.0.0 • ERP &amp; POS Suite</p>
              </div>
            </div>
          )}

        </main>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
