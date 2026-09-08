import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { CartItem } from "./CartPage.tsx";
import { UserProfile } from "./ProfileSetup.tsx";
import { supabase } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";
import AvailableDatePicker from "../components/AvailableDatePicker.tsx";

export interface GuestInfo {
  name: string;
  phone: string;
  address: string;
  fulfillment: "pickup" | "delivery";
}

export interface Order {
  id: string;
  items: CartItem[];
  profile: UserProfile;
  placedAt: string;
  status: "pending" | "confirmed" | "baking" | "ready" | "completed";
}

interface Props {
  cart: CartItem[];
  guest: GuestInfo;
  userId: string | null;
  onSaveGuest: (g: GuestInfo) => void;
  onUpdateQty: (index: number, qty: number) => void;
  onUpdateDate: (index: number, date: string) => void;
  onPlaceOrder: (order: Order) => void;
}

export default function CheckoutPage({ cart, guest, userId, onSaveGuest, onUpdateQty, onUpdateDate, onPlaceOrder }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState(guest.name);
  const [phone, setPhone] = useState(guest.phone);
  const [address, setAddress] = useState(guest.address);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">(guest.fulfillment || "pickup");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash">("cash");
  const [gcashRef, setGcashRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`, { headers: { "Accept-Language": "en" } });
          const data = await res.json();
          const { road, house_number, suburb, city, town, municipality, province, state, country } = data.address || {};
          const parts = [house_number && road ? `${house_number} ${road}` : road, suburb, city || town || municipality, province || state, country].filter(Boolean);
          setAddress(parts.join(", "));
        } catch { /* keep existing */ }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const allDatesSet = cart.every((item) => item.date);
  const total = cart.reduce((s, i) => s + (i.recipe.price ?? 0) * i.qty, 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (!name.trim()) { setError("Please enter your full name."); return; }
    if (!allDatesSet) { setError("Please set a date for each item."); return; }
    if (fulfillment === "delivery" && !address.trim()) { setError("Please enter a delivery address."); return; }
    if (paymentMethod === "gcash" && !gcashRef.trim()) { setError("Please enter your GCash reference number."); return; }

    setLoading(true);
    setError("");
    onSaveGuest({ name: name.trim(), phone: phone.trim(), address: address.trim(), fulfillment });

    const orderId = `MJ-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    const { error: orderErr } = await supabase.from("orders").insert({
      id: orderId,
      user_id: userId,
      status: "pending",
      fulfillment_type: fulfillment,
      customer_name: name.trim(),
      customer_phone: phone.trim() || null,
      delivery_address: fulfillment === "delivery" ? address.trim() || null : null,
      notes: notes.trim() || null,
      placed_at: now,
      payment_method: paymentMethod,
      gcash_reference: paymentMethod === "gcash" ? gcashRef.trim() : null,
    });

    if (orderErr) { setError(orderErr.message); setLoading(false); return; }

    for (const item of cart) {
      await supabase.from("order_items").insert({
        order_id: orderId,
        recipe_id: item.recipe.id,
        qty: item.qty,
        pickup_date: item.date,
        unit_price: item.recipe.price ?? 0,
      });
    }

    setLoading(false);
    onPlaceOrder({
      id: orderId,
      items: cart,
      profile: { name: name.trim(), email: "", phone: phone.trim(), address: address.trim() },
      placedAt: now,
      status: "pending",
    });
  };

  const inputCls = "w-full h-12 px-4 rounded-xl border border-[#26170c]/15 bg-[#fff8f5] text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40";

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
        {/* Your details */}
        <div className="bg-white rounded-2xl border border-[#26170c]/8 p-5 space-y-4">
          <h3 className="font-bold text-[#26170c] text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Your Details</h3>

          <div>
            <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">Full Name *</label>
            <input className={inputCls} placeholder="e.g. Maria Santos" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">Phone (optional)</label>
            <input type="tel" className={inputCls} placeholder="+63 912 345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">How do you want it?</label>
            <div className="flex gap-3">
              {(["pickup", "delivery"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFulfillment(f)}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold capitalize transition-all ${fulfillment === f ? "border-[#26170c] bg-[#26170c] text-white" : "border-[#26170c]/15 text-[#26170c]/60 hover:border-[#26170c]/40"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {fulfillment === "delivery" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider">Delivery Address *</label>
                <button onClick={locateMe} disabled={locating} className="flex items-center gap-1 text-xs font-semibold text-[#26170c] bg-[#26170c]/8 hover:bg-[#26170c]/15 px-2.5 py-1 rounded-full transition-all disabled:opacity-50">
                  <Icon name={locating ? "progress_activity" : "my_location"} size={12} />
                  {locating ? "Locating…" : "Locate Me"}
                </button>
              </div>
              <textarea
                className="w-full px-3 py-2.5 rounded-xl border border-[#26170c]/15 bg-[#fff8f5] text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/30 resize-none"
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House no., street, barangay, city"
              />
            </div>
          )}
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
                  <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">
                    {fulfillment === "delivery" ? "Delivery Date" : "Pickup Date"}
                  </label>
                  <AvailableDatePicker value={item.date} onChange={(date) => onUpdateDate(i, date)} />
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
                {m === "cash" ? (fulfillment === "delivery" ? "Cash on Delivery" : "Cash on Pickup") : "GCash"}
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
            <span className="font-mono">{peso(total)}</span>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

        <button
          onClick={handlePlaceOrder}
          disabled={cart.length === 0 || loading}
          className="w-full py-4 rounded-xl bg-[#26170c] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon name="check_circle" size={18} /> {loading ? "Placing order…" : "Place Order"}
        </button>
      </div>
    </div>
  );
}
