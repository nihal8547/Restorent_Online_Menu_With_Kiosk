import { create } from "zustand";
import { api } from "../api.js";
import { BRAND } from "../config.js";

export const useSettings = create((set) => ({
  shopName: BRAND.name,
  shopTagline: BRAND.tagline,
  currency: BRAND.currency,
  callWaiterEnabled: true,
  loading: true,

  async fetchSettings() {
    try {
      const { data } = await api.get("/settings");
      set({
        shopName: data.shopName || BRAND.name,
        shopTagline: data.shopTagline || BRAND.tagline,
        currency: data.currency || BRAND.currency,
        callWaiterEnabled: data.call_waiter_enabled !== "0" && data.call_waiter_enabled !== false,
        loading: false,
      });
    } catch (err) {
      console.error("Failed to fetch settings", err);
      set({ loading: false });
    }
  },

  async updateSettings(updates) {
    try {
      await api.put("/settings", updates);
      set((state) => ({ ...state, ...updates }));
      return true;
    } catch (err) {
      console.error("Failed to update settings", err);
      throw err;
    }
  }
}));
