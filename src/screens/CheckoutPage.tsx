import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { CartItem } from "./CartPage.tsx";
import { UserProfile } from "./ProfileSetup.tsx";
import { supabase } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";

export interface Order {
  id: string;
  items: CartItem[];
  profile: UserProfile;
  placedAt: string;
  status: "pending" | "confirmed" | "baking" | "ready" | "completed";
}

interface Props {
  cart: CartItem[];
  profile: UserProfile;
  userId: string;
  onUpdateQty: (index: number, qty: number) => void;
  onUpdateDate: (index: number, date: string) => void;
  onPlaceOrder: (order: Order) => void;
}

export default function CheckoutPage({ cart, profile, userId, onUpdateQty, onUpdateDate, onPlaceOrder }: Props) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash">("cash");
  const [gcashRef, setGcashRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fix 14: auth gate — redirect to /login if no authenticated user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate("/login", { replace: true });
    });
  }, []);

  const allDatesSet = cart.every((item) => item.date);

  const handlePlaceOrder = async () => {
    if (!allDatesSet || cart.length === 0 || !userId) return;
    if (paymentMethod === "gcash" && !gcashRef.trim()) {
      setError("Please enter your GCash reference number.");
      return;
    }
    setLoading(true);
    setError("");
    const orderId = `AV-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    const { error: orderErr } = await supabase.from("orders").insert({
      id: orderId, user_id: userId, status: "pending",
      notes: notes.trim() || null, placed_at: now,
      payment_method: paymentMethod,
      gcash_reference: paymentMethod === "gcash" ? gcashRef.trim() : null,
    });

    if (orderErr) { setError(orderErr.message); setLoading(false); return; }

    for (const item of cart) {
      await supabase.from("order_items").insert({
        order_id: orderId, recipe_id: item.recipe.id,
        qty: item.qty, pickup_date: item.date,
        unit_price: item.recipe.price ?? 0,
      });
    }

    setLoading(false);
    onPlaceOrder({ id: orderId, items: cart, profile, placedAt: now, status: "pending" });
  };

  return (
    <div className="min-h-screen bg-[#fff8f5]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <header className="sticky top-0 z-50 bg-[#fff8f5]/90 backdrop-blur-md border-b border-[#26170c]/10">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/cart")} className="flex items-center gap-2 text-[#26170c] font-semibold text-sm">
            <Icon name="arrow_back" size={16} /> Cart
          </button>
          <span className="font-bold text-[#26170c]" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>Checkout</span>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Delivery to */}
        <div className="bg-white rounded-2xl border border-[#26170c]/8 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[#26170c] text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Order For</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#26170c] flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">{profile.name.slice(0, 2).toUpperCase()}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#26170c]">{profile.name}</p>
              <p className="text-xs text-[#26170c]/50">{profile.email} · {profile.phone}</p>
              <p className="text-xs text-[#26170c]/50">{profile.address}</p>
            </div>
          </div>
        </div>

        {/* Items with qty + date */}
        <div className="space-y-3">
          <h3 className="font-bold text-[#26170c]" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>Your Items</h3>
          {cart.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#26170c]/8 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                  <img src={item.recipe.img} alt={item.recipe.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-[#26170c] text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{item.recipe.name}</h4>
                  <p className="text-xs text-[#26170c]/50">{item.recipe.category}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">Quantity</label>
                  <div className="flex items-center gap-2 border border-[#26170c]/15 rounded-lg w-fit">
                    <button onClick={() => onUpdateQty(i, Math.max(1, item.qty - 1))} className="w-9 h-9 flex items-center justify-center text-[#26170c]/60 hover:text-[#26170c]">
                      <Icon name="remove" size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-[#26170c] font-mono">{item.qty}</span>
                    <button onClick={() => onUpdateQty(i, item.qty + 1)} className="w-9 h-9 flex items-center justify-center text-[#26170c]/60 hover:text-[#26170c]">
                      <Icon name="add" size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">Pickup Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full h-9 px-3 rounded-lg border border-[#26170c]/15 bg-[#fff8f5] text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40 font-mono"
                    value={item.date}
                    onChange={(e) => onUpdateDate(i, e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-[#26170c]/8 p-5">
          <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-2">Order Notes (optional)</label>
          <textarea
            className="w-full px-3 py-2.5 rounded-xl border border-[#26170c]/15 bg-[#fff8f5] text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40 resize-none"
            rows={3}
            placeholder="Any special requests? Allergies? Let us know."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-2xl border border-[#26170c]/8 p-5 space-y-3">
          <h3 className="font-bold text-[#26170c] text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Payment Method</h3>
          <div className="flex gap-3">
            {(["cash", "gcash"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${paymentMethod === m ? "border-[#26170c] bg-[#26170c] text-white" : "border-[#26170c]/15 text-[#26170c]/60 hover:border-[#26170c]/40"}`}
              >
                {m === "cash" ? "Cash on Pickup" : "GCash"}
              </button>
            ))}
          </div>
          {paymentMethod === "gcash" && (
            <div>
              <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">GCash Reference Number</label>
              <input
                type="text"
                className="w-full h-10 px-3 rounded-lg border border-[#26170c]/15 bg-[#fff8f5] text-sm text-[#26170c] font-mono focus:outline-none focus:border-[#26170c]/40"
                placeholder="e.g. 1234567890"
                value={gcashRef}
                onChange={(e) => setGcashRef(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-[#26170c]/8 p-5 space-y-2">
          <h3 className="font-bold text-[#26170c] text-sm mb-3" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Summary</h3>
          {cart.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-[#26170c]/70">{item.recipe.name} <span className="text-[#26170c]/40 font-mono">x{item.qty}</span></span>
              <div className="text-right">
                <span className="font-mono font-semibold text-[#26170c]">{peso((item.recipe.price ?? 0) * item.qty)}</span>
                {item.date && <span className="block text-xs text-[#26170c]/40">{item.date}</span>}
              </div>
            </div>
          ))}
          <div className="border-t border-[#26170c]/10 pt-2 flex justify-between font-bold text-[#26170c]">
            <span>Total ({cart.reduce((s, i) => s + i.qty, 0)} items)</span>
            <span className="font-mono">{peso(cart.reduce((s, i) => s + (i.recipe.price ?? 0) * i.qty, 0))}</span>
          </div>
        </div>

        {!allDatesSet && (
          <p className="text-xs text-amber-600 font-semibold flex items-center gap-1.5">
            <Icon name="warning" size={14} /> Please set a pickup date for each item.
          </p>
        )}
        {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

        <button
          onClick={handlePlaceOrder}
          disabled={!allDatesSet || cart.length === 0 || loading}
          className="w-full py-4 rounded-xl bg-[#26170c] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon name="check_circle" size={18} /> {loading ? "Placing order…" : "Place Order"}
        </button>
      </div>
    </div>
  );
}
