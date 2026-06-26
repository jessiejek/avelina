import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase.ts";
import Sidebar from "./components/Sidebar.tsx";
import InventoryDashboard from "./screens/InventoryDashboard.tsx";
import IngredientDetail from "./screens/IngredientDetail.tsx";
import StockAdjustment from "./screens/StockAdjustment.tsx";
import RecipesList from "./screens/RecipesList.tsx";
import RecipeBuilder from "./screens/RecipeBuilder.tsx";
import BakeConfirmation from "./screens/BakeConfirmation.tsx";
import BakeLog, { BakeEntry } from "./screens/BakeLog.tsx";
import Stats from "./screens/Stats.tsx";
import FinanceDashboard from "./screens/FinanceDashboard.tsx";
import AdminOrders from "./screens/AdminOrders.tsx";
import PublicHome from "./screens/PublicHome.tsx";
import LoginPage from "./screens/LoginPage.tsx";
import ProfileSetup, { UserProfile } from "./screens/ProfileSetup.tsx";
import CartPage, { CartItem } from "./screens/CartPage.tsx";
import CheckoutPage, { Order } from "./screens/CheckoutPage.tsx";
import OrderConfirmed from "./screens/OrderConfirmed.tsx";
import OrdersPage from "./screens/OrdersPage.tsx";
import Icon from "./components/Icon.tsx";
import { Ingredient } from "./data/inventory.ts";
import { Recipe } from "./data/recipes.ts";

// ── DB → app type mappers ─────────────────────────────────────

function fmtStock(q: number): number {
  return parseFloat(Number(q).toFixed(3));
}

function mapIngredient(d: any): Ingredient {
  const qty = fmtStock(d.quantity ?? 0);
  return {
    id: d.id, name: d.name, sku: d.sku,
    stock: `${qty} ${d.unit}`,
    quantity: qty,
    unit: d.unit, status: d.status, icon: d.icon, img: d.img,
    costPerUnit: d.cost_per_unit ?? 0,
    lowThreshold: d.low_threshold ?? undefined,
  };
}

function mapRecipe(r: any): Recipe {
  return {
    id: r.id, name: r.name, category: r.category,
    yield: r.yield, time: r.time, img: r.img,
    description: r.description ?? "", prep_time: r.prep_time ?? "", difficulty: r.difficulty ?? "",
    price: r.price ?? 0, is_available: r.is_available ?? true,
    finished_shelf_life_days: r.finished_shelf_life_days ?? null,
    ingredients: (r.recipe_ingredients || []).map((ri: any) => ({
      ingredientId: ri.ingredients?.id || "",
      name: ri.ingredients?.name || "",
      qty: ri.qty,
      unit: ri.unit,
    })),
    steps: [...(r.recipe_steps || [])]
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((s: any) => ({ num: s.num, title: s.title, description: s.description })),
  };
}

