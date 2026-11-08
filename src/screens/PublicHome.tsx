import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Recipe } from "../data/recipes.ts";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";
import PushToggle from "../components/PushToggle.tsx";
import { signOut } from "../lib/auth.ts";
import { usePreorderDates, fmtDate, fmtDateList } from "../lib/preorder.ts";


interface FlyingDot {
  id: number;
  startX: number;
  startY: number;
  img: string;
}

interface Props {
  onPreOrder: (recipe: Recipe, preorderDate?: string | null, qty?: number) => void;
  currentUser: { id: string; name: string; email: string } | null;
  cartCount: number;
}

export default function PublicHome({ onPreOrder, currentUser, cartCount }: Props) {
  const navigate = useNavigate();
  const cartBtnRef = useRef<HTMLButtonElement>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [flyingDots, setFlyingDots] = useState<FlyingDot[]>([]);
  const [cartBump, setCartBump] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [preorderMap] = usePreorderDates();
  const [sheetFor, setSheetFor] = useState<Recipe | null>(null);

  useEffect(() => {
    supabase.from("recipe_categories").select("name").order("created_at").then(({ data }) => {
      if (data) setCategories(data.map((d: any) => d.name));
    });

    supabase.from("recipes").select("*").then(({ data }) => {
      if (data) setRecipes(data.map((r) => ({ ...r, ingredients: [], steps: [] })));
      setLoading(false);
    });

    const channel = supabase
      .channel("rt-public-recipes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "recipes" }, ({ new: row }) => {
        setRecipes((prev) => prev.find((r) => r.id === row.id) ? prev : [...prev, { ...(row as Recipe), ingredients: [], steps: [] }]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "recipes" }, ({ new: row }) => {
        setRecipes((prev) => prev.map((r) => r.id === row.id ? { ...r, name: row.name, img: row.img, category: row.category, yield: row.yield, time: row.time, price: row.price ?? 0, is_available: row.is_available ?? true, is_for_sale: row.is_for_sale ?? true } : r));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "recipes" }, ({ old: row }) => {
        setRecipes((prev) => prev.filter((r) => r.id !== row.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = recipes.filter((r) => {
    if (r.is_for_sale === false) return false; // hidden from storefront by admin
    const matchCat = activeCategory === "All" || r.category === activeCategory;
    return matchCat && r.name.toLowerCase().includes(search.toLowerCase());
  });

  const handleAddToCart = (recipe: Recipe, sourceEl: HTMLButtonElement) => {
    // fire the onPreOrder (adds to cart state in App)
    onPreOrder(recipe);

    // Get source and target positions
    const src = sourceEl.getBoundingClientRect();
    const tgt = cartBtnRef.current?.getBoundingClientRect();
    if (!tgt) return;

    const id = Date.now();
    setFlyingDots((prev) => [...prev, {
      id,
      startX: src.left + src.width / 2,
      startY: src.top + src.height / 2,
      img: recipe.img,
    }]);

    // After animation ends, bump the cart badge and remove dot
    setTimeout(() => {
      setCartBump(true);
      setFlyingDots((prev) => prev.filter((d) => d.id !== id));
      setTimeout(() => setCartBump(false), 400);
    }, 600);
  };

  const cartTargetX = cartBtnRef.current
    ? cartBtnRef.current.getBoundingClientRect().left + cartBtnRef.current.getBoundingClientRect().width / 2
    : 0;
  const cartTargetY = cartBtnRef.current
    ? cartBtnRef.current.getBoundingClientRect().top + cartBtnRef.current.getBoundingClientRect().height / 2
    : 0;

  return (
    <div className="min-h-screen bg-[#fff8f5] text-[#26170c]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      {/* Flying dots portal */}
      {flyingDots.map((dot) => (
        <FlyingDot
          key={dot.id}
          startX={dot.startX}
          startY={dot.startY}
          endX={cartTargetX}
          endY={cartTargetY}
          img={dot.img}
        />
      ))}

      {/* Nav */}
      <header className="sticky top-0 z-50 bg-[#fff8f5]/90 backdrop-blur-md border-b border-[#26170c]/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="font-bold text-[#26170c]">
            <img src="/majaldita.png" alt="Majaldita's" className="h-8 w-auto" />
          </h1>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-white border border-[#26170c]/10 rounded-full px-4 py-2">
              <Icon name="search" size={15} className="text-[#26170c]/40" />
              <input
                className="bg-transparent border-none focus:outline-none text-sm w-40 placeholder:text-[#26170c]/40"
                placeholder="Search our menu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              ref={cartBtnRef}
              onClick={() => navigate("/cart")}
              className="relative flex items-center gap-1.5 px-3 h-9 rounded-full bg-[#26170c] text-white text-xs font-semibold hover:opacity-90 transition-all"
              style={{ transform: cartBump ? "scale(1.25)" : "scale(1)", transition: "transform 0.15s cubic-bezier(.36,.07,.19,.97)" }}
            >
              <Icon name="shopping_bag" size={14} />
              Cart
              <span
                className="bg-white text-[#26170c] rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold transition-all"
                style={{ transform: cartBump ? "scale(1.4)" : "scale(1)", transition: "transform 0.15s cubic-bezier(.36,.07,.19,.97)" }}
              >
                {cartCount}
              </span>
            </button>

            <button onClick={() => navigate("/orders")} className="flex items-center gap-1.5 px-3 h-9 rounded-full border border-[#26170c]/20 text-xs font-semibold text-[#26170c] hover:bg-white transition-all">
              <Icon name="receipt_long" size={14} />
              <span className="hidden sm:inline">My Orders</span>
            </button>

            {currentUser ? (
              <>
                <span className="hidden sm:inline text-xs font-semibold text-[#26170c]/70">
                  Hi, {currentUser.name.split(" ")[0]}
                </span>
                <PushToggle userId={currentUser.id} role="customer" variant="icon" className="text-[#26170c]" />
                <button
                  onClick={async () => { await signOut(); navigate("/"); }}
                  className="px-3 h-9 rounded-full border border-[#26170c]/20 text-xs font-semibold text-[#26170c]/60 hover:text-[#26170c] hover:bg-white transition-all"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="flex items-center gap-1.5 px-4 h-9 rounded-full bg-[#26170c] text-white text-xs font-semibold hover:opacity-90 transition-all"
              >
                <Icon name="person" size={14} />
                Log in
              </button>
            )}

          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#26170c]/50 mb-4">Handcrafted with love</p>
        <h2 className="font-bold text-[#26170c] mb-4" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: "clamp(36px, 6vw, 72px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          Baked fresh,<br />every day.
        </h2>
        <p className="text-[#26170c]/60 max-w-lg mx-auto text-base leading-relaxed">
          Order your favourites from Majaldita's kitchen. Pick a date and we'll have it ready for you.
        </p>
      </section>

      {/* Category Filter */}
      <div className="max-w-7xl mx-auto px-6 pb-6 flex gap-2 flex-wrap justify-center">
        {["All", ...categories].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeCategory === cat
                ? "bg-[#26170c] text-[#fff8f5]"
                : "bg-white border border-[#26170c]/10 text-[#26170c]/70 hover:border-[#26170c]/30"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Recipe Gallery */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        {loading && (
          <div className="py-24 text-center text-[#26170c]/40 text-sm">Loading menu…</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {!loading && filtered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onAddToCart={handleAddToCart}
              preorderDates={preorderMap[recipe.id] || []}
              onPreorder={setSheetFor}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 py-24 text-center text-[#26170c]/40">
              <Icon name="search" size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nothing found for "{search}"</p>
            </div>
          )}
        </div>
      </section>

      {sheetFor && (
        <PreorderSheet
          recipe={sheetFor}
          dates={preorderMap[sheetFor.id] || []}
          onClose={() => setSheetFor(null)}
          onAdd={(date, qty) => {
            onPreOrder(sheetFor, date, qty);
            setSheetFor(null);
            setCartBump(true);
            setTimeout(() => setCartBump(false), 400);
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-[#26170c]/10 py-8 text-center text-xs text-[#26170c]/40">
        © {new Date().getFullYear()} Majaldita's Bakery · Made with love
        {" · "}
        <button onClick={() => navigate("/login")} className="underline hover:text-[#26170c]/70 transition-colors">Staff login</button>
      </footer>
    </div>
  );
}

function RecipeCard(props: {
  recipe: Recipe;
  onAddToCart: (recipe: Recipe, el: HTMLButtonElement) => void;
  preorderDates: string[];
  onPreorder: (recipe: Recipe) => void;
  key?: React.Key;
}) {
  const { recipe, onAddToCart, preorderDates, onPreorder } = props;
  const canPreorder = preorderDates.length > 0;
  const btnRef = useRef<HTMLButtonElement>(null);
  const [added, setAdded] = useState(false);
  const soldOut = recipe.is_available === false;

  const handleClick = () => {
    if (soldOut || !btnRef.current) return;
    onAddToCart(recipe, btnRef.current);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className={`bg-white rounded-2xl overflow-hidden shadow-sm transition-all duration-300 group border border-[#26170c]/5 ${soldOut ? "opacity-75" : "hover:shadow-md hover:-translate-y-1"}`}>
      <div className="overflow-hidden relative bg-[#f4ece5]" style={{ aspectRatio: "1/1" }}>
        <img
          src={recipe.img}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-md"
        />
        <img
          src={recipe.img}
          alt={recipe.name}
          className={`relative w-full h-full object-contain transition-transform duration-500 ${soldOut ? "grayscale" : "group-hover:scale-105"}`}
        />
        {soldOut && (
          <div className="absolute top-3 left-3 bg-[#26170c] text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full flex items-center gap-1">
            <Icon name="lock" size={11} /> Sold Out
          </div>
        )}
      </div>
      <div className="p-5">
        <span className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#fff8f5] text-[#26170c]/50 uppercase tracking-wide mb-2 border border-[#26170c]/10">
          {recipe.category}
        </span>
        <div className="flex items-start justify-between gap-2 mb-4">
          <h3 className="font-bold text-[#26170c] text-lg leading-tight" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
            {recipe.name}
          </h3>
          {recipe.price ? <span className="shrink-0 font-bold text-[#26170c] text-base font-mono">{peso(recipe.price)}</span> : null}
        </div>
        {canPreorder && (
          <p className="-mt-2 mb-3 text-xs font-semibold text-[#8a4b14] flex items-center gap-1">
            <Icon name="calendar" size={13} /> Available {fmtDateList(preorderDates)}
          </p>
        )}
        <div className="flex gap-2">
        {(!soldOut || !canPreorder) && (
        <button
          ref={btnRef}
          onClick={handleClick}
          disabled={soldOut}
          className="flex-1 h-10 rounded-xl text-sm font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 overflow-hidden disabled:cursor-not-allowed"
          style={{
            backgroundColor: soldOut ? "#cfc7c1" : added ? "#3a7c3a" : "#26170c",
            color: soldOut ? "#26170c" : "#fff8f5",
            transition: "background-color 0.2s, transform 0.1s",
          }}
        >
          <Icon name={soldOut ? "lock" : added ? "check" : "shopping_bag"} size={15} />
          {soldOut ? "Sold Out" : added ? "Added!" : "Add to Bag"}
        </button>
        )}
        {canPreorder && (
          <button
            onClick={() => onPreorder(recipe)}
            className="flex-1 h-10 rounded-xl text-sm font-semibold border-2 border-[#26170c] text-[#26170c] bg-white hover:bg-[#fff8f5] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Icon name="calendar" size={15} /> Pre-order
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

function PreorderSheet({ recipe, dates, onClose, onAdd }: {
  recipe: Recipe;
  dates: string[];
  onClose: () => void;
  onAdd: (date: string, qty: number) => void;
}) {
  const [date, setDate] = useState<string | null>(dates.length === 1 ? dates[0] : null);
  const [qty, setQty] = useState(1);
  const price = recipe.price ?? 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(38,23,12,0.5)" }} onClick={onClose}>
      <div className="bg-[#fff8f5] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
        <div className="w-10 h-1 rounded-full bg-[#26170c]/20 mx-auto mb-4 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-[#26170c] text-lg leading-tight" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{recipe.name}</h3>
            <p className="text-xs text-[#26170c]/50 mt-0.5">{peso(price)} each</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[#26170c]/5 flex items-center justify-center text-[#26170c]/60"><Icon name="close" size={18} /></button>
        </div>

        <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-[#26170c]/50">Choose a pre-order date</p>
        {dates.length === 0 ? (
          <p className="text-sm text-[#26170c]/60">No upcoming dates right now.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={`px-3.5 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${date === d ? "bg-[#26170c] border-[#26170c] text-[#fff8f5]" : "border-[#26170c]/15 text-[#26170c] bg-white hover:border-[#26170c]/40"}`}
              >
                {fmtDate(d)}
              </button>
            ))}
          </div>
        )}
        <p className="text-[11px] text-[#26170c]/45 mt-2">Only dates set by the bakery are shown.</p>

        <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-[#26170c]/50">Quantity</p>
        <div className="flex items-center gap-2 border border-[#26170c]/15 rounded-lg w-fit bg-white">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-[#26170c]/60 hover:text-[#26170c]"><Icon name="remove" size={14} /></button>
          <span className="w-8 text-center text-sm font-bold text-[#26170c] font-mono">{qty}</span>
          <button onClick={() => setQty((q) => Math.min(100, q + 1))} className="w-10 h-10 flex items-center justify-center text-[#26170c]/60 hover:text-[#26170c]"><Icon name="add" size={14} /></button>
        </div>

        <button
          onClick={() => date && onAdd(date, qty)}
          disabled={!date}
          className="mt-6 w-full py-4 rounded-xl bg-[#26170c] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {date ? `Add pre-order · ${peso(price * qty)}` : "Pick a date"}
        </button>
      </div>
    </div>
  );
}

function FlyingDot({ startX, startY, endX, endY, img }: {
  startX: number; startY: number; endX: number; endY: number; img: string; key?: React.Key;
}) {
  const size = 40;
  const dx = endX - startX;
  const dy = endY - startY;

  return (
    <div
      style={{
        position: "fixed",
        left: startX - size / 2,
        top: startY - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        zIndex: 9999,
        pointerEvents: "none",
        border: "2px solid #26170c",
        animation: "flyToCart 0.6s cubic-bezier(.25,.46,.45,.94) forwards",
        // @ts-ignore
        "--dx": `${dx}px`,
        "--dy": `${dy}px`,
      }}
    >
      <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <style>{`
        @keyframes flyToCart {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          60%  { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
