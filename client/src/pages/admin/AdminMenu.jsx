import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api, money } from "../../api.js";
import { Spinner, Toast } from "../../components/ui.jsx";
import BannersManager from "../../components/admin/BannersManager.jsx";

// Predefined quick image presets for fast food item creation
const FOOD_PRESETS = [
  { label: "Biryani", url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=70" },
  { label: "Fried Chicken", url: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=500&auto=format&fit=crop&q=70" },
  { label: "Curry", url: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&auto=format&fit=crop&q=70" },
  { label: "Rolls / Wrap", url: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=70" },
  { label: "Fried Rice", url: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop&q=70" },
  { label: "Burger", url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=70" },
  { label: "Juice / Lime", url: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=70" },
  { label: "Hot Beverage", url: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=500&auto=format&fit=crop&q=70" },
];

export default function AdminMenu() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Views: 'card' (Card Model) or 'table' (Table Row Model)
  const [viewModel, setViewModel] = useState(() => {
    return localStorage.getItem("zafran_menu_view_model") || "card";
  });

  // Admin Tab: ITEMS | BANNERS
  const [activeAdminTab, setActiveAdminTab] = useState("ITEMS");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL"); // ALL | IN_STOCK | OUT_OF_STOCK

  // Modals
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [itemForm, setItemForm] = useState(null); // { categoryId, name, description, price, photoUrl, available }
  const [savingItem, setSavingItem] = useState(false);

  // Save view model preference
  const handleViewChange = (model) => {
    setViewModel(model);
    localStorage.setItem("zafran_menu_view_model", model);
  };

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/menu/admin/categories");
      setCategories(data.categories || []);
    } catch (e) {
      setToast(e.message || "Failed to load menu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Flattened items with category reference for filtering
  const allItems = useMemo(() => {
    const list = [];
    categories.forEach((cat) => {
      (cat.items || []).forEach((item) => {
        list.push({ ...item, categoryName: cat.name, categoryActive: cat.active });
      });
    });
    return list;
  }, [categories]);

  // Filtered items based on search, category pill, and stock status
  const filteredItems = useMemo(() => {
    return allItems.filter((it) => {
      // Category filter
      if (selectedCategory !== "ALL" && String(it.categoryId) !== String(selectedCategory)) {
        return false;
      }
      // Stock filter
      if (stockFilter === "IN_STOCK" && !it.available) return false;
      if (stockFilter === "OUT_OF_STOCK" && it.available) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = it.name.toLowerCase().includes(q);
        const matchDesc = (it.description || "").toLowerCase().includes(q);
        const matchCat = (it.categoryName || "").toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCat) return false;
      }
      return true;
    });
  }, [allItems, selectedCategory, stockFilter, searchQuery]);

  // Add category
  const addCategory = async (e) => {
    e?.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.post("/menu/admin/categories", { name: newCatName.trim() });
      setNewCatName("");
      setShowCategoryModal(false);
      setToast("Category added successfully");
      load();
    } catch (err) {
      setToast(err.message || "Failed to add category");
    }
  };

  // Toggle category visibility
  const toggleCategory = async (c) => {
    try {
      await api.put(`/menu/admin/categories/${c.id}`, { active: !c.active });
      load();
    } catch (err) {
      setToast(err.message || "Failed to toggle category");
    }
  };

  // Delete category
  const deleteCategory = async (c) => {
    if (!confirm(`Delete category "${c.name}" and all its ${c.items?.length || 0} item(s)?`)) return;
    try {
      await api.delete(`/menu/admin/categories/${c.id}`);
      setToast("Category deleted");
      load();
    } catch (err) {
      setToast(err.message || "Failed to delete category");
    }
  };

  // Save Item (Create or Update)
  const saveItem = async (e) => {
    e?.preventDefault();
    const f = itemForm;
    if (!f.name?.trim()) return setToast("Item name is required");
    if (f.price === "" || isNaN(Number(f.price))) return setToast("Valid price is required");
    if (!f.categoryId) return setToast("Please select a category");

    setSavingItem(true);
    try {
      const payload = {
        categoryId: Number(f.categoryId),
        name: f.name.trim(),
        description: f.description?.trim() || "",
        price: Number(f.price),
        photoUrl: f.photoUrl?.trim() || null,
        available: f.available !== false,
      };

      if (f.id) {
        await api.put(`/menu/admin/items/${f.id}`, payload);
        setToast("Item updated successfully");
      } else {
        await api.post("/menu/admin/items", payload);
        setToast("New item created successfully");
      }
      setItemForm(null);
      load();
    } catch (err) {
      setToast(err.message || "Failed to save item");
    } finally {
      setSavingItem(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    setToast("Uploading image...");
    try {
      const { data } = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setItemForm({ ...itemForm, photoUrl: data.url });
      setToast("Image uploaded successfully");
    } catch (err) {
      setToast(err.response?.data?.error || err.message || "Failed to upload image");
    }
  };

  // Toggle Item Availability
  const toggleItem = async (it) => {
    try {
      await api.put(`/menu/admin/items/${it.id}`, { available: !it.available });
      load();
    } catch (err) {
      setToast(err.message || "Failed to update item status");
    }
  };

  // Delete Item
  const deleteItem = async (it) => {
    if (!confirm(`Are you sure you want to delete "${it.name}"?`)) return;
    try {
      await api.delete(`/menu/admin/items/${it.id}`);
      setToast("Item deleted");
      load();
    } catch (err) {
      setToast(err.message || "Failed to delete item");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* HEADER: Title & Quick Metrics & Primary Actions               */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Menu & Offers</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage your dishes, photos, categories, and promotional banners.
          </p>
        </div>

        {activeAdminTab === "ITEMS" && (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Add Category Button */}
            <button
              onClick={() => setShowCategoryModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition active:scale-95"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Category</span>
            </button>

            {/* Add New Item Button */}
            <button
              onClick={() =>
                setItemForm({
                  categoryId: categories[0]?.id || "",
                  name: "",
                  description: "",
                  price: "",
                  photoUrl: "",
                  available: true,
                })
              }
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-md shadow-brand/20 hover:brightness-105 active:scale-95 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Menu Item</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200">
        <button
          onClick={() => setActiveAdminTab("ITEMS")}
          className={`pb-3 text-sm font-bold transition-colors relative ${
            activeAdminTab === "ITEMS" ? "text-brand" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Menu Items
          {activeAdminTab === "ITEMS" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveAdminTab("BANNERS")}
          className={`pb-3 text-sm font-bold transition-colors relative ${
            activeAdminTab === "BANNERS" ? "text-brand" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Banners & Offers
          {activeAdminTab === "BANNERS" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand rounded-t-full" />}
        </button>
      </div>

      {activeAdminTab === "BANNERS" ? (
        <BannersManager allMenuItems={allItems} />
      ) : (
        <>
          {/* ------------------------------------------------------------- */}
          {/* CONTROLS: Search, Filters & View Mode (Card vs Table Row)     */}
          {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              placeholder="Search by dish name, ingredient, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Stock Filter Dropdown */}
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition cursor-pointer"
            >
              <option value="ALL">All Stock Status</option>
              <option value="IN_STOCK">🟢 In Stock Only</option>
              <option value="OUT_OF_STOCK">🔴 Out of Stock</option>
            </select>

            {/* VIEW TOGGLE: CARD MODEL vs TABLE ROW MODEL */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-inner">
              <button
                type="button"
                onClick={() => handleViewChange("card")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition ${
                  viewModel === "card"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Card Grid Model"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
                <span>Card Model</span>
              </button>

              <button
                type="button"
                onClick={() => handleViewChange("table")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition ${
                  viewModel === "table"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Table Row Model"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                <span>Table Row Model</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Horizontal Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 border-t border-slate-100">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition ${
              selectedCategory === "ALL"
                ? "bg-brand text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Items ({allItems.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(String(cat.id))}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition ${
                selectedCategory === String(cat.id)
                  ? "bg-brand text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{cat.name}</span>
              <span className={`text-[10px] px-1 rounded ${selectedCategory === String(cat.id) ? "bg-white/30 text-white" : "bg-slate-200 text-slate-600"}`}>
                {cat.items?.length || 0}
              </span>
              {!cat.active && <span className="text-[10px] text-amber-500 font-normal">(Hidden)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. CARD MODEL (Responsive Grid Cards with Photos)             */}
      {/* ------------------------------------------------------------- */}
      {viewModel === "card" && (
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <span className="text-4xl">🍲</span>
              <h3 className="mt-3 text-base font-bold text-slate-800">No dishes match your filter</h3>
              <p className="mt-1 text-xs text-slate-500">Try changing your search query or category selection.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all duration-200 ${
                    item.available ? "border-slate-200/80" : "border-rose-200 bg-rose-50/10"
                  }`}
                >
                  {/* Item Image with Fallback & Badges */}
                  <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                    {item.photoUrl ? (
                      <img
                        src={item.photoUrl}
                        alt={item.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className={`h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white ${
                        item.photoUrl ? "hidden" : "flex"
                      }`}
                    >
                      <span className="text-4xl opacity-80">🥘</span>
                      <span className="text-[11px] text-slate-400 mt-1 font-medium">Zafran Kitchen</span>
                    </div>

                    {/* Stock Status Badge */}
                    <div className="absolute top-2.5 left-2.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-md shadow-sm ${
                          item.available
                            ? "bg-emerald-500/90 text-white"
                            : "bg-rose-500/90 text-white"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        {item.available ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>

                    {/* Category Label Overlay */}
                    <div className="absolute top-2.5 right-2.5">
                      <span className="rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-md">
                        {item.categoryName}
                      </span>
                    </div>

                    {/* Price Pill */}
                    <div className="absolute bottom-2.5 right-2.5">
                      <span className="rounded-lg bg-white/95 px-2.5 py-1 text-xs font-extrabold text-brand shadow-md">
                        {money(item.price)}
                      </span>
                    </div>
                  </div>

                  {/* Item Content */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1 group-hover:text-brand transition-colors">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                        {item.description || "Freshly cooked to order with premium spices and ingredients."}
                      </p>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {/* Stock Switch Toggle */}
                      <button
                        onClick={() => toggleItem(item)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition ${
                          item.available
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        }`}
                        title="Click to toggle stock status"
                      >
                        <span className={`h-2 w-2 rounded-full ${item.available ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span>{item.available ? "Available" : "Disabled"}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {/* Edit Button */}
                        <button
                          onClick={() =>
                            setItemForm({
                              id: item.id,
                              categoryId: item.categoryId,
                              name: item.name,
                              description: item.description || "",
                              price: Number(item.price),
                              photoUrl: item.photoUrl || "",
                              available: item.available,
                            })
                          }
                          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                          title="Edit Dish & Image"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => deleteItem(item)}
                          className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                          title="Delete Dish"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. TABLE ROW MODEL (High-Density Data Row View with Image)    */}
      {/* ------------------------------------------------------------- */}
      {viewModel === "table" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Dish & Image</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Price</th>
                  <th className="py-3.5 px-4">Availability Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No menu items found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Image & Title Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3.5">
                          {/* Dish Image Thumbnail */}
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm">
                            {item.photoUrl ? (
                              <img
                                src={item.photoUrl}
                                alt={item.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  e.target.nextSibling.style.display = "flex";
                                }}
                              />
                            ) : null}
                            <div
                              className={`h-full w-full items-center justify-center bg-slate-900 text-lg text-white ${
                                item.photoUrl ? "hidden" : "flex"
                              }`}
                            >
                              🍲
                            </div>
                          </div>

                          {/* Name and Description */}
                          <div className="min-w-0 max-w-xs md:max-w-md">
                            <p className={`font-bold text-slate-900 truncate ${!item.available ? "text-slate-400" : ""}`}>
                              {item.name}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {item.description || "No description provided"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {item.categoryName}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 text-sm">
                          {money(item.price)}
                        </span>
                      </td>

                      {/* Stock Status Interactive Button */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleItem(item)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition ${
                            item.available
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                          }`}
                          title="Click to toggle stock status"
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${item.available ? "bg-emerald-500" : "bg-rose-500"}`} />
                          <span>{item.available ? "In Stock" : "Out of Stock"}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() =>
                              setItemForm({
                                id: item.id,
                                categoryId: item.categoryId,
                                name: item.name,
                                description: item.description || "",
                                price: Number(item.price),
                                photoUrl: item.photoUrl || "",
                                available: item.available,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
                          >
                            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => deleteItem(item)}
                            className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition"
                            title="Delete"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CATEGORY MANAGEMENT SECTION                                   */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-3">Categories Management</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/60">
              <div>
                <p className="font-bold text-sm text-slate-800">{cat.name}</p>
                <p className="text-xs text-slate-500">{cat.items?.length || 0} item(s)</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => toggleCategory(cat)}
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    cat.active ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {cat.active ? "Hide" : "Unhide"}
                </button>
                <button
                  onClick={() => deleteCategory(cat)}
                  className="p-1 text-rose-500 hover:text-rose-700 text-xs font-semibold"
                  title="Delete category"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ITEM FORM (CREATE / EDIT WITH IMAGE & PREVIEWS)        */}
      {/* ------------------------------------------------------------- */}
      {itemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {itemForm.id ? "Edit Dish & Image" : "New Menu Item"}
              </h3>
              <button
                onClick={() => setItemForm(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveItem} className="mt-4 space-y-4">
              {/* Dish Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Chicken Biryani"
                  className="input"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                />
              </div>

              {/* Category & Price Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Category *
                  </label>
                  <select
                    className="input cursor-pointer"
                    value={itemForm.categoryId}
                    onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    className="input"
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe ingredients, spice level, or sides included..."
                  className="input resize-none"
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                />
              </div>

              {/* Dish Image URL & Live Preview */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Dish Image
                </label>
                
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      placeholder="https://... or upload local image"
                      className="input w-full"
                      value={itemForm.photoUrl || ""}
                      onChange={(e) => setItemForm({ ...itemForm, photoUrl: e.target.value })}
                    />
                  </div>
                  
                  <div className="relative overflow-hidden">
                    <button type="button" className="btn-outline shrink-0 !py-2 flex items-center gap-2 font-bold">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      onChange={handleImageUpload}
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 mb-1">Quick Food Photo Presets:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {FOOD_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setItemForm({ ...itemForm, photoUrl: p.url })}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 transition"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Preview Box */}
                {itemForm.photoUrl && (
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 p-2.5 bg-slate-50">
                    <img
                      src={itemForm.photoUrl}
                      alt="Preview"
                      className="h-14 w-14 rounded-lg object-cover border border-slate-200 shadow-sm"
                      onError={(e) => (e.target.style.display = "none")}
                    />
                    <div className="text-xs">
                      <p className="font-bold text-slate-700">Image Preview</p>
                      <p className="text-slate-400 text-[10px] truncate max-w-xs">{itemForm.photoUrl}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Availability Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="itemAvailable"
                  className="h-4 w-4 rounded text-brand focus:ring-brand cursor-pointer"
                  checked={itemForm.available}
                  onChange={(e) => setItemForm({ ...itemForm, available: e.target.checked })}
                />
                <label htmlFor="itemAvailable" className="text-sm font-semibold text-slate-700 cursor-pointer">
                  Available for customers (In Stock)
                </label>
              </div>

              {/* Form Buttons */}
              <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setItemForm(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="btn-primary"
                >
                  {savingItem ? "Saving..." : itemForm.id ? "Update Item" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADD CATEGORY                                           */}
      {/* ------------------------------------------------------------- */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fade-up">
            <h3 className="text-lg font-bold text-slate-900 mb-3">Add New Category</h3>
            <form onSubmit={addCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Desserts, Grills, Platters..."
                  className="input"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowCategoryModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
        </>
      )}
    </div>
  );
}
