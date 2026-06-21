import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Recipe } from "../data/recipes.ts";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";

const CATEGORIES = ["All", "Sourdough", "Viennoiserie", "Cakes", "Pastry", "Bread", "Other"];

interface FlyingDot {
  id: number;
  startX: number;
  startY: number;
  img: string;
}

interface Props {
  onPreOrder: (recipe: Recipe) => void;
  currentUser: { name: string; email: string } | null;
  cartCount: number;
}

export default function PublicHome({ onPreOrder, currentUser, cartCount }: Props) {
  const navigate = useNavigate();
  const cartBtnRef = useRef<HTMLButtonElement>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [flyingDots, setFlyingDots] = useState<FlyingDot[]>([]);
  const [cartBump, setCartBump] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("recipes").select("*").then(({ data }) => {
      if (data) setRecipes(data.map((r) => ({ ...r, ingredients: [], steps: [] })));
      setLoading(false);
    });

    const channel = supabase
      .channel("rt-public-recipes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "recipes" }, ({ new: row }) => {
        setRecipes((prev) => prev.find((r) => r.id === row.id) ? prev : [...prev, { ...row, ingredients: [], steps: [] }]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "recipes" }, ({ new: row }) => {
        setRecipes((prev) => prev.map((r) => r.id === row.id ? { ...r, name: row.name, img: row.img, category: row.category, yield: row.yield, time: row.time } : r));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "recipes" }, ({ old: row }) => {
        setRecipes((prev) => prev.filter((r) => r.id !== row.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = recipes.filter((r) => {
    const matchCat = activeCategory === "All" || r.category === activeCategory;
    return matchCat && r.name.toLowerCase().includes(search.toLowerCase());
  });

  const handleAddToCart = (recipe: Recipe, sourceEl: HTMLButtonElement) => {
    // fire the onPreOrder (adds to cart state in App)
    onPreOrder(recipe);

    if (!currentUser) return; // login redirect handled by parent, no animation needed

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
          <h1 className="font-bold text-[#26170c]" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>
            Avelina's
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

            {currentUser ? (
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
            ) : null}

            {currentUser ? (
              <>
                <button onClick={() => navigate("/orders")} className="flex items-center gap-1.5 px-3 h-9 rounded-full border border-[#26170c]/20 text-xs font-semibold text-[#26170c] hover:bg-white transition-all">
                  <div className="w-5 h-5 rounded-full bg-[#26170c] flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">{currentUser.name.slice(0, 2).toUpperCase()}</span>
                  </div>
                  My Orders
                </button>
                <button
                  onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}
                  className="px-3 h-9 rounded-full border border-[#26170c]/20 text-xs font-semibold text-[#26170c]/60 hover:text-[#26170c] hover:bg-white transition-all"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button onClick={() => navigate("/login")} className="px-4 h-9 rounded-full border border-[#26170c]/20 text-xs font-semibold text-[#26170c] hover:bg-white transition-all">
                Sign In
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
          Order your favourites from Avelina's kitchen. Pick a date and we'll have it ready for you.
        </p>
      </section>

      {/* Category Filter */}
      <div className="max-w-7xl mx-auto px-6 pb-6 flex gap-2 flex-wrap justify-center">
        {CATEGORIES.map((cat) => (
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
              isLoggedIn={!!currentUser}
              onAddToCart={handleAddToCart}
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

      {/* Footer */}
      <footer className="border-t border-[#26170c]/10 py-8 text-center text-xs text-[#26170c]/40">
        © {new Date().getFullYear()} Avelina's Bakery · Made with love
      </footer>
    </div>
  );
}

function RecipeCard(props: {
  recipe: Recipe;
  isLoggedIn: boolean;
  onAddToCart: (recipe: Recipe, el: HTMLButtonElement) => void;
  key?: React.Key;
}) {
  const { recipe, isLoggedIn, onAddToCart } = props;
  const btnRef = useRef<HTMLButtonElement>(null);
  const [added, setAdded] = useState(false);

  const handleClick = () => {
    if (!btnRef.current) return;
    onAddToCart(recipe, btnRef.current);
    if (isLoggedIn) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1200);
    }
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group border border-[#26170c]/5">
      <div className="overflow-hidden" style={{ aspectRatio: "4/3" }}>
        <img
          src={recipe.img}
          alt={recipe.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-5">
        <span className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#fff8f5] text-[#26170c]/50 uppercase tracking-wide mb-2 border border-[#26170c]/10">
          {recipe.category}
        </span>
        <h3 className="font-bold text-[#26170c] text-lg leading-tight mb-1" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
          {recipe.name}
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center gap-1 text-xs text-[#26170c]/50">
            <Icon name="restaurant" size={12} />
            <span className="font-mono">{recipe.yield}</span>
          </span>
          <span className="flex items-center gap-1 text-xs text-[#26170c]/50">
            <Icon name="timer" size={12} />
            <span className="font-mono">{recipe.time}</span>
          </span>
        </div>
        <button
          ref={btnRef}
          onClick={handleClick}
          className="w-full h-10 rounded-xl text-sm font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 overflow-hidden"
          style={{
            backgroundColor: added ? "#3a7c3a" : "#26170c",
            color: "#fff8f5",
            transition: "background-color 0.2s, transform 0.1s",
          }}
        >
          <Icon name={added ? "check" : "shopping_bag"} size={15} />
          {added ? "Added!" : isLoggedIn ? "Add to Cart" : "Pre-Order"}
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
