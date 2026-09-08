import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase.ts";
import Sidebar from "./components/Sidebar.tsx";
import AdminOrders from "./screens/AdminOrders.tsx";
import ProductsList from "./screens/ProductsList.tsx";
import PublicHome from "./screens/PublicHome.tsx";
import LoginPage from "./screens/LoginPage.tsx";
import ProfileSetup, { UserProfile } from "./screens/ProfileSetup.tsx";
import CartPage, { CartItem } from "./screens/CartPage.tsx";
import CheckoutPage, { Order } from "./screens/CheckoutPage.tsx";
import OrderConfirmed from "./screens/OrderConfirmed.tsx";
import OrdersPage from "./screens/OrdersPage.tsx";
import Icon from "./components/Icon.tsx";
import { Recipe } from "./data/recipes.ts";

// ── DB → product mapper ───────────────────────────────────────

function mapProduct(r: any): Recipe {
  return {
    id: r.id,
    name: r.name,
    category: r.category ?? "",
    yield: r.yield ?? "",
    time: r.time ?? "",
    img: r.img ?? "",
    description: r.description ?? "",
    prep_time: r.prep_time ?? "",
    difficulty: r.difficulty ?? "",
    price: r.price ?? 0,
    is_available: r.is_available ?? true,
    is_for_sale: r.is_for_sale ?? true,
    finished_shelf_life_days: r.finished_shelf_life_days ?? null,
    ingredients: [],
    steps: [],
  };
}

// ── Admin shell ───────────────────────────────────────────────

function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = () => {
    supabase.from("recipes").select("*").order("name").then(({ data }) => {
      if (data) setProducts(data.map(mapProduct));
      setLoading(false);
    });
  };

  useEffect(() => {
    loadProducts();
    const ch = supabase
      .channel("rt-admin-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "recipes" }, () => loadProducts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const currentTab = location.pathname.startsWith("/admin/orders") ? "orders" : "products";
  const navTo = (tab: string) => navigate(`/admin/${tab}`);

  const navItems = [
    { id: "products", icon: "storefront", label: "Products" },
    { id: "orders", icon: "assignment", label: "Orders" },
  ];

  return (
    <div className="flex min-h-screen bg-surface text-on-surface" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <Sidebar currentTab={currentTab} setCurrentTab={navTo} />

      <main className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0" style={{ paddingBottom: 'max(4rem, env(safe-area-inset-bottom, 0px) + 4rem)' }}>
        <Routes>
          <Route index element={<Navigate to="products" replace />} />
          <Route path="products" element={<ProductsList products={products} loading={loading} onChanged={loadProducts} />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="*" element={<Navigate to="products" replace />} />
        </Routes>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 bg-surface-bright border-t border-outline-variant/10 shadow-sm" style={{ height: 64 }}>
        <div className="flex justify-around items-center px-2 h-full">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button key={item.id} onClick={() => navTo(item.id)} className={`flex flex-col items-center justify-center gap-0.5 px-5 py-1 rounded-xl transition-all min-w-0 ${isActive ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant"}`}>
                <Icon name={item.icon} size={20} />
                <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}
            className="flex flex-col items-center justify-center gap-0.5 px-5 py-1 rounded-xl transition-all min-w-0 text-on-surface-variant"
          >
            <Icon name="logout" size={20} />
            <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">Sign Out</span>
          </button>
        </div>
      </nav>
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
        profileLoading
          ? <div className="min-h-screen bg-[#fff8f5] flex items-center justify-center"><p className="text-sm text-[#26170c]/40">Loading…</p></div>
          : !currentUser
            ? <Navigate to="/login" replace />
            : profile
              ? <Navigate to="/" replace />
              : <ProfileSetup user={currentUser} onSave={handleProfileSave} />
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
