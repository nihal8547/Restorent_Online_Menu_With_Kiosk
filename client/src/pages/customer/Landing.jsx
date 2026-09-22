import React from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <div className="text-5xl">🍽️</div>
        <h1 className="mt-2 text-3xl font-bold text-brand">Enikk Vendya</h1>
        <p className="mt-1 text-gray-500">Restaurant Online Menu</p>
      </div>
      <div className="w-full space-y-3">
        <Link to="/menu" className="btn-primary w-full">
          View Menu & Order
        </Link>
        <Link to="/history" className="btn-outline w-full">
          My Order History
        </Link>
        <Link to="/login" className="btn-outline w-full">
          Staff Login
        </Link>
      </div>
      <p className="text-xs text-gray-400">Scan your table QR code to order for dine-in.</p>
    </div>
  );
}
