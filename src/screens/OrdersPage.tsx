import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { Order } from "./CheckoutPage.tsx";
import { UserProfile } from "./ProfileSetup.tsx";
import { supabase } from "../lib/supabase.ts";

interface Props {
  profile: UserProfile | null;
}

const statusColor = (s: Order["status"]) => {
  if (s === "completed") return "bg-[#d4e8ce] text-[#26170c]";
  if (s === "ready") return "bg-[#ffddb9] text-[#26170c]";
  if (s === "confirmed") return "bg-blue-100 text-blue-800";
  return "bg-[#26170c]/10 text-[#26170c]/70";
};

const statusLabel = (s: Order["status"]) => {
  if (s === "completed") return "Completed";
  if (s === "ready") return "Ready for Pickup";
  if (s === "confirmed") return "Confirmed";
  return "Pending";
};

export default function OrdersPage({ profile }: Props) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("orders")
      .select("*, order_items(qty, pickup_date, recipes(*))")
      .order("placed_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setOrders(data.map((o) => ({
            id: o.id,
            placedAt: o.placed_at,
            status: o.status,
            profile: profile || { name: "", email: "", phone: "", address: "" },
            items: (o.order_items || []).map((item: any) => ({
              recipe: item.recipes,
              qty: item.qty,
              date: item.pickup_date,
            })),
          })));
        }
        setLoading(false);
      });
  }, []);

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
        {profile && (
          <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#26170c]/8">
            <div className="w-9 h-9 rounded-full bg-[#26170c] flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">{profile.name.slice(0, 2).toUpperCase()}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#26170c]">{profile.name}</p>
              <p className="text-xs text-[#26170c]/50">{profile.email}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-[#26170c]/40 text-sm">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="py-24 text-center">
            <Icon name="assignment" size={48} className="mx-auto mb-4 text-[#26170c]/20" />
            <p className="text-[#26170c]/50 text-sm mb-4">No orders yet</p>
            <button onClick={() => navigate("/")} className="px-6 h-10 rounded-xl bg-[#26170c] text-white text-sm font-semibold hover:opacity-90 transition-all">
              Browse Menu
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
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                      <img src={item.recipe.img} alt={item.recipe.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#26170c]">{item.recipe.name}</p>
                      <p className="text-xs text-[#26170c]/50">x{item.qty} · Pickup {item.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
