import React, { useEffect, useState } from "react";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";

type OrderStatus = "pending" | "confirmed" | "baking" | "ready" | "completed" | "cancelled";

interface AdminOrderItem {
  id: string;
  name: string;
  img: string;
  qty: number;
  unitPrice: number;
}

interface AdminOrder {
  id: string;
  placedAt: string;
  status: OrderStatus;
  fulfillmentType: "pickup" | "delivery";
  notes: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: AdminOrderItem[];
}

const isDoneStatus = (s: OrderStatus) => s === "completed" || s === "cancelled";

const statusStyle = (s: OrderStatus) => {
  if (s === "completed") return "bg-secondary text-white";
  if (s === "cancelled") return "bg-error-container text-on-error-container";
  return "bg-primary-container text-on-primary-fixed";
};

const statusLabel = (s: OrderStatus) => {
  if (s === "completed") return "Done";
  if (s === "cancelled") return "Cancelled";
  return "Active";
};

function mapOrder(o: any): AdminOrder {
  return {
    id: o.id,
    placedAt: o.placed_at,
    status: o.status,
    fulfillmentType: o.fulfillment_type === "delivery" ? "delivery" : "pickup",
    notes: o.notes ?? null,
    customerName: o.users?.name || o.customer_name || "Walk-in customer",
    customerPhone: o.users?.phone || o.customer_phone || "",
    customerAddress: o.delivery_address || o.users?.address || "",
    items: (o.order_items || []).map((it: any) => ({
      id: it.id || "",
      name: it.recipes?.name || "—",
      img: it.recipes?.img || "",
      qty: it.qty,
      unitPrice: it.unit_price ?? it.recipes?.price ?? 0,
    })),
  };
}

const SELECT = "*, users(name, phone, address), order_items(id, qty, unit_price, recipes(id, name, img, price))";

