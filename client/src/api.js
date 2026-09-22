import axios from "axios";
import { BRAND } from "./config.js";

// All API calls go through /api (Vite proxies to the backend in dev).
export const api = axios.create({ baseURL: "/api" });

// Attach the staff token if present.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ev_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalise error messages.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err.response?.data?.error || err.message || "Something went wrong";
    return Promise.reject(new Error(msg));
  }
);

export const money = (n) => `${BRAND.currency} ${Number(n || 0).toFixed(2)}`;
