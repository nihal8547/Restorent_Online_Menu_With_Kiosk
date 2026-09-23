import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Utensils,
  Smartphone,
  CheckCircle,
  QrCode,
  ChefHat,
  Clock,
  Sparkles,
  Star,
  ArrowRight,
  ShieldCheck,
  Flame,
  Award
} from "lucide-react";
import { api, money } from "../../api.js";
import { BRAND } from "../../config.js";
import { useSettings } from "../../store/settings.js";

export default function Landing() {
  const { shopName, shopTagline, shopLogo } = useSettings();
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [loadingMenu, setLoadingMenu] = useState(true);

  useEffect(() => {
    api
      .get("/menu")
      .then(({ data }) => {
        setCategories(data.categories || []);
        const items = (data.categories || []).flatMap((c) =>
          (c.items || []).map((i) => ({ ...i, categoryName: c.name, categoryId: c.id }))
        );
        setFeatured(items);
      })
      .catch(() => {})
      .finally(() => setLoadingMenu(false));
  }, []);

  const displayedItems =
    activeCategory === "ALL"
      ? featured.slice(0, 6)
      : featured.filter((i) => i.categoryId === activeCategory || i.categoryName === activeCategory).slice(0, 6);

  const logoSrc = shopLogo || BRAND.logo || "/logo.svg";

  return (
    <div className="min-h-screen bg-[#0d0b0d] text-slate-100 font-sans selection:bg-brand selection:text-white">
      {/* ------------------------------------------------------------- */}
      {/* 1. ULTRA-PREMIUM GLASSMORPHIC NAVBAR                          */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0d0b0d]/80 border-b border-white/10 transition-all duration-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          {/* Brand Logo & Name */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-brand to-amber-500 opacity-40 blur-sm group-hover:opacity-75 transition duration-300" />
              <img
                src={logoSrc}
                alt={shopName}
                className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-2xl object-contain bg-white/10 p-1.5 border border-white/20 shadow-md transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/logo.svg";
                }}
              />
            </div>
            <div>
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white font-sans block leading-none">
                {shopName}
              </span>
              <span className="text-[10px] tracking-widest uppercase font-semibold text-brand-light opacity-80 mt-1 block">
                {shopTagline || "Modern Kitchen"}
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#menu" className="hover:text-white hover:underline underline-offset-8 transition">
              Signature Menu
            </a>
            <a href="#experience" className="hover:text-white hover:underline underline-offset-8 transition">
              The Experience
            </a>
            <a href="#philosophy" className="hover:text-white hover:underline underline-offset-8 transition">
              Our Craft
            </a>
            <Link to="/history" className="hover:text-white hover:underline underline-offset-8 transition">
              Order History
            </Link>
          </nav>

          {/* Right Action */}
          <div className="flex items-center gap-3">
            <Link
              to="/menu"
              className="relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-rose-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all duration-300 hover:brightness-110 active:scale-95 hover:shadow-brand/40"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>Order Now</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. HERO SECTION: CINEMATIC LUXURY ATMOSPHERE                  */}
      {/* ------------------------------------------------------------- */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-32">
        {/* Ambient Glows */}
        <div
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-30 blur-[130px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(225,29,72,0.8) 0%, rgba(201,162,39,0.4) 60%, transparent 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute top-1/2 -right-40 w-[500px] h-[400px] opacity-20 blur-[120px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(201,162,39,0.8) 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            {/* VIP Brand Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-md px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-amber-300 shadow-xl shadow-black/40 mb-6 animate-fade-up">
              <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
              <span>Fine Dining &amp; Digital Table Kiosk</span>
            </div>

            {/* Main Brand Headline with Standard Typography */}
            <h1 className="font-extrabold tracking-tight text-white text-4xl sm:text-6xl lg:text-7xl leading-[1.1] animate-fade-up text-balance">
              Artisanal Flavors,{" "}
              <span className="bg-gradient-to-r from-amber-200 via-rose-100 to-amber-300 bg-clip-text text-transparent">
                Elevated Dining
              </span>
            </h1>

            {/* Subtext */}
            <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed animate-fade-up">
              Welcome to <strong className="text-white font-semibold">{shopName}</strong>. Scan your table QR or order online in seconds — fresh gourmet cuisine prepared with passion and served with effortless perfection.
            </p>

            {/* Dual CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto animate-fade-up">
              <Link
                to="/menu"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-brand px-8 py-4 text-base font-bold text-white shadow-xl shadow-brand/30 transition-all duration-300 hover:bg-brand-dark hover:scale-105 active:scale-95"
              >
                <Utensils className="w-5 h-5 text-white" />
                <span>Explore Full Menu</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/history"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-md px-7 py-4 text-base font-semibold text-slate-200 transition duration-300 hover:bg-white/10 hover:text-white"
              >
                <Clock className="w-5 h-5 text-slate-400" />
                <span>Track Active Order</span>
              </Link>
            </div>

            {/* Key Value Metric Badges */}
            <div className="mt-14 grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-4 w-full max-w-3xl pt-8 border-t border-white/10">
              <div className="flex flex-col items-center p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                <span className="text-2xl sm:text-3xl font-black text-amber-300">4.9 ★</span>
                <span className="text-xs text-slate-400 mt-0.5">Guest Satisfaction</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                <span className="text-2xl sm:text-3xl font-black text-white">0s</span>
                <span className="text-xs text-slate-400 mt-0.5">App Download Needed</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                <span className="text-2xl sm:text-3xl font-black text-brand-light">100%</span>
                <span className="text-xs text-slate-400 mt-0.5">Fresh Ingredients</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                <span className="text-2xl sm:text-3xl font-black text-white">15 Min</span>
                <span className="text-xs text-slate-400 mt-0.5">Live Kitchen Prep</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. SIGNATURE DISHES SHOWCASE (BENTO / CARDS)                  */}
      {/* ------------------------------------------------------------- */}
      <section id="menu" className="relative py-20 bg-[#120f12] border-y border-white/5">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-light mb-2">
                <Flame className="w-4 h-4 text-brand" />
                <span>Culinary Excellence</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Chef's Signature Favourites
              </h2>
              <p className="text-sm text-slate-400 mt-2 max-w-lg">
                Crafted daily with seasonal ingredients, master spices, and culinary artistry.
              </p>
            </div>

            {/* Category filter pills */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                <button
                  onClick={() => setActiveCategory("ALL")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeCategory === "ALL"
                      ? "bg-brand text-white shadow-md shadow-brand/30"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  All Specials
                </button>
                {categories.slice(0, 5).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      activeCategory === cat.id
                        ? "bg-brand text-white shadow-md shadow-brand/30"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dish Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedItems.map((item) => (
              <Link
                to="/menu"
                key={item.id}
                className="group relative rounded-3xl overflow-hidden border border-white/10 bg-white/[0.02] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-brand/40 hover:shadow-2xl hover:shadow-brand/10 flex flex-col"
              >
                {/* Image Container */}
                <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-slate-900">
                  {item.photoUrl ? (
                    <img
                      loading="lazy"
                      src={item.photoUrl}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-900 to-neutral-900 text-slate-600">
                      <Utensils className="w-12 h-12 stroke-[1.5]" />
                    </div>
                  )}

                  {/* Gradient shadow overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#120f12] via-transparent to-black/30" />

                  {/* Category Pill Tag */}
                  <span className="absolute top-3.5 left-3.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-white/10">
                    {item.categoryName || "Special"}
                  </span>

                  {/* Price Tag */}
                  <div className="absolute bottom-3.5 right-3.5 rounded-xl bg-brand/90 backdrop-blur-md px-3 py-1.5 text-xs font-black text-white shadow-lg shadow-black/40">
                    {money(item.price)}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-amber-200 transition-colors line-clamp-1">
                      {item.name}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {item.description || "Freshly cooked to order with house special herbs and delicate seasoning."}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition flex items-center gap-1">
                      <span>Order Item</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                    <span className="text-[11px] font-bold text-amber-400/90">
                      ★ Chef Pick
                    </span>
                  </div>
                </div>
              </Link>
            ))}

            {/* Skeleton / Empty fallback */}
            {displayedItems.length === 0 && !loadingMenu && (
              <div className="col-span-full py-12 text-center text-slate-500">
                <Utensils className="mx-auto w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">Explore our digital menu to see all available dishes.</p>
              </div>
            )}
          </div>

          {/* Full Menu Link CTA */}
          <div className="mt-12 text-center">
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-8 py-3.5 text-sm font-bold text-white hover:bg-white/10 hover:border-white/30 transition shadow-lg"
            >
              <span>View Full Menu &amp; Categories</span>
              <ArrowRight className="w-4 h-4 text-brand-light" />
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. THE ARTISANAL DINING EXPERIENCE (HOW IT WORKS)             */}
      {/* ------------------------------------------------------------- */}
      <section id="experience" className="py-24 relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
              Seamless Hospitality
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              The Digital Dining Experience
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              Designed for effortless convenience — whether you are seated in our dining hall or ordering on the go.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: QrCode,
                title: "Scan Table QR",
                desc: "Simply scan the QR token at your table or open the menu URL on any phone. Instant access without app installs or signups.",
                badge: "Zero Friction",
              },
              {
                step: "02",
                icon: ChefHat,
                title: "Instant Kitchen Dispatch",
                desc: "Your selections fire straight to our chef's Kitchen Display System (KDS) and KOT thermal printers in real time.",
                badge: "Live Kitchen Sync",
              },
              {
                step: "03",
                icon: Award,
                title: "Savor & Settle Digitally",
                desc: "Enjoy fresh gourmet dishes delivered to your table. Pay easily via cash, card or digital checkout with instant e-bill.",
                badge: "Smart Billing",
              },
            ].map((card, i) => (
              <div
                key={i}
                className="relative rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-md transition-all duration-300 hover:border-amber-400/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-400/5 group"
              >
                {/* Step Number Background */}
                <div className="text-5xl font-black text-white/5 absolute top-6 right-6 font-mono group-hover:text-brand/10 transition">
                  {card.step}
                </div>

                {/* Icon Container */}
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/20 to-amber-500/10 border border-brand/30 text-amber-300 shadow-lg shadow-brand/10 mb-6">
                  <card.icon className="w-7 h-7" />
                </div>

                <div className="inline-block rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-3">
                  {card.badge}
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. CHEF PHILOSOPHY & QUALITY ASSURANCE                         */}
      {/* ------------------------------------------------------------- */}
      <section id="philosophy" className="py-20 bg-[#120f12] border-t border-white/5">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-light mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Our Culinary Standard</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Authentic Ingredients, Uncompromised Passion.
              </h2>
              <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed">
                At {shopName}, our kitchen honors heritage cooking while embracing contemporary culinary innovations. Every recipe is meticulously perfected by our master culinary brigade.
              </p>

              <div className="mt-6 space-y-3.5">
                {[
                  "100% Fresh Halal Meats & Farm-Fresh Produce",
                  "Chef-Curated In-House Spice Blends",
                  "Direct Table Waiter Call & Dietary Assistance",
                  "Strict Hygiene & Temperature Monitored Kitchens",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm text-slate-300 font-medium">
                    <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Link
                  to="/menu"
                  className="btn-primary !px-7 !py-3 text-sm font-bold shadow-lg shadow-brand/20"
                >
                  Taste The Difference
                </Link>
              </div>
            </div>

            {/* Visual Highlight Card */}
            <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-8 sm:p-10 shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <img
                  src={logoSrc}
                  alt={shopName}
                  className="h-16 w-16 rounded-2xl object-contain bg-white/10 p-2 border border-white/20 shadow-md"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/logo.svg";
                  }}
                />
                <div>
                  <h4 className="text-xl font-extrabold text-white">{shopName}</h4>
                  <p className="text-xs text-amber-300 font-semibold uppercase tracking-wider">
                    {shopTagline || "Modern Kitchen"}
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-300 italic leading-relaxed">
                "Dining is more than nourishment — it is an art of gathering, sharing moments, and experiencing authentic joy through memorable tastes."
              </p>

              <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                <span>Dine-in · Takeaway · Fast POS</span>
                <span className="font-bold text-amber-300">Open 7 Days a Week</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 6. GRAND VIP FINAL CALL-TO-ACTION                             */}
      {/* ------------------------------------------------------------- */}
      <section className="py-20 relative">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="relative rounded-3xl overflow-hidden border border-brand/30 bg-gradient-to-r from-brand/20 via-[#181116] to-amber-900/20 p-10 sm:p-16 text-center shadow-2xl backdrop-blur-xl">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-brand/30 blur-[90px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
              <span className="rounded-full bg-brand/20 border border-brand/40 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-brand-light mb-4">
                Ready To Dine?
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4">
                Your Table Awaits At {shopName}
              </h2>
              <p className="text-slate-300 max-w-xl text-sm sm:text-base mb-8">
                Explore our digital menu, customize your dishes, and place your order in under a minute.
              </p>
              <Link
                to="/menu"
                className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-10 py-4 text-base font-extrabold text-slate-950 shadow-xl shadow-amber-500/20 hover:brightness-105 active:scale-95 transition"
              >
                <Utensils className="w-5 h-5 text-slate-950" />
                <span>Start Your Order</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 7. LUXURY RESTAURANT FOOTER                                    */}
      {/* ------------------------------------------------------------- */}
      <footer className="border-t border-white/10 bg-[#0a080a] py-12">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/5">
            {/* Logo and Brand */}
            <div className="flex items-center gap-3">
              <img
                src={logoSrc}
                alt={shopName}
                className="h-10 w-10 rounded-xl object-contain bg-white/10 p-1.5 border border-white/20"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/logo.svg";
                }}
              />
              <div>
                <p className="text-lg font-extrabold text-white font-sans">{shopName}</p>
                <p className="text-xs text-slate-400">{shopTagline || "Modern Kitchen"}</p>
              </div>
            </div>

            {/* Quick Links */}
            <div className="flex items-center gap-6 text-xs font-semibold text-slate-400">
              <Link to="/menu" className="hover:text-white transition">Menu</Link>
              <Link to="/history" className="hover:text-white transition">Order History</Link>
              <Link to="/login" className="hover:text-brand-light transition">Staff Portal</Link>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center sm:text-left">
            <p>© {new Date().getFullYear()} {shopName}. All rights reserved.</p>
            <p className="text-[11px] text-slate-500">Fine Dining &amp; Cloud ERP Restaurant Automation</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
