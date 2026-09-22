import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, money } from "../../api.js";
import { useCart } from "../../store/cart.js";
import { Spinner, Empty } from "../../components/ui.jsx";
import { BRAND } from "../../config.js";

export default function Menu() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const cart = useCart();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState(null);
  const [err, setErr] = useState("");

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);

  // Category filter state ('ALL' or category id)
  const [activeCatId, setActiveCatId] = useState("ALL");

  useEffect(() => {
    (async () => {
      try {
        if (qrToken) {
          const { data } = await api.get(`/tables/resolve/${qrToken}`);
          setTable(data.table);
          sessionStorage.setItem("ev_table", JSON.stringify({ token: qrToken, no: data.table.tableNo }));
        } else {
          sessionStorage.removeItem("ev_table");
        }
        const { data } = await api.get("/menu");
        setCategories(data.categories || []);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [qrToken]);

  // Focus search input when search opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Filtered categories and items based on search and category tab
  const displayedCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return categories
      .map((cat) => {
        // Filter by category selection
        if (activeCatId !== "ALL" && String(cat.id) !== String(activeCatId)) {
          return null;
        }

        // Filter items in this category
        const filteredItems = (cat.items || []).filter((item) => {
          if (!q) return true;
          const matchName = item.name.toLowerCase().includes(q);
          const matchDesc = (item.description || "").toLowerCase().includes(q);
          const matchCat = cat.name.toLowerCase().includes(q);
          return matchName || matchDesc || matchCat;
        });

        if (filteredItems.length === 0) return null;

        return {
          ...cat,
          items: filteredItems,
        };
      })
      .filter(Boolean);
  }, [categories, searchQuery, activeCatId]);

  // Total count of matching items
  const totalFound = useMemo(() => {
    return displayedCategories.reduce((acc, c) => acc + c.items.length, 0);
  }, [displayedCategories]);

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-cream pb-28 text-slate-900 shadow-xl relative">
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER WITH BRAND, SEARCH ICON & MY ORDERS                 */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-30 bg-ink px-4 py-3.5 text-white shadow-soft transition-all">
        <div className="flex items-center justify-between gap-2">
          {/* Brand & Table */}
          <div className="min-w-0">
            <Link to="/" className="display text-lg font-bold tracking-wide text-white truncate block">
              {BRAND.name}
            </Link>
            {table ? (
              <p className="text-[11px] text-gold font-medium flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
                <span>Dine-in · Table {table.tableNo}</span>
              </p>
            ) : (
              <p className="text-[11px] text-white/60">Takeaway / Delivery Menu</p>
            )}
          </div>

          {/* Header Action Icons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* MAIN SEARCH ICON BUTTON */}
            <button
              onClick={() => {
                setSearchOpen(!searchOpen);
                if (searchOpen) setSearchQuery("");
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                searchOpen || searchQuery
                  ? "bg-brand text-white shadow-md shadow-brand/30"
                  : "bg-white/10 text-white/90 hover:bg-white/20 active:scale-95"
              }`}
              title="Search Menu Items"
              aria-label="Search Menu Items"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* My Orders Link */}
            <Link
              to="/history"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/20 transition active:scale-95"
            >
              Orders
            </Link>
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* EXPANDABLE LIVE SEARCH BAR                                  */}
        {/* ----------------------------------------------------------- */}
        {searchOpen && (
          <div className="mt-3 pt-2 border-t border-white/10 animate-fade-up">
            <div className="relative flex items-center">
              <span className="absolute left-3 text-white/50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search food, drinks, biryani, curry..."
                className="w-full rounded-xl bg-white/15 pl-9 pr-8 py-2 text-sm text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-brand focus:bg-white/25 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 text-xs font-bold text-white/60 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/70 px-1">
                <span>
                  Found <strong className="text-gold">{totalFound}</strong> item(s) for "{searchQuery}"
                </span>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchOpen(false);
                  }}
                  className="text-white/60 hover:text-white underline"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. STICKY CATEGORY NAVIGATION RAIL (Customer View)            */}
      {/* ------------------------------------------------------------- */}
      <nav className="sticky top-[58px] z-20 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur-md border-b border-gray-200/80">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* "All" Category Pill */}
          <button
            onClick={() => setActiveCatId("ALL")}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all shadow-sm ${
              activeCatId === "ALL"
                ? "bg-brand text-white shadow-brand/20 scale-105"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All Dishes
          </button>

          {/* Dynamic Categories */}
          {categories.map((cat) => {
            const isSelected = String(cat.id) === String(activeCatId);
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCatId(String(cat.id))}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm ${
                  isSelected
                    ? "bg-brand text-white shadow-brand/20 scale-105"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                    isSelected ? "bg-white/25 text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {cat.items?.length || 0}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Error notification if any */}
      {err && <p className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-600 font-medium">{err}</p>}

      {/* ------------------------------------------------------------- */}
      {/* 3. MENU ITEMS LISTING (Grouped or Search Results)             */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-6 px-4 py-4">
        {displayedCategories.length === 0 && (
          <div className="py-12 text-center rounded-2xl bg-white/70 border border-dashed border-gray-300 p-6 m-2">
            <span className="text-4xl">🔍</span>
            <p className="mt-3 text-base font-bold text-gray-800">No dishes found</p>
            <p className="mt-1 text-xs text-gray-500">
              {searchQuery
                ? `No items matching "${searchQuery}". Try a different keyword.`
                : "No items available in this category right now."}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="btn-outline btn-sm mt-4 !rounded-full"
              >
                Clear Search
              </button>
            )}
          </div>
        )}

        {displayedCategories.map((cat) => (
          <section key={cat.id} className="scroll-mt-32">
            {/* Category Title Header */}
            <div className="mb-3 flex items-center justify-between border-b border-gray-200/70 pb-1.5">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand" />
                <span>{cat.name}</span>
              </h2>
              <span className="text-[11px] font-semibold text-gray-400">
                {cat.items.length} {cat.items.length === 1 ? "dish" : "dishes"}
              </span>
            </div>

            {/* Responsive Grid Cards for Customer */}
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
              {cat.items.map((item) => {
                const inCart = cart.items.find((i) => i.menuItemId === item.id);
                return (
                  <div
                    key={item.id}
                    className="card flex flex-col overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    {/* Item Image with Fallback */}
                    <div className="relative h-28 w-full bg-slate-900 overflow-hidden">
                      {item.photoUrl ? (
                        <img
                          src={item.photoUrl}
                          alt={item.name}
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className={`h-full w-full items-center justify-center bg-gradient-to-br from-ink to-ink-soft text-white ${
                          item.photoUrl ? "hidden" : "flex"
                        }`}
                      >
                        <span className="text-3xl opacity-80">🍲</span>
                      </div>

                      {/* Price Tag Overlay */}
                      <span className="absolute bottom-2 right-2 rounded-lg bg-white/95 px-2 py-0.5 text-xs font-black text-brand shadow-sm">
                        {money(item.price)}
                      </span>
                    </div>

                    {/* Item Details */}
                    <div className="flex flex-1 flex-col p-2.5 justify-between">
                      <div>
                        <p className="line-clamp-1 text-sm font-bold leading-snug text-slate-900">
                          {item.name}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-500 min-h-[30px]">
                          {item.description || "Prepared fresh with rich authentic flavors."}
                        </p>
                      </div>

                      {/* Cart + / - or Add Button */}
                      <div className="mt-3">
                        {inCart ? (
                          <div className="flex items-center justify-between rounded-xl bg-gray-100 p-1">
                            <button
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-sm font-bold text-gray-800 shadow-sm active:scale-95 transition"
                              onClick={() => cart.setQty(item.id, inCart.qty - 1)}
                            >
                              −
                            </button>
                            <span className="text-xs font-extrabold text-slate-900">{inCart.qty}</span>
                            <button
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white shadow-sm active:scale-95 transition"
                              onClick={() => cart.setQty(item.id, inCart.qty + 1)}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn-primary btn-sm w-full !py-1.5 !rounded-xl !text-xs font-bold"
                            onClick={() => cart.add(item)}
                          >
                            Add +
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. FLOATING VIEW CART BAR (When Items in Cart)                */}
      {/* ------------------------------------------------------------- */}
      {cart.count() > 0 && (
        <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 border-t border-gray-200 bg-white/95 p-3.5 backdrop-blur-md shadow-2xl">
          <button
            className="btn-primary w-full !py-3 !rounded-2xl flex items-center justify-between px-5 font-bold shadow-lg shadow-brand/30 text-sm"
            onClick={() => navigate("/checkout")}
          >
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-brand text-xs font-black">
                {cart.count()}
              </span>
              <span>View Order Cart</span>
            </span>
            <span>{money(cart.subtotal())} →</span>
          </button>
        </div>
      )}
    </div>
  );
}
