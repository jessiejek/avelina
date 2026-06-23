import React, { useEffect, useState } from "react";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";

type OrderStatus = "pending" | "confirmed" | "baking" | "ready" | "completed";

interface Props {
  onStartBake: (recipeId: string, orderId: string) => void;
}

interface AdminOrderItem {
  recipeId: string;
  name: string;
  img: string;
  qty: number;
  pickupDate: string;
  unitPrice: number;
}

interface AdminOrder {
  id: string;
  placedAt: string;
  status: OrderStatus;
  notes: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: AdminOrderItem[];
}

const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "baking", "ready", "completed"];

const NEXT_ACTION: Record<OrderStatus, { next: OrderStatus; label: string } | null> = {
  pending: { next: "confirmed", label: "Confirm" },
  confirmed: { next: "ready", label: "Mark Ready" },
  baking: { next: "ready", label: "Mark Ready" },
  ready: { next: "completed", label: "Complete" },
  completed: null,
};

const statusStyle = (s: OrderStatus) => {
  if (s === "completed") return "bg-secondary text-white";
  if (s === "ready") return "bg-secondary-container text-on-secondary-container";
  if (s === "baking") return "bg-tertiary-fixed text-on-tertiary-fixed-variant";
  if (s === "confirmed") return "bg-primary-container text-on-primary-fixed";
  return "bg-surface-container-high text-on-surface-variant";
};

const statusLabel = (s: OrderStatus) => {
  if (s === "completed") return "Completed";
  if (s === "ready") return "Ready for Pickup";
  if (s === "baking") return "Baking";
  if (s === "confirmed") return "Confirmed";
  return "Pending";
};

function mapOrder(o: any): AdminOrder {
  return {
    id: o.id,
    placedAt: o.placed_at,
    status: o.status,
    notes: o.notes ?? null,
    customerName: o.users?.name || "Unknown customer",
    customerPhone: o.users?.phone || "",
    customerAddress: o.users?.address || "",
    items: (o.order_items || []).map((it: any) => ({
      recipeId: it.recipes?.id || "",
      name: it.recipes?.name || "—",
      img: it.recipes?.img || "",
      qty: it.qty,
      pickupDate: it.pickup_date,
      unitPrice: it.unit_price ?? it.recipes?.price ?? 0,
    })),
  };
}

const SELECT = "*, users(name, phone, address), order_items(qty, pickup_date, unit_price, recipes(id, name, img, price))";

