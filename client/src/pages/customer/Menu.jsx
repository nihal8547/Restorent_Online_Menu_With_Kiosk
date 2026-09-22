import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, money } from "../../api.js";
import { useCart } from "../../store/cart.js";
import { Spinner, Empty } from "../../components/ui.jsx";

export default function Menu() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState(null);
  const [err, setErr] = useState("");

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
        setCategories(data.categories);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [qrToken]);

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-cream pb-28">
      <header className="sticky top-0 z-30 bg-ink px-4 py-4 text-white shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/" className="display text-lg font-semibold">
              Enikk Vendya
            </Link>
            {table ? (
              <p className="mt-0.5 text-xs text-gold">Dine-in · Table {table.tableNo}</p>
            ) : (
              <p className="mt-0.5 text-xs text-white/60">Takeaway / Delivery</p>
            )}
          </div>
          <Link to="/history" className="text-xs text-white/70 underline underline-offset-2">
            My orders
          </Link>
        </div>
      </header>

      {err && <p className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{err}</p>}

      <div className="space-y-6 px-4 py-4">
        {categories.length === 0 && <Empty>No items available right now.</Empty>}
        {categories.map((cat) => (
          <section key={cat.id}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">{cat.name}</h2>
            <div className="space-y-2">
              {cat.items.map((item) => {
                const inCart = cart.items.find((i) => i.menuItemId === item.id);
                return (
                  <div key={item.id} className="card flex items-center gap-3 p-3">
                    {item.photoUrl && (
                      <img src={item.photoUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.name}</p>
                      {item.description && (
                        <p className="truncate text-xs text-gray-500">{item.description}</p>
                      )}
                      <p className="mt-0.5 text-sm font-semibold text-brand">{money(item.price)}</p>
                    </div>
                    {inCart ? (
                      <div className="flex items-center gap-2">
                        <button
                          className="btn-outline btn-sm h-8 w-8 !px-0"
                          onClick={() => cart.setQty(item.id, inCart.qty - 1)}
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-semibold">{inCart.qty}</span>
                        <button
                          className="btn-primary btn-sm h-8 w-8 !px-0"
                          onClick={() => cart.setQty(item.id, inCart.qty + 1)}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button className="btn-primary btn-sm" onClick={() => cart.add(item)}>
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {cart.count() > 0 && (
        <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 border-t border-gray-200 bg-white p-4">
          <button className="btn-primary w-full" onClick={() => navigate("/checkout")}>
            View Cart · {cart.count()} item(s) · {money(cart.subtotal())}
          </button>
        </div>
      )}
    </div>
  );
}