function mapBakeEntry(d: any): BakeEntry {
  return {
    id: d.id,
    recipe_id: d.recipe_id,
    product: d.recipes?.name || "",
    img: d.img || d.recipes?.img || "",
    batchId: d.batch_id,
    baker: d.baker,
    time: new Date(d.started_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
    startedAt: d.started_at,
    qty: d.qty,
    actualQty: d.actual_qty ?? null,
    status: d.status,
    order_id: d.order_id ?? null,
  };
}

// ── Recipe picker modal (admin) ───────────────────────────────

function RecipePickerModal({ recipes, onSelect, onClose }: { recipes: Recipe[]; onSelect: (r: Recipe) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(29,27,26,0.6)" }} onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/10">
          <div>
            <h3 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 20 }}>Start New Production</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Pick a recipe to bake</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto">
          {recipes.map((r) => (
            <button key={r.name} onClick={() => onSelect(r)} className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-surface-container transition-colors text-left group">
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-outline-variant/20">
                <img src={r.img} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary text-sm truncate" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{r.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide bg-surface-container px-2 py-0.5 rounded-full">{r.category}</span>
                  <span className="text-xs text-on-surface-variant font-mono">{r.yield}</span>
                  <span className="text-xs text-on-surface-variant font-mono">{r.time}</span>
                </div>
              </div>
              <Icon name="chevron_right" size={16} className="text-outline group-hover:text-primary transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Admin shell ───────────────────────────────────────────────

function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [inventory, setInventory] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [bakeLogs, setBakeLogs] = useState<BakeEntry[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [confirmRecipe, setConfirmRecipe] = useState<Recipe | null>(null);
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null);
  const [confirmOrderQty, setConfirmOrderQty] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    // Initial loads
    supabase.from("ingredients").select("*").then(({ data }) => {
      if (data) setInventory(data.map(mapIngredient));
    });

    supabase
      .from("recipes")
      .select("*, recipe_ingredients(qty, unit, ingredients(id, name)), recipe_steps(num, title, description, sort_order)")
      .then(({ data }) => {
        if (data) setRecipes(data.map(mapRecipe));
      });

    supabase
      .from("bake_entries")
      .select("*, recipes(name, img)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setBakeLogs(data.map(mapBakeEntry));
      });

    // Real-time: ingredients
    const ingChannel = supabase
      .channel("rt-ingredients")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ingredients" }, ({ new: row }) => {
        setInventory((prev) => prev.find((i) => i.id === row.id) ? prev : [mapIngredient(row), ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ingredients" }, ({ new: row }) => {
        setInventory((prev) => prev.map((i) => i.id === row.id ? mapIngredient(row) : i));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "ingredients" }, ({ old: row }) => {
        setInventory((prev) => prev.filter((i) => i.id !== row.id));
      })
      .subscribe();

    // Real-time: recipes (only name + img — full re-fetch for ingredient/step changes)
    const recipeChannel = supabase
      .channel("rt-recipes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "recipes" }, ({ new: row }) => {
        setRecipes((prev) => prev.map((r) => r.id === row.id ? { ...r, name: row.name, img: row.img, category: row.category, yield: row.yield, time: row.time, description: row.description ?? "", prep_time: row.prep_time ?? "", difficulty: row.difficulty ?? "", price: row.price ?? 0, is_available: row.is_available ?? true } : r));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "recipes" }, () => {
        // Re-fetch to get full recipe with ingredients + steps
        supabase
          .from("recipes")
          .select("*, recipe_ingredients(qty, unit, ingredients(id, name)), recipe_steps(num, title, description, sort_order)")
          .then(({ data }) => { if (data) setRecipes(data.map(mapRecipe)); });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "recipes" }, ({ old: row }) => {
        setRecipes((prev) => prev.filter((r) => r.id !== row.id));
      })
      .subscribe();

    // Real-time: bake_entries
    const bakeChannel = supabase
      .channel("rt-bake-entries")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bake_entries" }, () => {
        supabase.from("bake_entries").select("*, recipes(name, img)").order("created_at", { ascending: false })
          .then(({ data }) => { if (data) setBakeLogs(data.map(mapBakeEntry)); });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bake_entries" }, ({ new: row }) => {
        setBakeLogs((prev) => prev.map((e) => e.id === row.id ? { ...e, status: row.status } : e));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ingChannel);
      supabase.removeChannel(recipeChannel);
      supabase.removeChannel(bakeChannel);
    };
  }, []);

  const currentTab = (() => {
    const p = location.pathname;
    if (p.startsWith("/admin/recipes")) return "recipes";
    if (p.startsWith("/admin/orders")) return "orders";
    if (p.startsWith("/admin/bakelog")) return "bakelog";
    if (p.startsWith("/admin/finance")) return "finance";
    if (p.startsWith("/admin/stats")) return "stats";
    return "inventory";
  })();

  const pickRecipe = (r: Recipe, orderId: string | null = null, orderQty: number | null = null) => {
    setConfirmRecipe(r);
    setConfirmOrderId(orderId);
    setConfirmOrderQty(orderQty);
    setShowPicker(false);
    navigate("/admin/recipes/confirm");
  };

  const handleLogBake = (entry: BakeEntry) => {
    setBakeLogs((prev) => [entry, ...prev]);
    navigate("/admin/bakelog");
  };

  const mobileNavMain = [
    { id: "inventory", path: "/admin/inventory", icon: "inventory_2", label: "Stock" },
    { id: "recipes",   path: "/admin/recipes",   icon: "menu_book",  label: "Recipes" },
    { id: "orders",    path: "/admin/orders",    icon: "assignment", label: "Orders" },
    { id: "bakelog",   path: "/admin/bakelog",   icon: "history_edu",label: "Log" },
  ];
  const mobileNavMore = [
    { id: "finance",   path: "/admin/finance",   icon: "wallet",     label: "Finance" },
    { id: "stats",     path: "/admin/stats",     icon: "query_stats",label: "Stats" },
  ];

  return (
    <div className="flex min-h-screen bg-surface text-on-surface" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <Sidebar currentTab={currentTab} setCurrentTab={(tab) => navigate(`/admin/${tab}`)} onNewProduction={() => setShowPicker(true)} />

      <main className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0" style={{ paddingBottom: 'max(4rem, env(safe-area-inset-bottom, 0px) + 4rem)' }}>
        <Routes>
          <Route index element={<Navigate to="inventory" replace />} />

          <Route path="inventory" element={
            <InventoryDashboard
              ingredients={inventory}
              onAddIngredient={(ing) => setInventory((prev) => [ing, ...prev])}
              onViewIngredient={(id) => navigate(`/admin/inventory/${id}`)}
              onDeleteIngredient={(id) => setInventory((prev) => prev.filter((i) => i.id !== id))}
            />
          } />
          <Route path="inventory/adjust" element={<StockAdjustment onBack={() => navigate(-1)} />} />
          <Route path="inventory/:id" element={
            <IngredientDetail onBack={() => navigate("/admin/inventory")} />
          } />

          <Route path="recipes" element={
            <RecipesList
              recipes={recipes}
              inventory={inventory}
              onAddRecipe={(r) => setRecipes((prev) => [r, ...prev])}
              onViewRecipe={(r) => { setSelectedRecipe(r); navigate("/admin/recipes/builder"); }}
              onDeleteRecipe={(id) => setRecipes((prev) => prev.filter((r) => r.id !== id))}
            />
          } />
          <Route path="recipes/builder" element={
            selectedRecipe
              ? <RecipeBuilder recipe={selectedRecipe} inventory={inventory} onBack={() => navigate("/admin/recipes")} />
              : <Navigate to="/admin/recipes" replace />
          } />
          <Route path="recipes/confirm" element={
            confirmRecipe
              ? <BakeConfirmation recipe={confirmRecipe} inventory={inventory} orderId={confirmOrderId} orderQty={confirmOrderQty ?? undefined} onBack={() => { setShowPicker(true); navigate("/admin/recipes"); }} onLogBake={handleLogBake} />
              : <Navigate to="/admin/recipes" replace />
          } />

          <Route path="orders" element={
            <AdminOrders onStartBake={(recipeId, orderId, orderQty) => {
              const r = recipes.find((x) => x.id === recipeId);
              if (r) pickRecipe(r, orderId, orderQty);
            }} />
          } />
          <Route path="bakelog" element={<BakeLog entries={bakeLogs} />} />
          <Route path="stats" element={<Stats />} />
          <Route path="finance" element={<FinanceDashboard />} />
        </Routes>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 bg-surface-bright border-t border-outline-variant/10 shadow-sm" style={{ height: 64 }}>
        <div className="flex justify-around items-center px-2 h-full">
          {mobileNavMain.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button key={item.id} onClick={() => { setShowMore(false); navigate(item.path); }} className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-all min-w-0 ${isActive ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant"}`}>
                <Icon name={item.icon} size={20} />
                <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setShowMore((v) => !v)}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-all min-w-0 ${showMore ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant"}`}
          >
            <Icon name="menu" size={20} />
            <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* More drawer — slides up from bottom */}
      {showMore && (
        <>
          <div className="lg:hidden fixed inset-0 z-[60]" onClick={() => setShowMore(false)} />
          <div className="lg:hidden fixed bottom-16 left-0 w-full z-[70] bg-surface-container-lowest border-t border-outline-variant/20 rounded-t-2xl shadow-2xl pb-2 animate-[slideUp_0.18s_ease-out]">
            <div className="w-10 h-1 bg-outline-variant/40 rounded-full mx-auto mt-3 mb-3" />
            <div className="px-4 pb-2 space-y-1">
              {/* New Production */}
              <button
                onClick={() => { setShowMore(false); setShowPicker(true); }}
                className="w-full flex items-center gap-4 px-4 h-14 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-90 active:scale-95 transition-all"
              >
                <Icon name="add" size={20} strokeWidth={2.5} />
                New Production
              </button>

              {mobileNavMore.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setShowMore(false); navigate(item.path); }}
                    className={`w-full flex items-center gap-4 px-4 h-14 rounded-xl text-sm font-semibold transition-all ${isActive ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant hover:bg-surface-container"}`}
                  >
                    <Icon name={item.icon} size={20} />
                    {item.label}
                  </button>
                );
              })}

              <button
                onClick={async () => { setShowMore(false); await supabase.auth.signOut(); navigate("/"); }}
                className="w-full flex items-center gap-4 px-4 h-14 rounded-xl text-sm font-semibold text-error hover:bg-error-container/30 transition-all"
              >
                <Icon name="logout" size={20} />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {showPicker && <RecipePickerModal recipes={recipes} onSelect={pickRecipe} onClose={() => setShowPicker(false)} />}
    </div>
  );
}

