import React, { useEffect, useState, useMemo, useRef } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api, money } from "../../api.js";
import { useCart } from "../../store/cart.js";
import { useSettings } from "../../store/settings.js";
import { BRAND } from "../../config.js";
import { Spinner } from "../../components/ui.jsx";
import AssistanceDongle from "../../components/customer/AssistanceDongle.jsx";
import { ShoppingBag, Search, Clock, Utensils, X, ArrowRight } from "lucide-react";

export default function Menu() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const { shopName, shopTagline, shopLogo } = useSettings();

  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState(null);
  const [err, setErr] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();
  const modeParam = searchParams.get("mode");

  useEffect(() => {
    if (modeParam === "delivery") {
      sessionStorage.setItem("ev_order_mode", "DELIVERY");
      sessionStorage.removeItem("ev_table");
      setTable(null);
      
      // Clean up the URL optionally
      setSearchParams({}, { replace: true });
    }
  }, [modeParam, setSearchParams]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  // Active Category filter ("ALL" or specific category ID)
  const [activeCatId, setActiveCatId] = useState("ALL");

  useEffect(() => {
    async function load() {
      try {
        // 1. Resolve table if accessed via QR URL /t/:qrToken
        if (qrToken) {
          try {
            const { data } = await api.get(`/tables/resolve/${qrToken}`);
            if (data?.table) {
              setTable(data.table);
              sessionStorage.setItem(
                "ev_table",
                JSON.stringify({ no: data.table.tableNo, token: qrToken })
              );
            }
          } catch (tErr) {
            console.error("Could not resolve table from QR:", tErr);
          }
        } else {
          // 2. Check if table was previously scanned & stored in session
          try {
            const saved = sessionStorage.getItem("ev_table");
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed?.no) {
                setTable({ tableNo: parsed.no, token: parsed.token || null });
              }
            }
          } catch (_) {}
        }

        // 3. Load menu items and banners
        const [menuRes, bannerRes] = await Promise.all([
          api.get("/menu"),
          api.get("/banners").catch(() => ({ data: [] })),
        ]);
        setCategories(menuRes.data.categories || []);
        setBanners(Array.isArray(bannerRes.data) ? bannerRes.data : []);
      } catch (e) {
        setErr(e.message || "Failed to load menu");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [qrToken]);

  // Focus search input when opened on mobile
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Filter items by search query AND active category
  const displayedCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return categories
      .map((cat) => {
        // If category is filtered out by tab, return null items
        if (activeCatId !== "ALL" && String(cat.id) !== String(activeCatId)) {
          return null;
        }

        // Filter items inside this category
        const filteredItems = cat.items.filter((item) => {
          if (!item.available) return false;
          if (!q) return true;
          return (
            item.name.toLowerCase().includes(q) ||
            (item.description && item.description.toLowerCase().includes(q))
          );
        });

        if (filteredItems.length === 0) return null;

        return {
          ...cat,
          items: filteredItems,
        };
      })
      .filter(Boolean);
  }, [categories, searchQuery, activeCatId]);

  const totalFound = useMemo(() => {
    return displayedCategories.reduce((acc, c) => acc + c.items.length, 0);
  }, [displayedCategories]);

  if (loading) return <Spinner />;

  const logoSrc = shopLogo || BRAND.logo || "/logo.svg";

  return (
    <div className="min-h-screen bg-stone-50/70 pb-32 text-slate-900 relative font-sans">
      {/* ------------------------------------------------------------- */}
      {/* 1. FULL-WIDTH RESPONSIVE HEADER                               */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-30 bg-[#120f12] text-white shadow-soft transition-all border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex items-center justify-between gap-3 sm:gap-6">
            {/* Brand & Table info */}
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/" className="shrink-0" title="Home">
                <img
                  src={logoSrc}
                  alt={shopName}
                  className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl object-contain bg-white/10 p-1 border border-white/20 shadow-inner transition hover:scale-105"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/logo.svg";
                  }}
                />
              </Link>
              <div className="min-w-0">
                <Link
                  to="/"
                  className="text-base sm:text-xl font-extrabold tracking-tight text-white truncate block hover:text-brand-light transition"
                >
                  {shopName}
                </Link>
                {table ? (
                  <p className="text-[11px] sm:text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Dine-in · Table {table.tableNo}</span>
                  </p>
                ) : (
                  <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                    {shopTagline || "Takeaway & Delivery Menu"}
                  </p>
                )}
              </div>
            </div>

            {/* Desktop Center Search Input */}
            <div className="hidden md:flex flex-1 max-w-md mx-4 relative items-center">
              <span className="absolute left-3.5 text-white/40">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search food, drinks, biryani, specials..."
                className="w-full rounded-full bg-white/10 border border-white/15 pl-10 pr-9 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-brand focus:border-brand focus:bg-white/15 transition shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 text-xs font-bold text-white/50 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Header Actions (Right) */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Mobile Search Toggle Button */}
              <button
                onClick={() => {
                  setSearchOpen(!searchOpen);
                  if (searchOpen) setSearchQuery("");
                }}
                className={`md:hidden flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                  searchOpen || searchQuery
                    ? "bg-brand text-white shadow-md shadow-brand/30"
                    : "bg-white/10 text-white/90 hover:bg-white/20 active:scale-95"
                }`}
                title="Search Menu Items"
                aria-label="Search Menu Items"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* My Orders Link */}
              <Link
                to="/history"
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/20 transition active:scale-95 border border-white/10"
              >
                <Clock className="w-3.5 h-3.5 text-slate-300" />
                <span>Orders</span>
              </Link>

              {/* Desktop Quick Cart Indicator */}
              {cart.count() > 0 && (
                <button
                  onClick={() => navigate("/checkout")}
                  className="hidden sm:inline-flex items-center gap-2 rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-brand/30 hover:bg-brand-dark transition active:scale-95"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Cart ({cart.count()})</span>
                  <span className="opacity-80">·</span>
                  <span>{money(cart.subtotal())}</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Expandable Live Search Bar */}
          {searchOpen && (
            <div className="md:hidden mt-3 pt-2.5 border-t border-white/10 animate-fade-up">
              <div className="relative flex items-center">
                <span className="absolute left-3 text-white/40">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search dishes, drinks, biryani..."
                  className="w-full rounded-xl bg-white/15 pl-9 pr-8 py-2 text-sm text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-brand focus:bg-white/20 transition"
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
            </div>
          )}

          {/* Active Search Results Indicator */}
          {searchQuery && (
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-300 px-1">
              <span>
                Found <strong className="text-amber-300">{totalFound}</strong> item(s) for "{searchQuery}"
              </span>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchOpen(false);
                }}
                className="text-amber-300/80 hover:text-amber-300 underline font-medium"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. OFFERS BANNER (Full-width Responsive Rail)                  */}
      {/* ------------------------------------------------------------- */}
      {banners.length > 0 && (
        <div className="bg-white py-4 border-b border-gray-200/70 shadow-xs">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory py-1">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className="shrink-0 snap-center w-[85%] sm:w-[340px] md:w-[380px] cursor-pointer group"
                  onClick={() => setSelectedBanner(b)}
                >
                  <div className="relative h-36 sm:h-44 md:h-48 w-full rounded-2xl overflow-hidden shadow-md group-hover:shadow-lg transition-all duration-300">
                    <img
                      loading="lazy"
                      src={b.photoUrl}
                      alt={b.title || "Offer"}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute bottom-3.5 left-4 text-white">
                      {b.subtitle && (
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-300 drop-shadow-md">
                          {b.subtitle}
                        </p>
                      )}
                      {b.title && <p className="text-base sm:text-lg font-extrabold drop-shadow-md">{b.title}</p>}
                    </div>
                    {b.menuItem && (
                      <div className="absolute top-3.5 right-3.5 bg-white/95 backdrop-blur-sm text-brand px-3 py-1 rounded-full text-[11px] font-black shadow-md flex items-center gap-1">
                        <span>ORDER NOW</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. STICKY CATEGORY NAVIGATION RAIL (Full-width Container)      */}
      {/* ------------------------------------------------------------- */}
      <nav className="sticky top-[61px] sm:top-[69px] z-20 bg-white/95 backdrop-blur-md border-b border-gray-200/80 shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar">
            {/* "All Dishes" Pill */}
            <button
              onClick={() => setActiveCatId("ALL")}
              className={`shrink-0 rounded-full px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold transition-all shadow-xs ${
                activeCatId === "ALL"
                  ? "bg-brand text-white shadow-brand/25 scale-[1.02]"
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
                  className={`shrink-0 flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold transition-all shadow-xs ${
                    isSelected
                      ? "bg-brand text-white shadow-brand/25 scale-[1.02]"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      isSelected ? "bg-white/25 text-white" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {cat.items?.length || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Error notification if any */}
      {err && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600 font-medium border border-red-200">{err}</p>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. MAIN MENU ITEMS GRID (Fully Responsive Multi-Column Layout) */}
      {/* ------------------------------------------------------------- */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {displayedCategories.length === 0 && (
          <div className="py-16 text-center rounded-3xl bg-white border border-dashed border-gray-300 p-8 shadow-xs">
            <span className="text-5xl block mb-2">🔍</span>
            <h3 className="text-lg font-bold text-gray-800">No dishes found</h3>
            <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
              {searchQuery
                ? `No dishes matching "${searchQuery}". Please try another keyword or category.`
                : "No dishes are available in this category right now."}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="btn-outline btn-sm mt-5 !rounded-full !px-5"
              >
                Clear Search
              </button>
            )}
          </div>
        )}

        {displayedCategories.map((cat) => (
          <section key={cat.id} className="scroll-mt-36">
            {/* Category Title Header */}
            <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-2">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-900 flex items-center gap-2.5">
                <span className="h-3 w-1.5 rounded-full bg-brand" />
                <span>{cat.name}</span>
              </h2>
              <span className="text-xs font-semibold text-gray-400">
                {cat.items.length} {cat.items.length === 1 ? "dish" : "dishes"}
              </span>
            </div>

            {/* Responsive Grid: 2 cols on mobile, 3 on tablet, 4 on desktop, 5-6 on wide screens */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5 sm:gap-5">
              {cat.items.map((item) => {
                const inCart = cart.items.find((i) => i.menuItemId === item.id);
                return (
                  <div
                    key={item.id}
                    className="card group flex flex-col overflow-hidden bg-white border border-gray-100/90 shadow-xs hover:shadow-md hover:border-gray-200 transition-all duration-200 rounded-2xl"
                  >
                    {/* Item Image with Fallback */}
                    <div className="relative h-32 sm:h-36 lg:h-40 w-full bg-slate-900 overflow-hidden">
                      {item.photoUrl ? (
                        <img
                          loading="lazy"
                          src={item.photoUrl}
                          alt={item.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className={`h-full w-full items-center justify-center bg-gradient-to-br from-stone-900 to-neutral-900 text-white ${
                          item.photoUrl ? "hidden" : "flex"
                        }`}
                      >
                        <Utensils className="w-8 h-8 text-white/40" />
                      </div>

                      {/* Price Tag Overlay */}
                      <span className="absolute bottom-2.5 right-2.5 rounded-xl bg-white/95 backdrop-blur-sm px-2.5 py-1 text-xs font-black text-brand shadow-sm border border-black/5">
                        {money(item.price)}
                      </span>
                    </div>

                    {/* Item Details */}
                    <div className="flex flex-1 flex-col p-3 sm:p-3.5 justify-between">
                      <div>
                        <h4 className="line-clamp-1 text-sm sm:text-base font-bold text-slate-900 group-hover:text-brand transition-colors">
                          {item.name}
                        </h4>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500 min-h-[32px] leading-relaxed">
                          {item.description || "Prepared fresh with rich authentic spices and herbs."}
                        </p>
                      </div>

                      {/* Cart + / - or Add Button */}
                      <div className="mt-3.5 pt-2 border-t border-gray-50">
                        {inCart ? (
                          <div className="flex items-center justify-between rounded-xl bg-gray-100 p-1">
                            <button
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-sm font-bold text-gray-800 shadow-sm active:scale-95 transition hover:bg-gray-50"
                              onClick={() => cart.setQty(item.id, inCart.qty - 1)}
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="text-xs font-black text-slate-900">{inCart.qty}</span>
                            <button
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white shadow-sm active:scale-95 transition hover:bg-brand-dark"
                              onClick={() => cart.setQty(item.id, inCart.qty + 1)}
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn-primary btn-sm w-full !py-2 !rounded-xl !text-xs font-bold shadow-xs hover:shadow-md transition active:scale-95"
                            onClick={() => cart.add(item)}
                          >
                            Add to Cart +
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
      </main>

      {/* ------------------------------------------------------------- */}
      {/* 5. RESPONSIVE FLOATING CART DOCK (Mobile & Desktop Full-screen) */}
      {/* ------------------------------------------------------------- */}
      {cart.count() > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 bg-white/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-t border-gray-200/80 sm:border-0">
          <div className="mx-auto max-w-2xl bg-[#120f12] text-white p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10 flex items-center justify-between gap-4 animate-fade-up">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-brand text-white font-black text-sm sm:text-base shrink-0 shadow-md shadow-brand/30">
                {cart.count()}
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                  Your Order Cart
                </p>
                <p className="text-xs text-amber-300 font-bold">
                  Total: {money(cart.subtotal())}
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate("/checkout")}
              className="inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-gradient-to-r from-brand to-rose-600 px-5 sm:px-7 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-brand/30 hover:brightness-110 active:scale-95 transition whitespace-nowrap"
            >
              <span>View Cart &amp; Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. BANNER MODAL DIALOG                                        */}
      {/* ------------------------------------------------------------- */}
      {selectedBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm sm:max-w-md rounded-3xl bg-white overflow-hidden shadow-2xl animate-fade-up">
            <div className="relative h-52 sm:h-60 w-full bg-slate-100">
              <img
                loading="lazy"
                src={selectedBanner.photoUrl}
                alt="Offer"
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => setSelectedBanner(null)}
                className="absolute top-3.5 right-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 text-center">
              {selectedBanner.subtitle && (
                <p className="text-xs font-bold uppercase tracking-wider text-brand mb-1">
                  {selectedBanner.subtitle}
                </p>
              )}
              {selectedBanner.title && (
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">
                  {selectedBanner.title}
                </h3>
              )}

              {selectedBanner.menuItem ? (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="font-bold text-slate-800 mb-1">{selectedBanner.menuItem.name}</p>
                  <p className="text-xs text-slate-500 mb-5 px-2">
                    {selectedBanner.menuItem.description || "Enjoy our chef's special promotion today!"}
                  </p>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xl font-black text-brand">
                      {money(selectedBanner.menuItem.price)}
                    </span>
                    <button
                      className="btn-primary flex-1 !rounded-2xl font-bold shadow-md shadow-brand/20 !py-3"
                      onClick={() => {
                        cart.add(selectedBanner.menuItem);
                        setSelectedBanner(null);
                      }}
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-slate-500 mb-5">
                    Visit us today to enjoy this special promotion!
                  </p>
                  <button
                    className="btn-outline w-full !rounded-2xl font-bold !py-2.5"
                    onClick={() => setSelectedBanner(null)}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Waiter Assistance Dongle */}
      <AssistanceDongle initialTableNo={table?.tableNo} />
    </div>
  );
}
