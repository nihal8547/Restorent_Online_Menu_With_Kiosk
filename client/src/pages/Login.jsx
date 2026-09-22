import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth.js";

const HOME_BY_ROLE = {
  ADMIN: "/admin",
  CASHIER: "/admin/billing",
  KITCHEN: "/kitchen",
  WAITER: "/waiter",
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mb-5 text-center">
          <div className="text-4xl">🍽️</div>
          <h1 className="mt-1 text-xl font-bold text-brand">Enikk Vendya</h1>
          <p className="text-sm text-gray-500">Staff Login</p>
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
