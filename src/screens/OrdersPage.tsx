import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";

type OrderStatus = "pending" | "confirmed" | "baking" | "ready" | "completed" | "cancelled";

interface OrderLine {
  name: string;
  img: string;
  qty: number;
  unitPrice: number;
}

interface OrderView {
  id: string;
  placedAt: string;
  status: OrderStatus;
  items: OrderLine[];
}

const statusColor = (s: OrderStatus) => {
  if (s === "completed") return "bg-[#d4e8ce] text-[#26170c]";
  if (s === "cancelled") return "bg-red-100 text-red-700";
  if (s === "ready") return "bg-[#ffddb9] text-[#26170c]";
  if (s === "baking") return "bg-[#fde0a3] text-[#26170c]";
  if (s === "confirmed") return "bg-blue-100 text-blue-800";
  return "bg-[#26170c]/10 text-[#26170c]/70";
};

const statusLabel = (s: OrderStatus) => {
  if (s === "completed") return "Completed";
  if (s === "cancelled") return "Cancelled";
  if (s === "ready") return "Ready for Pickup";
  if (s === "baking") return "Being Baked";
  if (s === "confirmed") return "Confirmed";
  return "Pending";
};

function mapOrder(o: any): OrderView {
  return {
    id: o.id,
    placedAt: o.placed_at,
    status: o.status,
        items: (o.order_items || []).map((item: any) => ({
      // The product may have been deleted/hidden since: never dereference blindly.
      name: item.recipes?.name ?? "Item no longer available",
      img: item.recipes?.img ?? "",
      qty: Number(item.qty) || 0,
      // Price actually charged at order time, not today's menu price.
      unitPrice: Number(item.unit_price ?? item.recipes?.price ?? 0),
    })),
  };
}

const lineTotal = (o: OrderView) => o.items.reduce((s, it) => s + it.unitPrice * it.qty, 0);

interface Props {
  userId: string | null;
  authLoading: boolean;
}

export default function OrdersPage({ userId, authLoading }: Props) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) { setOrders([]); setLoading(false); return; }

    let cancelled = false;
    const fetchOrders = async () => {
      // RLS only returns the caller's own orders; filter explicitly anyway.
      const { data } = await supabase
        .from("orders")
        .select("id, placed_at, status, order_items(qty, unit_price, recipes(name, img, price))")
        .eq("user_id", userId)
        .order("placed_at", { ascending: false });
      if (cancelled) return;
      if (data) setOrders(data.map(mapOrder));
      setLoading(false);
    };

    setLoading(true);
    fetchOrders();

    const channel = supabase
      .channel(`rt-orders-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `user_id=eq.${userId}` }, () => {
        fetchOrders();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${userId}` }, ({ new: row }) => {
        setOrders((prev) => prev.map((o) => o.id === row.id ? { ...o, status: row.status as OrderStatus } : o));
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userId, authLoading]);

  return (
    <div className="min-h-screen bg-[#fff8f5]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <header className="sticky top-0 z-50 bg-[#fff8f5]/90 backdrop-blur-md border-b border-[#26170c]/10">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#26170c] font-semibold text-sm">
            <Icon name="arrow_back" size={16} /> Menu
          </button>
          <span className="font-bold text-[#26170c]" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>My Orders</span>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        {loading || authLoading ? (
          <div className="py-24 text-center text-[#26170c]/40 text-sm">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="py-24 text-center">
            <Icon name="assignment" size={48} className="mx-auto mb-4 text-[#26170c]/20" />
            <p className="text-[#26170c]/50 text-sm mb-4">{userId ? "No orders yet" : "Log in to see your orders"}</p>
            <button onClick={() => navigate(userId ? "/" : "/login")} className="px-6 h-10 rounded-xl bg-[#26170c] text-white text-sm font-semibold hover:opacity-90 transition-all">
              {userId ? "Browse Menu" : "Log in"}
            </button>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-[#26170c]/8 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#26170c] text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>#{order.id}</p>
                  <p className="text-xs text-[#26170c]/40">{new Date(order.placedAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${statusColor(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
              </div>
              <div className="space-y-2 pt-1 border-t border-[#26170c]/8">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#f4ece5]">
                      {item.img && <img src={item.img} alt={item.name} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#26170c]">{item.name}</p>
                      <p className="text-xs text-[#26170c]/50">x{item.qty}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#26170c] font-mono shrink-0">{peso(item.unitPrice * item.qty)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-[#26170c]/8 text-sm font-bold text-[#26170c]">
                  <span>Total</span>
                  <span className="font-mono">{peso(lineTotal(order))}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
