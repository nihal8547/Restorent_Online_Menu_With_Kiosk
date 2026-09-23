import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth.js";
import { useSettings } from "../store/settings.js";

const HOME_BY_ROLE = {
  ADMIN: "/admin",
  CASHIER: "/admin/billing",
  KITCHEN: "/kitchen",
  WAITER: "/waiter",
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { shopName, shopLogo } = useSettings();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const user = await login(username, password);
      navigate(HOME_BY_ROLE[user.role] || "/");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-7">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ink p-2 shadow-xl shadow-brand/10 border border-white/10">
            <img
              src={shopLogo || "/logo.svg"}
              alt={shopName}
              className="h-full w-full object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/logo.svg";
              }}
            />
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink font-sans">Staff Portal</h1>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">
            {shopName} · Authorized Access
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Username</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        {err && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{err}</p>}
        <button className="btn-primary mt-5 w-full" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
        <p className="mt-4 text-center text-xs text-gray-400">
          Demo: admin / admin123 · kitchen · cashier · waiter (staff123)
        </p>
      </form>
    </div>
  );
}
