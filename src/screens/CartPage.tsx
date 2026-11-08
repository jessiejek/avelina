import React from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { Recipe } from "../data/recipes.ts";
import { peso } from "../lib/money.ts";
import { groupCart, groupTitle } from "../lib/preorder.ts";

export interface CartItem {
  recipe: Recipe;
  qty: number;
  /** YYYY-MM-DD when this line is a pre-order; absent/null = available now. */
  preorderDate?: string | null;
}

interface Props {
  cart: CartItem[];
  onUpdateQty: (index: number, qty: number) => void;
  onRemove: (index: number) => void;
  onCheckout: () => void;
  notice?: string;
  onDismissNotice?: () => void;
}

export default function CartPage({ cart, onUpdateQty, onRemove, onCheckout, notice, onDismissNotice }: Props) {
  const navigate = useNavigate();
  const groups = groupCart(cart);
  const total = cart.reduce((sum, i) => sum + (i.recipe.price ?? 0) * i.qty, 0);

  return (
    <div className="min-h-screen bg-[#fff8f5]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <header className="sticky top-0 z-50 bg-[#fff8f5]/90 backdrop-blur-md border-b border-[#26170c]/10">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#26170c] font-semibold text-sm">
            <Icon name="arrow_back" size={16} /> Back to Menu
          </button>
          <span className="font-bold text-[#26170c]" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>My Bag</span>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {notice && (
          <div className="flex items-start gap-2 bg-[#f3e1cf] text-[#5c3410] rounded-xl px-4 py-3 text-xs">
            <Icon name="info" size={14} className="shrink-0 mt-0.5" />
            <span className="flex-1">{notice}</span>
            {onDismissNotice && <button onClick={onDismissNotice}><Icon name="close" size={14} /></button>}
          </div>
        )}
        {cart.length === 0 ? (
          <div className="py-24 text-center">
            <Icon name="shopping_bag" size={48} className="mx-auto mb-4 text-[#26170c]/20" />
            <p className="text-[#26170c]/50 text-sm mb-4">Your bag is empty</p>
            <button onClick={() => navigate("/")} className="px-6 h-10 rounded-xl bg-[#26170c] text-white text-sm font-semibold hover:opacity-90 transition-all">
              Browse Menu
            </button>
          </div>
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#26170c] text-sm flex items-center gap-2" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                    <Icon name={g.preorderDate ? "calendar" : "shopping_bag"} size={15} />
                    {groupTitle(g)}
                  </h3>
                  <span className="text-xs font-mono font-semibold text-[#26170c]/60">{peso(g.subtotal)}</span>
                </div>
                {g.lines.map(({ item, index: i }) => (
                  <div key={i} className="bg-white rounded-2xl border border-[#26170c]/8 flex gap-4 p-4">
                    <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                      <img src={item.recipe.img} alt={item.recipe.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2 mb-3">
                        <h3 className="font-bold text-[#26170c] text-sm leading-tight" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{item.recipe.name}</h3>
                        <span className="text-sm font-mono font-semibold text-[#26170c] shrink-0">{peso((item.recipe.price ?? 0) * item.qty)}</span>
                      </div>
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
                    </div>
                  </div>
                ))}
              </section>
            ))}

            <button
              onClick={() => navigate("/")}
              className="w-full h-12 rounded-xl border-2 border-dashed border-[#26170c]/20 text-sm font-semibold text-[#26170c]/60 hover:border-[#26170c]/40 hover:text-[#26170c]/80 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="add" size={16} /> Add More Items
            </button>

            <div className="bg-white rounded-2xl border border-[#26170c]/8 p-5 space-y-3">
              <h3 className="font-bold text-[#26170c] text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Summary</h3>
              {groups.map((g) => (
                <div key={g.key} className="flex justify-between text-sm text-[#26170c]/70">
                  <span>{groupTitle(g)} <span className="text-[#26170c]/40 font-mono">· {g.count} item{g.count === 1 ? "" : "s"}</span></span>
                  <span className="font-mono font-semibold">{peso(g.subtotal)}</span>
                </div>
              ))}
              <div className="border-t border-[#26170c]/10 pt-3 flex justify-between text-sm font-bold text-[#26170c]">
                <span>Total ({cart.reduce((sum, i) => sum + i.qty, 0)} items)</span>
                <span className="font-mono">{peso(total)}</span>
              </div>
              {groups.length > 1 && (
                <p className="text-xs text-[#26170c]/50">{groups.length} separate orders will be placed — one for each date.</p>
              )}
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
