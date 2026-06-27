import React from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { Recipe } from "../data/recipes.ts";
import { UserProfile } from "./ProfileSetup.tsx";
import { peso } from "../lib/money.ts";
import AvailableDatePicker from "../components/AvailableDatePicker.tsx";

export interface CartItem {
  recipe: Recipe;
  qty: number;
  date: string;
}

interface Props {
  cart: CartItem[];
  profile: UserProfile;
  onUpdateQty: (index: number, qty: number) => void;
  onUpdateDate: (index: number, date: string) => void;
  onRemove: (index: number) => void;
  onCheckout: () => void;
}

export default function CartPage({ cart, profile, onUpdateQty, onUpdateDate, onRemove, onCheckout }: Props) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#fff8f5]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <header className="sticky top-0 z-50 bg-[#fff8f5]/90 backdrop-blur-md border-b border-[#26170c]/10">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#26170c] font-semibold text-sm">
            <Icon name="arrow_back" size={16} /> Back to Menu
          </button>
          <span className="font-bold text-[#26170c]" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>My Cart</span>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Profile pill */}
        <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#26170c]/8">
          <div className="w-9 h-9 rounded-full bg-[#26170c] flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">{profile.name.slice(0, 2).toUpperCase()}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#26170c]">{profile.name}</p>
            <p className="text-xs text-[#26170c]/50">{profile.phone} · {profile.address}</p>
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="py-24 text-center">
            <Icon name="shopping_bag" size={48} className="mx-auto mb-4 text-[#26170c]/20" />
            <p className="text-[#26170c]/50 text-sm mb-4">Your cart is empty</p>
            <button onClick={() => navigate("/")} className="px-6 h-10 rounded-xl bg-[#26170c] text-white text-sm font-semibold hover:opacity-90 transition-all">
              Browse Menu
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {cart.map((item, i) => (
                <div key={i} className="bg-white rounded-2xl border border-[#26170c]/8 overflow-hidden flex gap-4 p-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                    <img src={item.recipe.img} alt={item.recipe.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[#26170c] text-sm leading-tight mb-1" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{item.recipe.name}</h3>
                    <p className="text-xs text-[#26170c]/50 mb-3">Pickup: <span className="font-semibold text-[#26170c]/70">{item.date || "—"}</span></p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 border border-[#26170c]/15 rounded-lg">
                        <button onClick={() => onUpdateQty(i, Math.max(1, item.qty - 1))} className="w-8 h-8 flex items-center justify-center text-[#26170c]/60 hover:text-[#26170c] transition-colors">
                          <Icon name="remove" size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-[#26170c] font-mono">{item.qty}</span>
                        <button onClick={() => onUpdateQty(i, item.qty + 1)} className="w-8 h-8 flex items-center justify-center text-[#26170c]/60 hover:text-[#26170c] transition-colors">
                          <Icon name="add" size={14} />
                        </button>
                      </div>
                      <button onClick={() => onRemove(i)} className="text-xs text-red-400 hover:text-red-600 transition-colors font-semibold">
                        Remove
                      </button>
                    </div>
                    <div className="mt-2">
                      <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">Pickup Date</label>
                      <AvailableDatePicker value={item.date} onChange={(date) => onUpdateDate(i, date)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate("/")}
              className="w-full h-12 rounded-xl border-2 border-dashed border-[#26170c]/20 text-sm font-semibold text-[#26170c]/60 hover:border-[#26170c]/40 hover:text-[#26170c]/80 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="add" size={16} /> Add More Items
            </button>

            <div className="bg-white rounded-2xl border border-[#26170c]/8 p-5 space-y-3">
              <h3 className="font-bold text-[#26170c] text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Order Summary</h3>
              {cart.map((item, i) => (
                <div key={i} className="flex justify-between text-sm text-[#26170c]/70">
                  <span>{item.recipe.name} <span className="text-[#26170c]/40 font-mono">x{item.qty}</span></span>
                  <span className="font-mono font-semibold">{peso((item.recipe.price ?? 0) * item.qty)}</span>
                </div>
              ))}
              <div className="border-t border-[#26170c]/10 pt-3 flex justify-between text-sm font-bold text-[#26170c]">
                <span>Total ({cart.reduce((sum, i) => sum + i.qty, 0)} items)</span>
                <span className="font-mono">{peso(cart.reduce((sum, i) => sum + (i.recipe.price ?? 0) * i.qty, 0))}</span>
              </div>
            </div>

            <button
              onClick={onCheckout}
              className="w-full h-13 rounded-xl bg-[#26170c] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 py-4"
            >
              <Icon name="check_circle" size={18} /> Proceed to Checkout
            </button>
          </>
        )}
      </div>
    </div>
  );
}