export default function AdminOrders({ onStartBake }: Props) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  const fetchOrders = async () => {
    setLoadError("");
    // Try the embedded customer + items query first.
    const { data, error } = await supabase
      .from("orders")
      .select(SELECT)
      .order("placed_at", { ascending: false });

    if (!error && data) {
      setOrders(data.map(mapOrder));
      setLoading(false);
      return;
    }

    // Fallback: the users embed may be failing (missing FK or RLS on users).
    // Fetch orders + items without the users join, then attach customers separately.
    const { data: bare, error: bareErr } = await supabase
      .from("orders")
      .select("*, order_items(qty, pickup_date, unit_price, recipes(id, name, img, price))")
      .order("placed_at", { ascending: false });

    if (bareErr || !bare) {
      setLoadError((error?.message || bareErr?.message || "Failed to load orders") + " — check RLS policies on the orders table.");
      setLoading(false);
      return;
    }

    const userIds = Array.from(new Set(bare.map((o: any) => o.user_id).filter(Boolean)));
    const usersById: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase.from("users").select("id, name, phone, address").in("id", userIds);
      for (const u of users || []) usersById[u.id] = u;
    }
    setOrders(bare.map((o: any) => mapOrder({ ...o, users: usersById[o.user_id] })));
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("rt-admin-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => fetchOrders())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, ({ new: row }) => {
        setOrders((prev) => prev.map((o) => o.id === row.id ? { ...o, status: row.status } : o));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, ({ old: row }) => {
        setOrders((prev) => prev.filter((o) => o.id !== row.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const advance = async (order: AdminOrder) => {
    const action = NEXT_ACTION[order.status];
    if (!action) return;
    setUpdatingId(order.id);
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: action.next } : o));
    const { error } = await supabase.from("orders").update({ status: action.next }).eq("id", order.id);
    if (error) {
      // revert on failure
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: order.status } : o));
    }
    setUpdatingId(null);
  };

  const counts = STATUS_FLOW.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {} as Record<OrderStatus, number>);

  const visible = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <h1 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Orders</h1>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
            <Icon name="notifications" size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[11px] font-bold text-on-primary">AV</span>
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-10 max-w-6xl mx-auto w-full space-y-6">
        {/* Status summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {STATUS_FLOW.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? "all" : s)}
              className={`text-left rounded-xl border p-4 transition-all ${
                filter === s ? "border-primary bg-surface-container-low" : "border-outline-variant/20 bg-surface-container-lowest hover:border-outline-variant/50"
              }`}
            >
              <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">{statusLabel(s)}</span>
              <p className="font-bold text-primary font-mono mt-1" style={{ fontSize: 28, lineHeight: 1 }}>{counts[s]}</p>
            </button>
          ))}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 h-8 rounded-full text-xs font-semibold transition-colors ${filter === "all" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}
          >
            All ({orders.length})
          </button>
          {STATUS_FLOW.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 h-8 rounded-full text-xs font-semibold transition-colors ${filter === s ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}
            >
              {statusLabel(s)}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="bg-error-container text-on-error-container p-4 rounded-xl flex items-start gap-3 border border-error/20">
            <Icon name="warning" size={20} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-sm">Could not load orders</p>
              <p className="text-xs mt-0.5 opacity-80 break-words font-mono">{loadError}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-on-surface-variant text-sm">Loading orders…</div>
        ) : visible.length === 0 ? (
          <div className="py-24 text-center rounded-xl border-2 border-dashed border-outline-variant/30">
            <Icon name="assignment" size={40} className="mx-auto mb-3 text-outline/40" />
            <p className="text-sm text-on-surface-variant">{filter === "all" ? "No orders yet." : `No ${statusLabel(filter as OrderStatus).toLowerCase()} orders.`}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((order) => {
              const action = NEXT_ACTION[order.status];
              const totalItems = order.items.reduce((s, i) => s + i.qty, 0);
              const orderTotal = order.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
              return (
                <div key={order.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
                  {/* Top row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 lg:p-5 border-b border-outline-variant/10 bg-surface-container-low">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-primary font-mono text-sm">#{order.id}</p>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusStyle(order.status)}`}>
                          {statusLabel(order.status)}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {new Date(order.placedAt).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {" · "}{totalItems} item{totalItems !== 1 ? "s" : ""}
                        {" · "}<span className="font-bold text-primary font-mono">{peso(orderTotal)}</span>
                      </p>
                    </div>
                    {action && (
                      <button
                        onClick={() => advance(order)}
                        disabled={updatingId === order.id}
                        className="shrink-0 h-10 px-5 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Icon name="check_circle" size={15} />
                        {updatingId === order.id ? "Saving…" : action.label}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 lg:p-5">
                    {/* Customer */}
                    <div className="lg:col-span-4 space-y-2">
                      <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Customer</p>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-on-primary">{order.customerName.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-primary truncate">{order.customerName}</p>
                          {order.customerPhone && <p className="text-xs text-on-surface-variant truncate">{order.customerPhone}</p>}
                        </div>
                      </div>
                      {order.customerAddress && (
                        <p className="text-xs text-on-surface-variant flex items-start gap-1.5">
                          <Icon name="local_shipping" size={13} className="shrink-0 mt-0.5" /> {order.customerAddress}
                        </p>
                      )}
                      {order.notes && (
                        <div className="text-xs text-on-surface-variant bg-surface-container rounded-lg px-3 py-2 mt-2">
                          <span className="font-semibold">Note:</span> {order.notes}
                        </div>
                      )}
                    </div>

                    {/* Items */}
                    <div className="lg:col-span-8 space-y-2">
                      <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Items</p>
                      <div className="space-y-2">
                        {order.items.map((item, i) => {
                          const canBake = order.status === "confirmed" && !!item.recipeId;
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-container">
                                {item.img && <img src={item.img} alt={item.name} className="w-full h-full object-cover" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-primary truncate">{item.name}</p>
                                <p className="text-xs text-on-surface-variant">Pickup: {item.pickupDate || "—"}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="block text-sm font-bold text-primary font-mono">x{item.qty}</span>
                                <span className="block text-xs text-on-surface-variant font-mono">{peso(item.unitPrice * item.qty)}</span>
                              </div>
                              {canBake && (
                                <button
                                  onClick={() => onStartBake(item.recipeId, order.id)}
                                  className="shrink-0 h-8 px-3 rounded-lg bg-secondary-container text-on-secondary-container text-xs font-bold hover:opacity-80 active:scale-95 transition-all flex items-center gap-1.5"
                                  title="Start a production bake for this item"
                                >
                                  <Icon name="oven_gen" size={13} /> Start Baking
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
