import { create } from "zustand";
import { api } from "../api.js";

// Staff authentication store (admin / kitchen / cashier / waiter).
export const useAuth = create((set) => ({
  user: JSON.parse(localStorage.getItem("ev_user") || "null"),
  token: localStorage.getItem("ev_token") || null,

  async login(username, password) {
    const { data } = await api.post("/auth/login", { username, password });
    localStorage.setItem("ev_token", data.token);
    localStorage.setItem("ev_user", JSON.stringify(data.user));
    set({ user: data.user, token: data.token });
    return data.user;
  },

  logout() {
    localStorage.removeItem("ev_token");
    localStorage.removeItem("ev_user");
    set({ user: null, token: null });
  },
}));
