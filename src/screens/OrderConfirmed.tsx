import React from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { Order } from "./CheckoutPage.tsx";
import { peso } from "../lib/money.ts";

interface Props {
  order: Order | null;
}

export default function OrderConfirmed({ order }: Props) {
  const navigate = useNavigate();

  if (!order) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#fff8f5] flex flex-col items-center justify-center p-6 text-center" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <div className="w-20 h-20 rounded-full bg-[#d4e8ce] flex items-center justify-center mx-auto mb-6">
        <Icon name="check_circle" size={40} className="text-[#26170c]" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#26170c]/40 mb-2">Order Received</p>
      <h1 className="font-bold text-[#26170c] mb-2" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 32 }}>
        Thank you, {order.profile.name.split(" ")[0]}!
      </h1>
      <p className="text-[#26170c]/60 text-sm max-w-xs mb-2">
        Your order <span className="font-bold text-[#26170c]">#{order.id}</span> has been placed. We'll get it ready for you.
      </p>

      <div className="bg-white rounded-2xl border border-[#26170c]/8 p-5 w-full max-w-sm mt-6 mb-8 text-left space-y-3">
        <h3 className="font-bold text-[#26170c] text-sm mb-1" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Order Details</h3>
        {order.items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
              <img src={item.recipe.img} alt={item.recipe.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#26170c]">{item.recipe.name}</p>
              <p className="text-xs text-[#26170c]/50">x{item.qty} · Pickup {item.date}</p>
            </div>
            <span className="text-sm font-semibold text-[#26170c] font-mono shrink-0">{peso((item.recipe.price ?? 0) * item.qty)}</span>
          </div>
        ))}
        <div className="flex justify-between pt-3 border-t border-[#26170c]/8 text-sm font-bold text-[#26170c]">
          <span>Total</span>
          <span className="font-mono">{peso(order.items.reduce((s, it) => s + (it.recipe.price ?? 0) * it.qty, 0))}</span>
        </div>
      </div>

      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={() => navigate("/orders")}
          className="flex-1 h-11 rounded-xl border border-[#26170c]/20 text-sm font-semibold text-[#26170c] hover:bg-white transition-all"
        >
          My Orders
        </button>
        <button
          onClick={() => navigate("/")}
          className="flex-1 h-11 rounded-xl bg-[#26170c] text-white text-sm font-bold hover:opacity-90 transition-all"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}
