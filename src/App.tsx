import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase.ts";
import Sidebar from "./components/Sidebar.tsx";
import AdminOrders from "./screens/AdminOrders.tsx";
import ProductsList from "./screens/ProductsList.tsx";
import PublicHome from "./screens/PublicHome.tsx";
import LoginPage from "./screens/LoginPage.tsx";
import CartPage, { CartItem } from "./screens/CartPage.tsx";
import CheckoutPage, { Order, GuestInfo } from "./screens/CheckoutPage.tsx";
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

const emptyGuest: GuestInfo = { name: "", phone: "", social: "", address: "", fulfillment: "pickup" };

function rememberOrderId(id: string) {
  try {
    const raw = localStorage.getItem("majalditas_orders_v1");
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(id)) localStorage.setItem("majalditas_orders_v1", JSON.stringify([id, ...ids]));
  } catch {}
}

function PublicShell() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("avelinas_cart_v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [guest, setGuest] = useState<GuestInfo>(() => {
    try {
      const saved = localStorage.getItem("majalditas_guest_v1");
      return saved ? { ...emptyGuest, ...JSON.parse(saved) } : emptyGuest;
    } catch {
      return emptyGuest;
    }
  });
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  const currentUser = session
    ? {
        name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User",
        email: session.user.email || "",
      }
    : null;

  // Only job of auth here: bounce admins to the dashboard.
  useEffect(() => {
    const checkAdmin = async (s: Session | null) => {
      if (!s) return;
      const { data } = await supabase.from("users").select("role").eq("id", s.user.id).single();
      if (data?.role === "admin") navigate("/admin");
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      checkAdmin(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setAuthLoading(false);
      if (event === "SIGNED_IN") checkAdmin(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    try { localStorage.setItem("avelinas_cart_v1", JSON.stringify(cart)); } catch {}
  }, [cart]);

  useEffect(() => {
    try { localStorage.setItem("majalditas_guest_v1", JSON.stringify(guest)); } catch {}
  }, [guest]);

  const addToCart = (recipe: Recipe) => {
    setCart((prev) => {
      const existing = prev.findIndex((item) => item.recipe.id === recipe.id);
      if (existing >= 0) {
        return prev.map((item, i) => i === existing ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { recipe, qty: 1 }];
    });
  };

  const handleLogin = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s) { navigate("/"); return; }
    const { data } = await supabase.from("users").select("role").eq("id", s.user.id).single();
    if (data?.role === "admin") { navigate("/admin"); return; }
    navigate(cart.length > 0 ? "/cart" : "/");
  };

  const handlePlaceOrder = (order: Order) => {
    rememberOrderId(order.id);
    setLastOrder(order);
    setCart([]);
    try { localStorage.removeItem("avelinas_cart_v1"); } catch {}
    navigate("/order-confirmed");
  };

  const updateQty = (i: number, qty: number) => setCart((prev) => prev.map((item, idx) => idx === i ? { ...item, qty } : item));

  return (
    <Routes>
      <Route path="/" element={<PublicHome onPreOrder={addToCart} currentUser={currentUser} cartCount={cart.length} />} />
      <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
      <Route path="/profile/setup" element={<Navigate to="/" replace />} />
      <Route path="/cart" element={
        <CartPage
          cart={cart}
          onUpdateQty={updateQty}
          onRemove={(i) => setCart((prev) => prev.filter((_, idx) => idx !== i))}
          onCheckout={() => navigate(session ? "/checkout" : "/login")}
        />
      } />
      <Route path="/checkout" element={
        authLoading
          ? null
          : !session
          ? <Navigate to="/login" replace />
          : cart.length === 0
          ? <Navigate to="/cart" replace />
          : <CheckoutPage
              cart={cart}
              guest={guest}
              userId={session.user.id}
              onSaveGuest={setGuest}
              onUpdateQty={updateQty}
              onPlaceOrder={handlePlaceOrder}
            />
      } />
      <Route path="/order-confirmed" element={<OrderConfirmed order={lastOrder} />} />
      <Route path="/orders" element={<OrdersPage />} />
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
