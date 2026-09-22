import React, { useState, useEffect, useCallback } from "react";
import { api } from "../../api.js";
import { Spinner, Toast } from "../ui.jsx";

export default function BannersManager({ allMenuItems }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [bannerForm, setBannerForm] = useState(null); // { id, photoUrl, title, subtitle, menuItemId, active }
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/banners?admin=true");
      setBanners(data || []);
    } catch (e) {
      setToast(e.message || "Failed to load banners");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    setToast("Uploading banner image...");
    try {
      const { data } = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBannerForm({ ...bannerForm, photoUrl: data.url });
      setToast("Image uploaded successfully");
    } catch (err) {
      setToast(err.response?.data?.error || err.message || "Failed to upload image");
    }
  };

  const saveBanner = async (e) => {
    e.preventDefault();
    if (!bannerForm.photoUrl) return setToast("Banner image is required");

    setSaving(true);
    try {
      if (bannerForm.id) {
        await api.put(`/banners/${bannerForm.id}`, bannerForm);
        setToast("Banner updated successfully");
      } else {
        await api.post("/banners", bannerForm);
        setToast("New banner created successfully");
      }
      setBannerForm(null);
      load();
    } catch (err) {
      setToast(err.message || "Failed to save banner");
    } finally {
      setSaving(false);
    }
  };

  const toggleBanner = async (b) => {
    try {
      await api.put(`/banners/${b.id}`, { ...b, active: !b.active });
      load();
    } catch (err) {
      setToast(err.message || "Failed to toggle banner");
    }
  };

  const deleteBanner = async (b) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;
    try {
      await api.delete(`/banners/${b.id}`);
      setToast("Banner deleted");
      load();
    } catch (err) {
      setToast(err.message || "Failed to delete banner");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Promotional Banners</h2>
          <p className="text-sm text-slate-500">Manage sliding banners shown at the top of the customer menu.</p>
        </div>
        <button
          onClick={() => setBannerForm({ photoUrl: "", title: "", subtitle: "", menuItemId: "", active: true })}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <span>+ Add Banner</span>
        </button>
      </div>

      {banners.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-slate-50">
          <p className="text-slate-500">No banners found. Create one to highlight offers!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {banners.map((b) => (
            <div key={b.id} className="card overflow-hidden">
              <div className="relative h-40 w-full bg-slate-100">
                <img src={b.photoUrl} alt="Banner" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-3 text-white">
                  {b.subtitle && <p className="text-xs font-bold uppercase tracking-wider text-brand-light drop-shadow-md">{b.subtitle}</p>}
                  {b.title && <p className="text-sm font-extrabold drop-shadow-md">{b.title}</p>}
                </div>
                {!b.active && (
                  <div className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                    HIDDEN
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-slate-100 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">
                    {b.menuItem ? `Links to: ${b.menuItem.name}` : "No link"}
                  </span>
                  <button
                    onClick={() => toggleBanner(b)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${
                      b.active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {b.active ? "ACTIVE (HIDE)" : "HIDDEN (SHOW)"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setBannerForm(b)} className="btn-outline flex-1 !py-1.5 text-xs">Edit</button>
                  <button onClick={() => deleteBanner(b)} className="btn-outline text-rose-500 border-rose-200 hover:bg-rose-50 flex-1 !py-1.5 text-xs">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Banner Form Modal */}
      {bannerForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{bannerForm.id ? "Edit Banner" : "Create Banner"}</h3>
            <form onSubmit={saveBanner} className="space-y-4">
              
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Banner Image (16:9 Recommended) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="https://..."
                    className="input w-full"
                    value={bannerForm.photoUrl || ""}
                    onChange={(e) => setBannerForm({ ...bannerForm, photoUrl: e.target.value })}
                  />
                  <div className="relative overflow-hidden shrink-0">
                    <button type="button" className="btn-outline !py-2 px-3 font-bold">Upload</button>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={handleImageUpload} />
                  </div>
                </div>
                {bannerForm.photoUrl && (
                  <img src={bannerForm.photoUrl} alt="Preview" className="h-32 w-full object-cover rounded-xl border border-slate-200 shadow-sm mt-2" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Title</label>
                  <input type="text" className="input" placeholder="e.g. Up to 20% OFF" value={bannerForm.title || ""} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Subtitle</label>
                  <input type="text" className="input" placeholder="e.g. Weekend Special" value={bannerForm.subtitle || ""} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Link to Dish (Optional)</label>
                <select
                  className="input"
                  value={bannerForm.menuItemId || ""}
                  onChange={(e) => setBannerForm({ ...bannerForm, menuItemId: e.target.value })}
                >
                  <option value="">-- No link (Just an image) --</option>
                  {allMenuItems.map(m => (
                    <option key={m.id} value={m.id}>{m.name} - {m.categoryName}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">If selected, clicking the banner will open this dish so customers can add it to their cart.</p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="bannerActive"
                  className="h-4 w-4 rounded text-brand focus:ring-brand cursor-pointer"
                  checked={bannerForm.active}
                  onChange={(e) => setBannerForm({ ...bannerForm, active: e.target.checked })}
                />
                <label htmlFor="bannerActive" className="text-sm font-semibold text-slate-700 cursor-pointer">
                  Active (Show to customers)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" className="btn-outline" onClick={() => setBannerForm(null)}>Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save Banner"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