// ── Public shell ──────────────────────────────────────────────

function PublicShell() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("avelinas_cart_v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [pendingRecipe, setPendingRecipe] = useState<Recipe | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const currentUser = session
    ? {
        name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User",
        email: session.user.email || "",
      }
    : null;

  // Auth listener
  useEffect(() => {
    const redirectByRole = async (session: Session | null) => {
      if (!session) return;
      const { data } = await supabase.from("users").select("id, role").eq("id", session.user.id).single();
      if (!data) {
        navigate("/profile/setup");
      } else if (data.role === "admin") {
        navigate("/admin");
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      redirectByRole(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "SIGNED_IN") {
        redirectByRole(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Persist cart to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem("avelinas_cart_v1", JSON.stringify(cart)); } catch {}
  }, [cart]);

  // Load profile whenever session changes
  useEffect(() => {
    if (!session) { setProfile(null); setProfileLoading(false); return; }
    setProfileLoading(true);
    supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile({ name: data.name, email: session.user.email || "", phone: data.phone, address: data.address });
        setProfileLoading(false);
      });
  }, [session]);

  const handleLogin = async (_user: { name: string; email: string }) => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s) return;

    const { data: profileData } = await supabase
      .from("users").select("id, role").eq("id", s.user.id).single();

    if (!profileData) {
      navigate("/profile/setup");
    } else if (profileData.role === "admin") {
      navigate("/admin");
    } else if (pendingRecipe) {
      addToCart(pendingRecipe);
      setPendingRecipe(null);
      navigate("/cart");
    } else {
      navigate("/");
    }
  };

  const handleProfileSave = (p: UserProfile) => {
    setProfile(p);
    if (pendingRecipe) {
      addToCart(pendingRecipe);
      setPendingRecipe(null);
      navigate("/cart");
    } else {
      navigate("/");
    }
  };

  const addToCart = (recipe: Recipe) => {
    setCart((prev) => {
      const existing = prev.findIndex((item) => item.recipe.id === recipe.id);
      if (existing >= 0) {
        return prev.map((item, i) => i === existing ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { recipe, qty: 1, date: "" }];
    });
  };

  const handlePreOrder = (recipe: Recipe) => {
    if (!currentUser) {
      setPendingRecipe(recipe);
      navigate("/login");
    } else if (!profile) {
      setPendingRecipe(recipe);
      navigate("/profile/setup");
    } else {
      addToCart(recipe);
    }
  };

  const handlePlaceOrder = (order: Order) => {
    setLastOrder(order);
    setCart([]);
    try { localStorage.removeItem("avelinas_cart_v1"); } catch {}
    navigate("/order-confirmed");
  };

  return (
    <Routes>
      <Route path="/" element={<PublicHome onPreOrder={handlePreOrder} currentUser={currentUser} cartCount={cart.length} />} />
      <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
      <Route path="/profile/setup" element={
        currentUser
          ? <ProfileSetup user={currentUser} onSave={handleProfileSave} />
          : <Navigate to="/login" replace />
      } />
      <Route path="/cart" element={
        profileLoading
          ? <div className="min-h-screen bg-[#fff8f5] flex items-center justify-center"><p className="text-sm text-[#26170c]/40">Loading…</p></div>
          : !session
            ? <Navigate to="/login" replace />
            : !profile
              ? <Navigate to="/profile/setup" replace />
              : <CartPage
                  cart={cart}
                  profile={profile}
                  onUpdateQty={(i, qty) => setCart((prev) => prev.map((item, idx) => idx === i ? { ...item, qty } : item))}
                  onUpdateDate={(i, date) => setCart((prev) => prev.map((item, idx) => idx === i ? { ...item, date } : item))}
                  onRemove={(i) => setCart((prev) => prev.filter((_, idx) => idx !== i))}
                  onCheckout={() => navigate("/checkout")}
                />
      } />
      <Route path="/checkout" element={
        profileLoading
          ? <div className="min-h-screen bg-[#fff8f5] flex items-center justify-center"><p className="text-sm text-[#26170c]/40">Loading…</p></div>
          : !session
            ? <Navigate to="/login" replace />
            : !profile
              ? <Navigate to="/profile/setup" replace />
              : cart.length === 0
                ? <Navigate to="/cart" replace />
                : <CheckoutPage
                    cart={cart}
                    profile={profile}
                    userId={session.user.id}
                    onUpdateQty={(i, qty) => setCart((prev) => prev.map((item, idx) => idx === i ? { ...item, qty } : item))}
                    onUpdateDate={(i, date) => setCart((prev) => prev.map((item, idx) => idx === i ? { ...item, date } : item))}
                    onPlaceOrder={handlePlaceOrder}
                  />
      } />
      <Route path="/order-confirmed" element={<OrderConfirmed order={lastOrder} />} />
      <Route path="/orders" element={<OrdersPage profile={profile} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminShell />} />
        <Route path="/*" element={<PublicShell />} />
      </Routes>
    </BrowserRouter>
  );
}
