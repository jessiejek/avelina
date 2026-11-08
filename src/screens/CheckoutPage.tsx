import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { CartItem } from "./CartPage.tsx";
import { UserProfile } from "./ProfileSetup.tsx";
import { supabase } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";
import { groupCart, groupTitle, fmtDate } from "../lib/preorder.ts";
import { downPayment } from "../lib/payment.ts";
import PaymentProofForm, { DownPaymentBanner } from "../components/PaymentProofForm.tsx";

export interface GuestInfo {
  name: string;
  phone: string;
  social: string;
  address: string;
  fulfillment: "pickup" | "delivery";
}

export interface Order {
  id: string;
  items: CartItem[];
  profile: UserProfile;
  placedAt: string;
  status: "pending" | "confirmed" | "baking" | "ready" | "completed" | "cancelled";
  /** Server-computed total (prices come from the database, not the cart). */
  total?: number;
  /** YYYY-MM-DD for pre-orders, null for "available now". */
  preorderDate?: string | null;
}

interface Props {
  cart: CartItem[];
  guest: GuestInfo;
  userId: string | null;
  onSaveGuest: (g: GuestInfo) => void;
  onUpdateQty: (index: number, qty: number) => void;
  /** Fired as soon as the order is saved (remember it + clear the cart). */
  onOrderSaved: (orders: Order[], remaining: CartItem[]) => void;
  /** Fired when the customer taps Done on the success modal. */
  onPlaceOrder: () => void;
}