type Filter = "all" | "active" | "completed" | "cancelled";

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("active");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [cancelModal, setCancelModal] = useState<AdminOrder | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const fetchOrders = async () => {
    setLoadError("");
    const { data, error } = await supabase.from("orders").select(SELECT).order("placed_at", { ascending: false });

    if (!error && data) {
      const mapped = data.map(mapOrder);
      setOrders(mapped);
      setExpanded(new Set(mapped.filter((o) => !isDoneStatus(o.status)).map((o) => o.id)));
      setLoading(false);
      return;
    }

    // Fallback without the users join (RLS can block it)
    const { data: bare, error: bareErr } = await supabase
      .from("orders")
      .select("*, order_items(id, qty, unit_price, recipes(id, name, img, price))")
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
    const mapped = bare.map((o: any) => mapOrder({ ...o, users: usersById[o.user_id] }));
    setOrders(mapped);
    setExpanded(new Set(mapped.filter((o) => !isDoneStatus(o.status)).map((o) => o.id)));
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel("rt-admin-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => fetchOrders())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, ({ new: row }) => {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === row.id
              ? { ...o, status: row.status as OrderStatus, fulfillmentType: row.fulfillment_type === "delivery" ? "delivery" : "pickup" }
              : o
          )
        );
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, ({ old: row }) => {
        setOrders((prev) => prev.filter((o) => o.id !== row.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const markDone = async (order: AdminOrder) => {
    setUpdatingId(order.id);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "completed" } : o)));
    const { error } = await supabase
      .from("orders")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", order.id);
    if (error) setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: order.status } : o)));
    setUpdatingId(null);
  };

  const toggleFulfillment = async (order: AdminOrder) => {
    const next: "pickup" | "delivery" = order.fulfillmentType === "pickup" ? "delivery" : "pickup";
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, fulfillmentType: next } : o)));
    await supabase.from("orders").update({ fulfillment_type: next }).eq("id", order.id);
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    setCancelling(true);
    await supabase
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", cancelModal.id);
    setOrders((prev) => prev.map((o) => (o.id === cancelModal.id ? { ...o, status: "cancelled" } : o)));
    setCancelling(false);
    setCancelModal(null);
  };

  const counts = {
    all: orders.length,
    active: orders.filter((o) => !isDoneStatus(o.status)).length,
    completed: orders.filter((o) => o.status === "completed").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  const visible =
    filter === "all"
      ? orders
      : filter === "active"
      ? orders.filter((o) => !isDoneStatus(o.status))
      : orders.filter((o) => o.status === filter);

  const chips: { id: Filter; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "completed", label: "Done" },
    { id: "cancelled", label: "Cancelled" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <h1 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Orders</h1>
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <span className="text-[11px] font-bold text-on-primary">MJ</span>
        </div>
      </header>

      <div className="p-4 lg:p-8 max-w-4xl mx-auto w-full space-y-4">
        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap">
          {chips.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filter === c.id ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {c.label} <span className="opacity-60">{counts[c.id]}</span>
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
            <p className="text-sm text-on-surface-variant">No {filter === "all" ? "" : filter + " "}orders.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((order) => {
              const total = order.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
              const isOpen = expanded.has(order.id);
              const done = isDoneStatus(order.status);

              return (
                <div
                  key={order.id}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    done ? "border-outline-variant/10 bg-surface-container-lowest/50 opacity-75" : "border-outline-variant/20 bg-surface-container-lowest shadow-sm"
                  }`}
                >
                  {/* Header row */}
                  <div
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-container/40 transition-colors ${isOpen ? "border-b border-outline-variant/10" : ""}`}
                    onClick={() => toggleExpand(order.id)}
                  >
                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${statusStyle(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                    <span className="font-bold text-primary font-mono text-sm shrink-0">#{order.id}</span>
                    <span className="text-sm text-on-surface-variant truncate flex-1">{order.customerName}</span>
                    <span className="font-bold text-primary font-mono text-sm shrink-0">{peso(total)}</span>
                    <span className={`shrink-0 hidden sm:flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      order.fulfillmentType === "delivery"
                        ? "bg-tertiary-fixed border-on-tertiary-container/30 text-on-tertiary-fixed-variant"
                        : "bg-surface-container-high border-outline-variant/30 text-on-surface-variant"
                    }`}>
                      <Icon name={order.fulfillmentType === "delivery" ? "local_shipping" : "storefront"} size={10} />
                      {order.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}
                    </span>
                    {!done && !isOpen && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markDone(order); }}
                        disabled={updatingId === order.id}
                        className="shrink-0 h-9 px-4 rounded-lg bg-primary text-on-primary text-xs font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Icon name="check_circle" size={13} />
                        {updatingId === order.id ? "…" : "Mark Done"}
                      </button>
                    )}
                    <Icon name={isOpen ? "expand_less" : "expand_more"} size={18} className="shrink-0 text-on-surface-variant" />
                  </div>

                  {/* Detail */}
                  {isOpen && (
                    <div className="p-4 space-y-4">
                      <div className="flex items-center gap-3 text-xs text-on-surface-variant flex-wrap">
                        <span className="flex items-center gap-1">
                          <Icon name="schedule" size={12} />
                          {new Date(order.placedAt).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <button
                          onClick={() => toggleFulfillment(order)}
                          disabled={done}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-outline-variant/40 hover:bg-surface-container transition-colors disabled:opacity-50"
                        >
                          <Icon name="sync_alt" size={11} />
                          Switch to {order.fulfillmentType === "delivery" ? "Pickup" : "Delivery"}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Customer */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Customer</p>
                          <p className="text-sm font-semibold text-primary">{order.customerName}</p>
                          {order.customerPhone && (
                            <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
                              <Icon name="call" size={12} /> {order.customerPhone}
                            </p>
                          )}
                          {order.fulfillmentType === "delivery" && (
                            <p className="text-xs text-on-surface-variant flex items-start gap-1.5">
                              <Icon name="location_on" size={12} className="shrink-0 mt-0.5" />
                              {order.customerAddress || <span className="italic opacity-60">No address on file</span>}
                            </p>
                          )}
                          {order.notes && (
                            <div className="text-xs text-on-surface-variant bg-surface-container rounded-lg px-3 py-2">
                              <span className="font-semibold">Note:</span> {order.notes}
                            </div>
                          )}
                        </div>

                        {/* Items */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Items</p>
                          {order.items.length === 0 && (
                            <p className="text-xs text-error">No items recorded for this order.</p>
                          )}
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-surface-container">
                                {item.img && <img src={item.img} alt={item.name} className="w-full h-full object-cover" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-primary truncate">{item.name}</p>
                              </div>
                              <span className="text-sm font-bold text-primary font-mono shrink-0">×{item.qty}</span>
                              <span className="text-xs text-on-surface-variant font-mono shrink-0">{peso(item.unitPrice * item.qty)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {!done && (
                        <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
                          <button
                            onClick={() => setCancelModal(order)}
                            className="h-9 px-4 rounded-lg border border-error/30 text-error text-sm font-semibold hover:bg-error-container/30 active:scale-95 transition-all flex items-center gap-1.5"
                          >
                            <Icon name="cancel" size={14} /> Cancel
                          </button>
                          <button
                            onClick={() => markDone(order)}
                            disabled={updatingId === order.id}
                            className="h-10 px-6 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                          >
                            <Icon name="check_circle" size={15} />
                            {updatingId === order.id ? "Saving…" : "Mark Done"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cancelModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(29,27,26,0.5)" }}
          onClick={() => !cancelling && setCancelModal(null)}
        >
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-full max-w-sm shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center mb-4">
              <Icon name="cancel" size={22} className="text-on-error-container" />
            </div>
            <h3 className="font-bold text-primary text-lg" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
              Cancel Order #{cancelModal.id}?
            </h3>
            <p className="text-sm text-on-surface-variant mt-2">This order will be marked as cancelled.</p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setCancelModal(null)}
                disabled={cancelling}
                className="px-5 h-10 rounded-lg border border-outline text-primary text-sm font-semibold hover:bg-surface-container transition-colors disabled:opacity-40"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-5 h-10 rounded-lg bg-error text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-2"
              >
                {cancelling ? "Cancelling…" : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
