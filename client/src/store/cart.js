import { create } from "zustand";
import { persist } from "zustand/middleware";

// Shared cart used by both the customer app and the waiter app.
export const useCart = create(
  persist(
    (set, get) => ({
      items: [], // [{ menuItemId, name, price, qty, note }]

      add(item) {
        const items = [...get().items];
        const idx = items.findIndex((i) => i.menuItemId === item.id);
        if (idx >= 0) {
          items[idx] = { ...items[idx], qty: items[idx].qty + 1 };
        } else {
          items.push({ menuItemId: item.id, name: item.name, price: Number(item.price), qty: 1, note: "" });
        }
        set({ items });
      },

      setQty(menuItemId, qty) {
        const items = get()
          .items.map((i) => (i.menuItemId === menuItemId ? { ...i, qty } : i))
          .filter((i) => i.qty > 0);
        set({ items });
      },

      setNote(menuItemId, note) {
        set({ items: get().items.map((i) => (i.menuItemId === menuItemId ? { ...i, note } : i)) });
      },

      remove(menuItemId) {
        set({ items: get().items.filter((i) => i.menuItemId !== menuItemId) });
      },

      clear() {
        set({ items: [] });
      },

      count() {
        return get().items.reduce((s, i) => s + i.qty, 0);
      },

      subtotal() {
        return get().items.reduce((s, i) => s + i.price * i.qty, 0);
      },
    }),
    {
      name: "ev_cart", // key in localStorage
    }
  )
);