export default function CheckoutPage({ cart, guest, userId, onSaveGuest, onUpdateQty, onOrderSaved, onPlaceOrder }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState(guest.name);
  const [phone, setPhone] = useState(guest.phone);
  const [social, setSocial] = useState(guest.social || "");
  const [address, setAddress] = useState(guest.address);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">(guest.fulfillment || "pickup");
  const [notes, setNotes] = useState("");
  const [proofDone, setProofDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locateStatus, setLocateStatus] = useState<"idle" | "locating" | "success" | "error">("idle");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [placedOrders, setPlacedOrders] = useState<Order[]>([]);

  const locateMe = () => {
    if (!navigator.geolocation) { setLocateStatus("error"); return; }
    setLocateStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`, { headers: { "Accept-Language": "en" } });
          const data = await res.json();
          const { road, house_number, suburb, city, town, municipality, province, state, country } = data.address || {};
          const parts = [house_number && road ? `${house_number} ${road}` : road, suburb, city || town || municipality, province || state, country].filter(Boolean);
          if (parts.length === 0) { setLocateStatus("error"); return; }
          setAddress(parts.join(", "));
          setLocateStatus("success");
        } catch {
          setLocateStatus("error");
        }
      },
      () => setLocateStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const total = cart.reduce((s, i) => s + (i.recipe.price ?? 0) * i.qty, 0);
  const groups = groupCart(cart);
  const multi = groups.length > 1;

  const openReview = () => {
    if (cart.length === 0) return;
    if (!name.trim()) { setError("Please enter your full name."); return; }
    if (!phone.trim()) { setError("Please enter your phone number."); return; }
    if (!social.trim()) { setError("Please enter your Facebook or Instagram."); return; }
    if (fulfillment === "delivery" && !address.trim()) { setError("Please enter a delivery address."); return; }
    setError("");
    setReviewOpen(true);
  };

  // One place_order call per bag group ("Available now" + each pre-order date).
  // Each call is its own transaction on the server; prices from the cart are ignored.
  const confirmOrder = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    onSaveGuest({ name: name.trim(), phone: phone.trim(), social: social.trim(), address: address.trim(), fulfillment });

    const base = {
      p_customer_name: name.trim(),
      p_customer_phone: phone.trim(),
      p_customer_social: social.trim() || null,
      p_fulfillment_type: fulfillment,
      p_delivery_address: fulfillment === "delivery" ? address.trim() || null : null,
      p_notes: notes.trim() || null,
      // Down payment is via GCash after booking; the balance is up to the seller.
      p_payment_method: "cash",
      p_gcash_reference: null,
    };
    const profile = { name: name.trim(), email: "", phone: phone.trim(), address: address.trim() };

    const placed: Order[] = [];
    const placedKeys = new Set<string>();
    let failMsg = "";
    for (const g of groups) {
      const args: Record<string, unknown> = {
        ...base,
        p_items: g.lines.map(({ item }) => ({ recipe_id: item.recipe.id, qty: item.qty })),
      };
      // Only sent for pre-orders, so "now" orders still work before the migration is run.
      if (g.preorderDate) args.p_preorder_date = g.preorderDate;

      const { data, error: rpcErr } = await supabase.rpc("place_order", args);
      const result = data as { id?: string; total?: number | string } | null;
      if (rpcErr || !result?.id) {
        console.error("place_order failed:", rpcErr);
        failMsg = `${groupTitle(g)}: ${rpcErr?.message || "please try again."}`;
        break;
      }
      placed.push({
        id: result.id,
        items: g.lines.map(({ item }) => item),
        profile,
        placedAt: new Date().toISOString(),
        status: "pending",
        total: Number(result.total ?? g.subtotal),
        preorderDate: g.preorderDate,
      });
      placedKeys.add(g.key);
    }

    setLoading(false);
    if (placed.length === 0) {
      setError(`Could not place order — ${failMsg}`);
      return;
    }
    const remaining = cart.filter((it) => !placedKeys.has(it.preorderDate || "now"));
    if (failMsg) setError(`Some orders were placed, but one failed — ${failMsg}. Those items are still in your bag.`);
    setReviewOpen(false);
    setPlacedOrders(placed);
    // Persist immediately (order ids saved, placed lines removed) — not only on "Done".
    onOrderSaved(placed, remaining);
  };

  const renderGroups = (list: { key: string; preorderDate: string | null; items: CartItem[]; subtotal: number }[], label: (i: number) => string) => (
    <>
      {list.map((g, gi) => (
        <div key={g.key} className={multi || g.preorderDate ? "space-y-1 pb-2" : "space-y-1"}>
          {(multi || g.preorderDate) && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a4b14]">{label(gi)}</p>
          )}
          {g.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-[#26170c]/70">
                {item.recipe.name} <span className="text-[#26170c]/40 font-mono">x{item.qty}</span>
              </span>
              <span className="font-mono font-semibold text-[#26170c] shrink-0">{peso((item.recipe.price ?? 0) * item.qty)}</span>
            </div>
          ))}
          {multi && (
            <div className="flex justify-between text-xs text-[#26170c]/55">
              <span>Subtotal</span><span className="font-mono">{peso(g.subtotal)}</span>
            </div>
          )}
        </div>
      ))}
    </>
  );
  const cartGroupsView = groups.map((g) => ({ key: g.key, preorderDate: g.preorderDate, items: g.lines.map((l) => l.item), subtotal: g.subtotal }));
  const groupLabel = (i: number) => (multi ? `Order ${i + 1} · ` : "") + groupTitle(groups[i]);

  const dpTotal = groups.reduce((s, g) => s + downPayment(g.subtotal), 0);
  const balanceLabel = fulfillment === "delivery" ? "Balance on delivery" : "Balance on pickup";
  const dpBox = (
    <div className="rounded-xl bg-[#e6f0ff] border border-[#007dfe]/30 p-3 space-y-1.5">
      <p className="text-xs font-bold text-[#0057b8] flex items-center gap-1.5"><Icon name="wallet" size={14} /> 50% down payment via GCash</p>
      <div className="flex justify-between text-sm font-bold text-[#26170c]"><span>Down payment</span><span className="font-mono">{peso(dpTotal)}</span></div>
      {multi && (
        <p className="text-xs text-[#26170c]/60 pl-2">{groups.map((g, i) => `Order ${i + 1}: ${peso(downPayment(g.subtotal))}`).join(" · ")}</p>
      )}
      <div className="flex justify-between text-sm text-[#26170c]/70"><span>{balanceLabel}</span><span className="font-mono">{peso(total - dpTotal)}</span></div>
      <p className="text-[11px] text-[#26170c]/55">You can book now and send the down payment right after. The balance can be paid in cash or GCash.</p>
    </div>
  );

  const cashLabel = fulfillment === "delivery" ? "Cash on Delivery" : "Cash on Pickup";

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
        <DownPaymentBanner />
        {/* Your details */}
        <div className="bg-white rounded-2xl border border-[#26170c]/8 p-5 space-y-4">
          <h3 className="font-bold text-[#26170c] text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Your Details</h3>

          <div>
            <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">Full Name *</label>
            <input className={inputCls} placeholder="e.g. Maria Santos" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">Phone *</label>
            <input type="tel" className={inputCls} placeholder="+63 912 345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">Facebook / Instagram *</label>
            <input className={inputCls} placeholder="facebook.com/yourname or @yourhandle" value={social} onChange={(e) => setSocial(e.target.value)} />
            <p className="text-xs text-[#26170c]/50 mt-1.5">So we can message you about your order.</p>
            <details className="mt-1.5 text-xs text-[#26170c]/60">
              <summary className="cursor-pointer font-semibold text-[#26170c]/70">How do I find my Facebook profile link?</summary>
              <div className="mt-1.5 space-y-1.5 leading-relaxed">
                <p><span className="font-semibold">Phone (Facebook app):</span> Open your profile → tap <span className="font-semibold">•••</span> (top right) → <span className="font-semibold">Profile settings</span> → under <span className="font-semibold">Sharing</span> tap <span className="font-semibold">Copy profile link</span>. Paste it here (looks like <span className="font-mono">facebook.com/yourname</span>).</p>
                <p><span className="font-semibold">Computer (web):</span> Open <span className="font-semibold">facebook.com</span> and go to your profile. Copy the address from the browser's address bar.</p>
                <p><span className="font-semibold">Instagram:</span> Open your profile → tap <span className="font-semibold">Share profile</span> → <span className="font-semibold">Copy link</span>. Or just type <span className="font-mono">@yourhandle</span>.</p>
              </div>
            </details>
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
                <button
                  onClick={locateMe}
                  disabled={locateStatus === "locating"}
                  className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-all disabled:opacity-50 ${
                    locateStatus === "success"
                      ? "text-green-700 bg-green-600/10 hover:bg-green-600/20"
                      : locateStatus === "error"
                      ? "text-red-600 bg-red-600/10 hover:bg-red-600/20"
                      : "text-[#26170c] bg-[#26170c]/8 hover:bg-[#26170c]/15"
                  }`}
                >
                  <Icon
                    name={
                      locateStatus === "locating" ? "progress_activity"
                      : locateStatus === "success" ? "check_circle"
                      : locateStatus === "error" ? "refresh"
                      : "my_location"
                    }
                    size={12}
                    className={locateStatus === "locating" ? "animate-spin" : ""}
                  />
                  {locateStatus === "locating" ? "Locating…"
                    : locateStatus === "success" ? "Located"
                    : locateStatus === "error" ? "Retry"
                    : "Locate Me"}
                </button>
              </div>
              <textarea
                className="w-full px-3 py-2.5 rounded-xl border border-[#26170c]/15 bg-[#fff8f5] text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/30 resize-none"
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House no., street, barangay, city"
              />
              {locateStatus === "success" && (
                <p className="text-xs text-green-700 mt-1">Location found — check the address above and edit if needed.</p>
              )}
              {locateStatus === "error" && (
                <p className="text-xs text-red-500 mt-1">Couldn't get your location. Allow location access, then tap Retry.</p>
              )}
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
                  {item.preorderDate && (
                    <p className="text-[11px] font-semibold text-[#8a4b14] mt-0.5">Pre-order · {fmtDate(item.preorderDate)}</p>
                  )}
                </div>
              </div>
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

        {/* Down payment */}
        <div className="bg-white rounded-2xl border border-[#26170c]/8 p-5 space-y-2">
          <h3 className="font-bold text-[#26170c] text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Payment</h3>
          {dpBox}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-[#26170c]/8 p-5 space-y-2">
          <h3 className="font-bold text-[#26170c] text-sm mb-3" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Summary</h3>
          {renderGroups(cartGroupsView, groupLabel)}
          <div className="border-t border-[#26170c]/10 pt-2 flex justify-between font-bold text-[#26170c]">
            <span>Total ({cart.reduce((s, i) => s + i.qty, 0)} items)</span>
            <span className="font-mono">{peso(total)}</span>
          </div>
          {multi && <p className="text-xs text-[#26170c]/50">{groups.length} orders will be placed — one for each date.</p>}
        </div>

        {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

        <button
          onClick={openReview}
          disabled={cart.length === 0 || loading}
          className="w-full py-4 rounded-xl bg-[#26170c] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon name="check_circle" size={18} /> Review Order
        </button>
        <p className="text-xs text-[#26170c]/50 text-center mt-2">
          You'll see a summary to confirm before your order is sent.
        </p>
      </div>

      {reviewOpen && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4" style={{ backgroundColor: "rgba(38,23,12,0.5)" }}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" style={{ fontFamily: "'Work Sans', sans-serif" }}>
            <div className="p-5 border-b border-[#26170c]/8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#26170c]/40">Review your order</p>
              <h3 className="font-bold text-[#26170c] text-lg mt-0.5" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                Confirm before sending
              </h3>
              {multi && (
                <p className="mt-2 text-xs font-bold text-[#fff8f5] bg-[#26170c] rounded-lg px-3 py-2 text-center">
                  {groups.length} orders will be placed
                </p>
              )}
              <div className="mt-3"><DownPaymentBanner compact /></div>
            </div>

            <div className="p-5 space-y-2 max-h-[45vh] overflow-y-auto">
              {renderGroups(cartGroupsView, groupLabel)}
              <div className="border-t border-[#26170c]/10 pt-2 flex justify-between font-bold text-[#26170c]">
                <span>{multi ? "Grand total" : "Total"} ({cart.reduce((s, i) => s + i.qty, 0)} items)</span>
                <span className="font-mono">{peso(total)}</span>
              </div>
              {dpBox}
              <div className="flex justify-between text-xs text-[#26170c]/55 pt-1">
                <span>{fulfillment === "delivery" ? "Delivery" : "Pickup"}</span>
              </div>
              {fulfillment === "delivery" && address.trim() && (
                <p className="text-xs text-[#26170c]/55">{address.trim()}</p>
              )}
            </div>

            {error && <p className="px-5 text-xs text-red-500 font-semibold">{error}</p>}

            <div className="p-4 border-t border-[#26170c]/8 flex gap-3">
              <button
                onClick={() => setReviewOpen(false)}
                disabled={loading}
                className="flex-1 py-3.5 rounded-xl border border-[#26170c]/20 text-[#26170c] text-sm font-bold hover:bg-[#26170c]/5 transition-all disabled:opacity-40"
              >
                Go Back
              </button>
              <button
                onClick={confirmOrder}
                disabled={loading}
                className="flex-1 py-3.5 rounded-xl bg-[#26170c] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
              >
                {loading ? "Sending…" : multi ? `Place ${groups.length} orders` : "Confirm Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {placedOrders.length > 0 && (() => {
        const ids = placedOrders.map((o) => o.id);
        const grand = placedOrders.reduce((s, o) => s + (o.total ?? 0), 0);
        const dp = placedOrders.reduce((s, o) => s + downPayment(o.total ?? 0), 0);
        return (
          <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#fff8f5]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
            <div className="max-w-md mx-auto px-5 py-8 space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-[#d4e8ce] flex items-center justify-center mx-auto mb-2">
                  <Icon name="check_circle" size={28} className="text-[#26170c]" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#26170c]/40">
                  {placedOrders.length > 1 ? `${placedOrders.length} orders booked` : "Order booked"}
                </p>
                <h2 className="font-bold text-[#26170c] text-xl" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                  {proofDone ? "Proof sent — thank you!" : "Pay your down payment"}
                </h2>
                <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                  {placedOrders.map((o) => (
                    <span key={o.id} className="text-[11px] font-mono text-[#26170c]/60">
                      #{o.id}{o.preorderDate ? ` · ${fmtDate(o.preorderDate)}` : ""}
                    </span>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-red-600 font-semibold text-center">{error}</p>}

              {proofDone || !userId ? (
                <div className="bg-white rounded-2xl border border-[#26170c]/8 p-5 text-center space-y-2">
                  <p className="text-sm text-[#26170c]/70">
                    {proofDone
                      ? "We'll check your GCash payment and confirm your order soon."
                      : "Send your down payment and upload the proof from My Orders."}
                  </p>
                  <button onClick={() => onPlaceOrder()} className="w-full py-3.5 rounded-xl bg-[#26170c] text-white text-sm font-bold">
                    Go to My Orders
                  </button>
                </div>
              ) : (
                <PaymentProofForm
                  userId={userId}
                  orderIds={ids}
                  amount={dp}
                  balance={grand - dp}
                  onSubmitted={() => setProofDone(true)}
                  onLater={() => onPlaceOrder()}
                />
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
