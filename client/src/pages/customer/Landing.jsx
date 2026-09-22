import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Utensils, Smartphone, ShoppingCart, CheckCircle } from "lucide-react";
import { api, money } from "../../api.js";
import { BRAND } from "../../config.js";
import { useSettings } from "../../store/settings.js";

export default function Landing() {
  const { shopName, shopTagline } = useSettings();
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api
      .get("/menu")
      .then(({ data }) => {
        setCategories(data.categories);
        const items = data.categories.flatMap((c) => c.items.map((i) => ({ ...i, category: c.name })));
        setFeatured(items.slice(0, 6));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-cream">
      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <span className="display text-xl font-semibold text-white">{shopName}</span>
          <nav className="hidden gap-6 text-sm font-medium text-white/80 sm:flex">
            <a href="#menu" className="hover:text-white">Menu</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <Link to="/history" className="hover:text-white">My Orders</Link>
          </nav>
          <Link to="/menu" className="btn-gold btn-sm">Order Now</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(1200px 500px at 70% -10%, rgba(225,29,72,0.55), transparent 60%), radial-gradient(800px 400px at 10% 110%, rgba(201,162,39,0.35), transparent 60%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent mix-blend-multiply" />
        <div className="absolute inset-0 bg-ink/30" />
        <div className="absolute bottom-16 left-6 right-6 flex flex-col items-center justify-end text-center z-10 animate-fade-up">
          <span className="mb-2 rounded-full bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white backdrop-blur-md shadow-sm border border-white/10">
            Welcome To
          </span>
          <h1 className="display mb-2 text-5xl font-black tracking-tight text-white drop-shadow-xl sm:text-6xl text-balance leading-tight">
            {shopName}
          </h1>
          <p className="text-sm font-semibold tracking-wide text-brand-light drop-shadow-md sm:text-base opacity-90 uppercase">
            {shopTagline}
          </p>
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-20 pt-32 text-center sm:pt-40">
          <p className="animate-fade-up mt-5 w-full max-w-xl text-base text-white/70 sm:text-lg">
            Scan, browse our chef-crafted menu and order in seconds — dine-in, takeaway or
            home delivery. No app, no login, no waiting.
          </p>
          <div className="animate-fade-up mt-8 flex w-full max-w-md flex-col gap-3 sm:w-auto sm:flex-row">
            <Link to="/menu" className="btn-primary flex items-center justify-center gap-2 px-8 py-3 text-base">
              <Utensils className="w-5 h-5" /> View Menu &amp; Order
            </Link>
            <Link to="/history" className="btn-outline border-white/30 bg-white/10 px-8 py-3 text-base text-white hover:bg-white/20">
              My Order History
            </Link>
          </div>
        </div>
        <svg className="relative block w-full text-cream" viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ height: 40 }}>
          <path fill="currentColor" d="M0 60V20c240 40 480 40 720 0s480-40 720 0v40z" />
        </svg>
      </section>

      {/* Featured dishes */}
      <section id="menu" className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">Our Kitchen</p>
          <h2 className="display mt-1 text-3xl font-semibold text-ink">Signature Favourites</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
          {featured.map((item) => (
            <Link
              to="/menu"
              key={item.id}
              className="card group overflow-hidden transition hover:-translate-y-1 hover:shadow-soft"
            >
              <div className="flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br from-ink to-ink-soft sm:h-40">
                {item.photoUrl ? (
                  <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <span className="text-gray-400 opacity-80"><Utensils className="w-12 h-12" /></span>
                )}
              </div>
              <div className="p-3 sm:p-4">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 sm:text-xs">{item.category}</p>
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
                  <h3 className="line-clamp-1 font-semibold text-ink">{item.name}</h3>
                  <span className="font-semibold text-brand">{money(item.price)}</span>
                </div>
                {item.description && <p className="mt-1 line-clamp-1 text-xs text-gray-500 sm:text-sm">{item.description}</p>}
              </div>
            </Link>
          ))}
          {featured.length === 0 &&
            [0, 1, 2].map((i) => <div key={i} className="card h-64 animate-pulse bg-gray-100" />)}
        </div>

        <div className="mt-10 text-center">
          <Link to="/menu" className="btn-primary px-8 py-3 text-base">
            See the full menu →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="display mb-10 text-center text-3xl font-semibold text-ink">How it works</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { Icon: Smartphone, title: "Scan or Open", text: "Scan your table QR or open the menu link — no login needed." },
              { Icon: ShoppingCart, title: "Pick & Order", text: "Browse dishes, add to cart and place your order in seconds." },
              { Icon: CheckCircle, title: "Enjoy & Pay", text: "Track your order; view your bill and history after payment." },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cream text-brand">
                  <s.Icon className="w-8 h-8" />
                </div>
                <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + categories */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col items-center gap-6 rounded-3xl bg-ink px-8 py-14 text-center">
          <h2 className="display text-3xl font-semibold text-white sm:text-4xl">Hungry already?</h2>
          {categories.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((c) => (
                <span key={c.id} className="badge bg-white/10 text-white/80">
                  {c.name}
                </span>
              ))}
            </div>
          )}
          <Link to="/menu" className="btn-gold px-8 py-3 text-base">
            Order Now
          </Link>
        </div>
      </section>

      {/* Footer — deliberately no staff login here (staff use /login directly) */}
      <footer className="border-t border-gray-200 bg-cream">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-gray-500">
          <p className="display text-lg font-semibold text-ink">{BRAND.name}</p>
          <p className="mt-1">Fresh food, made with love. © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
