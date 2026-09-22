import React, { useState, useEffect } from "react";
import { api } from "../../api.js";
import { Toast, Spinner } from "../../components/ui.jsx";
import { useAuth } from "../../store/auth.js";
import { useSettings } from "../../store/settings.js";
import { User, Store, MessageCircle, Phone, Save } from "lucide-react";

export default function AdminSettings() {
  const { user } = useAuth();
  const { shopName, shopTagline, currency, updateSettings } = useSettings();

  const [toast, setToast] = useState("");
  
  // Profile Form
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    username: user?.username || "",
    password: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Shop Form
  const [shopForm, setShopForm] = useState({
    shopName: shopName || "",
    shopTagline: shopTagline || "",
    currency: currency || "",
  });
  const [savingShop, setSavingShop] = useState(false);

  useEffect(() => {
    setShopForm({ shopName, shopTagline, currency });
  }, [shopName, shopTagline, currency]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.put("/auth/profile", profileForm);
      // Update local storage user details
      localStorage.setItem("ev_user", JSON.stringify(data.user));
      setToast("Profile updated successfully. (Reload to see changes)");
      setProfileForm(f => ({ ...f, password: "" })); // Clear password
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
    <div className="space-y-8 max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your profile, shop configuration, and get support.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-8">
          
          {/* PROFILE MANAGEMENT */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                <User className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Profile Management</h2>
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
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">New Password (Leave blank to keep current)</label>
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
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>

          {/* SHOP CONFIGURATION */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Store className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Shop Configuration</h2>
            </div>
            <form onSubmit={saveShopConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Shop / Header Name</label>
                <input
                  type="text"
                  className="input"
                  value={shopForm.shopName}
                  onChange={(e) => setShopForm({ ...shopForm, shopName: e.target.value })}
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">This will change the brand name shown on the customer menu and admin panel.</p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Shop Tagline</label>
                <input
                  type="text"
                  className="input"
                  value={shopForm.shopTagline}
                  onChange={(e) => setShopForm({ ...shopForm, shopTagline: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Currency Prefix</label>
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
                <button type="submit" className="btn-primary flex items-center gap-2 ml-auto !bg-indigo-600 hover:!bg-indigo-700 focus:!ring-indigo-500" disabled={savingShop}>
                  <Save className="w-4 h-4" />
                  {savingShop ? "Saving..." : "Save Shop Config"}
                </button>
              </div>
            </form>
          </div>
          
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* SUPPORT SECTION */}
          <div className="card p-6 bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-300">
            <h2 className="text-xl font-black text-slate-900 mb-2">Need Help?</h2>
            <p className="text-sm text-slate-600 mb-6">
              Our support team is available 24/7. Contact us via WhatsApp or Direct Call for any software assistance, feature requests, or troubleshooting.
            </p>

            <div className="space-y-4">
              <a
                href="https://wa.me/97430954643"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-3 w-full rounded-2xl bg-[#25D366] text-white py-4 font-bold hover:brightness-110 active:scale-95 transition shadow-lg shadow-[#25D366]/20"
              >
                <MessageCircle className="w-6 h-6" />
                <span>Chat on WhatsApp (+974 30954643)</span>
              </a>

              <a
                href="tel:+97430954643"
                className="flex items-center justify-center gap-3 w-full rounded-2xl bg-slate-900 text-white py-4 font-bold hover:bg-slate-800 active:scale-95 transition shadow-lg shadow-slate-900/20"
              >
                <Phone className="w-6 h-6" />
                <span>Call Support (+974 30954643)</span>
              </a>
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">System Information</p>
              <p className="text-xs text-slate-500 mt-1">Version 1.0.0 • Licensed to {shopName}</p>
            </div>
          </div>
        </div>

      </div>

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
