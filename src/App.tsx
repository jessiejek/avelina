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

function mapIngredient(d: any): Ingredient {
  return {
    id: d.id, name: d.name, sku: d.sku,
    stock: `${d.stock_value} ${d.unit}`,
    stockValue: d.stock_value,
    unit: d.unit, status: d.status, icon: d.icon, img: d.img,
  };
}

function mapRecipe(r: any): Recipe {
  return {
    id: r.id, name: r.name, category: r.category,
    yield: r.yield, time: r.time, img: r.img,
    description: r.description ?? "", prep_time: r.prep_time ?? "", difficulty: r.difficulty ?? "",
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
    qty: d.qty,
    status: d.status,
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
  const [showPicker, setShowPicker] = useState(false);

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
        setRecipes((prev) => prev.map((r) => r.id === row.id ? { ...r, name: row.name, img: row.img, category: row.category, yield: row.yield, time: row.time, description: row.description ?? "", prep_time: row.prep_time ?? "", difficulty: row.difficulty ?? "" } : r));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "recipes" }, () => {
        // Re-fetch to get full recipe with ingredients + steps
        supabase
          .from("recipes")
          .select("*, recipe_ingredients(qty, unit, ingredients(id, name)), recipe_steps(num, title, description, sort_order)")
          .then(({ data }) => { if (data) setRecipes(data.map(mapRecipe)); });
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
    if (p.startsWith("/admin/bakelog")) return "bakelog";
    if (p.startsWith("/admin/stats")) return "stats";
    return "inventory";
  })();

  const pickRecipe = (r: Recipe) => {
    setConfirmRecipe(r);
    setShowPicker(false);
    navigate("/admin/recipes/confirm");
  };

  const handleLogBake = (entry: BakeEntry) => {
    setBakeLogs((prev) => [entry, ...prev]);
    navigate("/admin/bakelog");
  };

  const mobileNavItems = [
    { id: "inventory", path: "/admin/inventory", icon: "inventory_2", label: "Inventory" },
    { id: "recipes", path: "/admin/recipes", icon: "menu_book", label: "Recipes" },
    { id: "bakelog", path: "/admin/bakelog", icon: "history_edu", label: "Log" },
    { id: "stats", path: "/admin/stats", icon: "query_stats", label: "Stats" },
  ];

  return (
    <div className="flex min-h-screen bg-surface text-on-surface" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <Sidebar currentTab={currentTab} setCurrentTab={(tab) => navigate(`/admin/${tab}`)} onNewProduction={() => setShowPicker(true)} />

      <main className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <Routes>
          <Route index element={<Navigate to="inventory" replace />} />

          <Route path="inventory" element={
            <InventoryDashboard
              ingredients={inventory}
              onAddIngredient={(ing) => setInventory((prev) => [ing, ...prev])}
              onViewIngredient={(id) => navigate(`/admin/inventory/${id}`)}
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
            />
          } />
          <Route path="recipes/builder" element={
            selectedRecipe
              ? <RecipeBuilder recipe={selectedRecipe} inventory={inventory} onBack={() => navigate("/admin/recipes")} />
              : <Navigate to="/admin/recipes" replace />
          } />
          <Route path="recipes/confirm" element={
            confirmRecipe
              ? <BakeConfirmation recipe={confirmRecipe} inventory={inventory} onBack={() => { setShowPicker(true); navigate("/admin/recipes"); }} onLogBake={handleLogBake} />
              : <Navigate to="/admin/recipes" replace />
          } />

          <Route path="bakelog" element={<BakeLog entries={bakeLogs} />} />
          <Route path="stats" element={<Stats />} />
        </Routes>
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-surface-bright border-t border-outline-variant/10 shadow-sm">
        {mobileNavItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button key={item.id} onClick={() => navigate(item.path)} className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-all ${isActive ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant"}`}>
              <Icon name={item.icon} size={22} />
              <span className="text-[10px] font-semibold uppercase tracking-wide">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-all text-on-surface-variant hover:text-error"
        >
          <Icon name="logout" size={22} />
          <span className="text-[10px] font-semibold uppercase tracking-wide">Sign Out</span>
        </button>
      </nav>

      {/* Mobile FAB — New Production (hidden on confirm page) */}
      {!location.pathname.includes("/recipes/confirm") && (
        <button
          onClick={() => setShowPicker(true)}
          className="lg:hidden fixed bottom-20 right-4 z-50 flex items-center gap-2 px-4 h-12 rounded-full bg-primary text-on-primary font-bold text-sm shadow-lg active:scale-95 transition-all"
        >
          <Icon name="add" size={20} />
          New Production
        </button>
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pendingRecipe, setPendingRecipe] = useState<Recipe | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

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

  // Load profile whenever session changes
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile({ name: data.name, email: session.user.email || "", phone: data.phone, address: data.address });
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
        profile
          ? <CartPage
              cart={cart}
              profile={profile}
              onUpdateQty={(i, qty) => setCart((prev) => prev.map((item, idx) => idx === i ? { ...item, qty } : item))}
              onUpdateDate={(i, date) => setCart((prev) => prev.map((item, idx) => idx === i ? { ...item, date } : item))}
              onRemove={(i) => setCart((prev) => prev.filter((_, idx) => idx !== i))}
              onCheckout={() => navigate("/checkout")}
            />
          : <Navigate to="/login" replace />
      } />
      <Route path="/checkout" element={
        profile && cart.length > 0
          ? <CheckoutPage
              cart={cart}
              profile={profile}
              userId={session?.user.id ?? ""}
              onUpdateQty={(i, qty) => setCart((prev) => prev.map((item, idx) => idx === i ? { ...item, qty } : item))}
              onUpdateDate={(i, date) => setCart((prev) => prev.map((item, idx) => idx === i ? { ...item, date } : item))}
              onPlaceOrder={handlePlaceOrder}
            />
          : <Navigate to="/cart" replace />
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
