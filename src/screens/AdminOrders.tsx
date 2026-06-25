import React, { useEffect, useState } from "react";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";
import { returnToFinishedGoods } from "../lib/finishedGoods.ts";

type OrderStatus = "pending" | "confirmed" | "baking" | "ready" | "completed" | "cancelled";

interface Props {
  onStartBake: (recipeId: string, orderId: string, orderQty: number) => void;
}

interface AdminOrderItem {
  id: string;
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
  fulfillmentType: "pickup" | "delivery";
  notes: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  fulfilledQty: number;
  items: AdminOrderItem[];
}

const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "baking", "ready", "completed"];

const NEXT_ACTION: Record<OrderStatus, { next: OrderStatus; label: string } | null> = {
  pending: { next: "confirmed", label: "Confirm" },
  confirmed: null,
  baking: { next: "ready", label: "Ready for Pickup" },
  ready: { next: "completed", label: "Picked Up ✓" },
  completed: null,
  cancelled: null,
};

const statusStyle = (s: OrderStatus) => {
  if (s === "completed") return "bg-secondary text-white";
  if (s === "ready") return "bg-secondary-container text-on-secondary-container";
  if (s === "baking") return "bg-tertiary-fixed text-on-tertiary-fixed-variant";
  if (s === "confirmed") return "bg-primary-container text-on-primary-fixed";
  if (s === "cancelled") return "bg-error-container text-on-error-container";
  return "bg-surface-container-high text-on-surface-variant";
};

const statusLabel = (s: OrderStatus, fulfillmentType?: "pickup" | "delivery") => {
  if (s === "completed") return "Completed";
  if (s === "ready") return fulfillmentType === "delivery" ? "Ready for Delivery" : "Ready for Pickup";
  if (s === "baking") return "Baking";
  if (s === "confirmed") return "Confirmed";
  if (s === "cancelled") return "Cancelled";
  return "Pending";
};

function mapOrder(o: any): AdminOrder {
  return {
    id: o.id,
    placedAt: o.placed_at,
    status: o.status,
    fulfillmentType: o.fulfillment_type === "delivery" ? "delivery" : "pickup",
    notes: o.notes ?? null,
    customerName: o.users?.name || "Unknown customer",
    customerPhone: o.users?.phone || "",
    customerAddress: o.users?.address || "",
    fulfilledQty: o.fulfilled_qty ?? 0,
    items: (o.order_items || []).map((it: any) => ({
      id: it.id || "",
      recipeId: it.recipes?.id || "",
      name: it.recipes?.name || "—",
      img: it.recipes?.img || "",
      qty: it.qty,
      pickupDate: it.pickup_date,
      unitPrice: it.unit_price ?? it.recipes?.price ?? 0,
    })),
  };
}

const SELECT = "*, users(name, phone, address), order_items(id, qty, pickup_date, unit_price, recipes(id, name, img, price))";

export default function AdminOrders({ onStartBake }: Props) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [adminName, setAdminName] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Fix C — cancel modal state
  const [cancelModal, setCancelModal] = useState<AdminOrder | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Fix D — edit qty modal state
  const [editModal, setEditModal] = useState<{ order: AdminOrder; item: AdminOrderItem } | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("users").select("name").eq("id", user.id).single();
      setAdminName(data?.name || user.user_metadata?.name || user.email?.split("@")[0] || "Admin");
    });
  }, []);

  const fetchOrders = async () => {
    setLoadError("");
    const { data, error } = await supabase
      .from("orders")
      .select(SELECT)
      .order("placed_at", { ascending: false });

    if (!error && data) {
      const mapped = data.map(mapOrder);
      setOrders(mapped);
      setExpanded(new Set(mapped.filter((o) => o.status !== "completed" && o.status !== "cancelled").map((o) => o.id)));
      setLoading(false);
      return;
    }

    // Fallback without users join
    const { data: bare, error: bareErr } = await supabase
      .from("orders")
      .select("*, order_items(id, qty, pickup_date, unit_price, recipes(id, name, img, price))")
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
    const mapped2 = bare.map((o: any) => mapOrder({ ...o, users: usersById[o.user_id] }));
    setOrders(mapped2);
    setExpanded(new Set(mapped2.filter((o) => o.status !== "completed" && o.status !== "cancelled").map((o) => o.id)));
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
              ? { ...o, status: row.status as OrderStatus, fulfilledQty: row.fulfilled_qty ?? o.fulfilledQty, fulfillmentType: row.fulfillment_type === "delivery" ? "delivery" : "pickup" }
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

  const advance = async (order: AdminOrder) => {
    const action = NEXT_ACTION[order.status];
    if (!action) return;

    setUpdatingId(order.id);
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: action.next } : o));
    const update: Record<string, any> = { status: action.next };
    if (action.next === "completed") update.completed_at = new Date().toISOString();
    const { error } = await supabase.from("orders").update(update).eq("id", order.id);
    if (error) setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: order.status } : o));
    setUpdatingId(null);
  };

  const toggleFulfillment = async (order: AdminOrder) => {
    const next: "pickup" | "delivery" = order.fulfillmentType === "pickup" ? "delivery" : "pickup";
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, fulfillmentType: next } : o));
    await supabase.from("orders").update({ fulfillment_type: next }).eq("id", order.id);
  };

  // Fix C — cancel order
  const handleCancel = async () => {
    if (!cancelModal) return;
    const order = cancelModal;
    setCancelling(true);
    const cancelledAt = new Date().toISOString();

    if (order.fulfilledQty > 0 && order.items.length > 0) {
      // Fetch total bake cost and original bake timestamp from bake_entries for this order
      const { data: entries } = await supabase
        .from("bake_entries")
        .select("cost, started_at")
        .eq("order_id", order.id);
      const totalBakeCost = (entries || []).reduce((s: number, e: any) => s + (e.cost ?? 0), 0);
      const costPerUnit = totalBakeCost > 0 ? totalBakeCost / order.fulfilledQty : 0;

      // Use the earliest bake's started_at as the original bake timestamp.
      // returnToFinishedGoods will use this to preserve stock age (not reset baked_at to now).
      const originalBakedAt =
        entries && entries.length > 0
          ? entries.reduce((earliest: any, e: any) =>
              !earliest || new Date(e.started_at) < new Date(earliest.started_at) ? e : earliest
            ).started_at ?? null
          : null;

      // Return baked units back to finished goods shelf — baked_at is preserved, not reset.
      const item = order.items[0];
      await returnToFinishedGoods(item.recipeId, order.fulfilledQty, costPerUnit, "units", originalBakedAt);

      // Log production_loss expense
      await supabase.from("expenses").insert({
        category: "production_loss",
        amount: totalBakeCost,
        description: `Order #${order.id} cancelled — ${order.fulfilledQty} units produced returned to shelf`,
        recorded_at: cancelledAt,
      });
    }

    await supabase.from("orders").update({ status: "cancelled", cancelled_at: cancelledAt }).eq("id", order.id);
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: "cancelled" } : o));
    setCancelling(false);
    setCancelModal(null);
  };

  // Fix D — edit order item qty
  const openEditModal = (order: AdminOrder, item: AdminOrderItem) => {
    setEditModal({ order, item });
    setEditQty(String(item.qty));
    setEditError("");
  };

  const handleEditQty = async () => {
    if (!editModal) return;
    const { order, item } = editModal;
    const newQty = parseInt(editQty) || 0;
    const bakingStarted = order.status === "baking" || order.fulfilledQty > 0;

    if (newQty <= 0) { setEditError("Quantity must be at least 1"); return; }
    if (bakingStarted && newQty > item.qty) { setEditError("Baking already started — qty can only decrease"); return; }
    if (newQty < order.fulfilledQty) { setEditError(`Minimum is ${order.fulfilledQty} (already fulfilled)`); return; }
    if (newQty === item.qty) { setEditModal(null); return; }

    setEditSaving(true);
    const editedAt = new Date().toISOString();

    // Update the order_items row
    await supabase.from("order_items").update({ qty: newQty }).eq("id", item.id);

    // Log to order_edit_log
    await supabase.from("order_edit_log").insert({
      order_id: order.id,
      order_item_id: item.id,
      old_qty: item.qty,
      new_qty: newQty,
      edited_by: adminName || "Admin",
      edited_at: editedAt,
    });

    // If new qty is now <= fulfilled_qty, order can advance to ready
    const newStatus: OrderStatus | null = order.fulfilledQty >= newQty && order.status === "baking" ? "ready" : null;
    if (newStatus) await supabase.from("orders").update({ status: newStatus }).eq("id", order.id);

    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              status: newStatus ?? o.status,
              items: o.items.map((i) => (i.id === item.id ? { ...i, qty: newQty } : i)),
            }
          : o
      )
    );

    setEditSaving(false);
    setEditModal(null);
  };

  const allStatuses: OrderStatus[] = [...STATUS_FLOW, "cancelled"];
  const counts = allStatuses.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {} as Record<OrderStatus, number>);

  const visible = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const adminInitials = adminName
    ? adminName.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "AV";

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <h1 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Orders</h1>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
            <Icon name="notifications" size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[11px] font-bold text-on-primary">{adminInitials}</span>
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-5">
        {/* Status summary cards — clickable filter */}
        <div className="grid grid-cols-7 gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={`text-left rounded-xl border p-2 lg:p-3 transition-all ${filter === "all" ? "border-primary bg-surface-container-low ring-1 ring-primary/20" : "border-outline-variant/20 bg-surface-container-lowest hover:border-outline-variant/40"}`}
          >
            <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">All</span>
            <p className="font-bold text-primary font-mono" style={{ fontSize: 20, lineHeight: 1.1 }}>{orders.length}</p>
          </button>
          {allStatuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? "all" : s)}
              className={`text-left rounded-xl border p-2 lg:p-3 transition-all ${filter === s ? "border-primary bg-surface-container-low ring-1 ring-primary/20" : "border-outline-variant/20 bg-surface-container-lowest hover:border-outline-variant/40"}`}
            >
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
                {s === "ready" ? "Ready" : s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              <p className={`font-bold font-mono ${counts[s] > 0 && (s === "pending" || s === "confirmed" || s === "baking") ? "text-primary" : "text-on-surface-variant"}`} style={{ fontSize: 20, lineHeight: 1.1 }}>
                {counts[s]}
              </p>
            </button>
          ))}
        </div>

        {advanceError && (
          <div className="bg-error-container text-on-error-container p-3 rounded-xl flex items-center gap-3 border border-error/20">
            <Icon name="warning" size={18} className="shrink-0" />
            <p className="text-sm">{advanceError}</p>
          </div>
        )}

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
            <p className="text-sm text-on-surface-variant">
              {filter === "all" ? "No orders yet." : `No ${filter} orders.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((order) => {
              const action = NEXT_ACTION[order.status];
              const totalItems = order.items.reduce((s, i) => s + i.qty, 0);
              const orderTotal = order.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
              const canCancel = order.status !== "completed" && order.status !== "cancelled";
              const canEdit = order.status !== "completed" && order.status !== "cancelled";
              const isOpen = expanded.has(order.id);
              const isDone = order.status === "completed" || order.status === "cancelled";

              return (
                <div
                  key={order.id}
                  className={`rounded-xl border overflow-hidden transition-all ${isDone ? "border-outline-variant/10 bg-surface-container-lowest/50 opacity-70" : "border-outline-variant/20 bg-surface-container-lowest shadow-sm"}`}
                >
                  {/* Compact header row — always visible */}
                  <div
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-container/40 transition-colors ${isOpen && !isDone ? "border-b border-outline-variant/10" : ""}`}
                    onClick={() => toggleExpand(order.id)}
                  >
                    {/* Status badge */}
                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${statusStyle(order.status)}`}>
                      {statusLabel(order.status, order.fulfillmentType)}
                    </span>

                    {/* Order ID */}
                    <span className="font-bold text-primary font-mono text-sm shrink-0">#{order.id}</span>

                    {/* Customer name */}
                    <span className="text-sm text-on-surface-variant truncate flex-1">{order.customerName}</span>

                    {/* Items summary */}
                    <span className="hidden sm:block text-xs text-on-surface-variant shrink-0">
                      {order.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}
                    </span>

                    {/* Total */}
                    <span className="font-bold text-primary font-mono text-sm shrink-0">{peso(orderTotal)}</span>

                    {/* Fulfillment badge */}
                    <button
                      onClick={(e) => { e.stopPropagation(); if (!isDone) toggleFulfillment(order); }}
                      disabled={isDone}
                      className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        order.fulfillmentType === "delivery"
                          ? "bg-tertiary-fixed border-on-tertiary-container/30 text-on-tertiary-fixed-variant"
                          : "bg-surface-container-high border-outline-variant/30 text-on-surface-variant"
                      } disabled:cursor-default`}
                    >
                      <Icon name={order.fulfillmentType === "delivery" ? "local_shipping" : "storefront"} size={10} />
                      {order.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}
                    </button>

                    {/* Primary action button — only visible when collapsed */}
                    {action && !isOpen && (
                      <button
                        onClick={(e) => { e.stopPropagation(); advance(order); }}
                        disabled={updatingId === order.id}
                        className="shrink-0 h-9 px-4 rounded-lg bg-primary text-on-primary text-xs font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Icon name="check_circle" size={13} />
                        {updatingId === order.id ? "…" : action.label}
                      </button>
                    )}

                    {/* Expand chevron */}
                    <Icon
                      name={isOpen ? "expand_less" : "expand_more"}
                      size={18}
                      className="shrink-0 text-on-surface-variant transition-transform"
                    />
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="p-4 space-y-4">
                      {/* Meta row */}
                      <div className="flex items-center gap-3 text-xs text-on-surface-variant flex-wrap">
                        <span className="flex items-center gap-1">
                          <Icon name="schedule" size={12} />
                          {new Date(order.placedAt).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {order.status === "baking" && order.fulfilledQty > 0 && (
                          <span className="bg-surface-container-high px-2 py-0.5 rounded-full font-semibold">
                            {order.fulfilledQty}/{totalItems} baked
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Customer */}
                        <div className="lg:col-span-4 space-y-2">
                          <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Customer</p>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <span className="text-[11px] font-bold text-on-primary">{order.customerName.slice(0, 2).toUpperCase()}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-primary truncate">{order.customerName}</p>
                              {order.customerPhone && <p className="text-xs text-on-surface-variant">{order.customerPhone}</p>}
                            </div>
                          </div>
                          {order.customerAddress && (
                            <p className="text-xs text-on-surface-variant flex items-start gap-1.5">
                              <Icon name="location_on" size={12} className="shrink-0 mt-0.5" /> {order.customerAddress}
                            </p>
                          )}
                          {order.notes && (
                            <div className="text-xs text-on-surface-variant bg-surface-container rounded-lg px-3 py-2">
                              <span className="font-semibold">Note:</span> {order.notes}
                            </div>
                          )}
                        </div>

                        {/* Items */}
                        <div className="lg:col-span-8 space-y-2">
                          <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Items</p>
                          <div className="space-y-2">
                            {order.items.map((item, i) => {
                              const canBake =
                                !!item.recipeId &&
                                (order.status === "confirmed" ||
                                  (order.status === "baking" && order.fulfilledQty < totalItems));
                              return (
                                <div key={i} className="flex items-center gap-3 py-1">
                                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-surface-container">
                                    {item.img && <img src={item.img} alt={item.name} className="w-full h-full object-cover" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-primary truncate">{item.name}</p>
                                    <p className="text-xs text-on-surface-variant">Pickup: {item.pickupDate || "—"}</p>
                                  </div>
                                  <span className="text-sm font-bold text-primary font-mono shrink-0">×{item.qty}</span>
                                  <span className="text-xs text-on-surface-variant font-mono shrink-0">{peso(item.unitPrice * item.qty)}</span>
                                  {canEdit && (
                                    <button
                                      onClick={() => openEditModal(order, item)}
                                      className="shrink-0 h-7 px-2 rounded-lg border border-outline-variant/30 text-on-surface-variant text-xs font-semibold hover:bg-surface-container transition-colors flex items-center gap-1"
                                    >
                                      <Icon name="edit" size={11} /> Qty
                                    </button>
                                  )}
                                  {canBake && (
                                    <button
                                      onClick={() => onStartBake(item.recipeId, order.id, item.qty)}
                                      className="shrink-0 h-7 px-3 rounded-lg bg-secondary-container text-on-secondary-container text-xs font-bold hover:opacity-80 active:scale-95 transition-all flex items-center gap-1.5"
                                    >
                                      <Icon name="oven_gen" size={12} /> Start Baking
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Bottom action bar */}
                      {(canCancel || action) && (
                        <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
                          <div>
                            {canCancel && (
                              <button
                                onClick={() => setCancelModal(order)}
                                className="h-9 px-4 rounded-lg border border-error/30 text-error text-sm font-semibold hover:bg-error-container/30 active:scale-95 transition-all flex items-center gap-1.5"
                              >
                                <Icon name="cancel" size={14} /> Cancel Order
                              </button>
                            )}
                          </div>
                          <div>
                            {action && (
                              <button
                                onClick={() => advance(order)}
                                disabled={updatingId === order.id}
                                className="h-10 px-6 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                              >
                                <Icon name="check_circle" size={15} />
                                {updatingId === order.id ? "Saving…" : action.label}
                              </button>
                            )}
                          </div>
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

      {/* Fix C: Cancel confirmation modal */}
      {cancelModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(29,27,26,0.5)" }}
          onClick={() => !cancelling && setCancelModal(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-full max-w-sm shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center mb-4">
              <Icon name="cancel" size={22} className="text-on-error-container" />
            </div>
            <h3 className="font-bold text-primary text-lg" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
              Cancel Order #{cancelModal.id}?
            </h3>
            {cancelModal.fulfilledQty > 0 ? (
              <p className="text-sm text-on-surface-variant mt-2">
                <span className="font-semibold text-primary">{cancelModal.fulfilledQty}</span> unit{cancelModal.fulfilledQty !== 1 ? "s" : ""} have already been baked.
                They will be returned to the finished goods shelf and a production loss expense will be logged.
              </p>
            ) : (
              <p className="text-sm text-on-surface-variant mt-2">
                No baking has started. This order will be marked as cancelled.
              </p>
            )}
            <p className="text-xs text-error mt-3">This action cannot be undone.</p>
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

      {/* Fix D: Edit qty modal */}
      {editModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(29,27,26,0.5)" }}
          onClick={() => !editSaving && setEditModal(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-full max-w-sm shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center mb-4">
              <Icon name="edit" size={22} className="text-on-primary-fixed" />
            </div>
            <h3 className="font-bold text-primary text-lg" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
              Edit Quantity
            </h3>
            <p className="text-sm text-on-surface-variant mt-1">
              {editModal.item.name} · Order #{editModal.order.id}
            </p>

            {(() => {
              const bakingStarted = editModal.order.status === "baking" || editModal.order.fulfilledQty > 0;
              return (
                <>
                  {bakingStarted && (
                    <div className="mt-3 p-3 bg-tertiary-fixed rounded-lg text-xs text-on-tertiary-fixed-variant">
                      <Icon name="info" size={13} className="inline mr-1" />
                      Baking started — qty can only decrease.
                      Minimum: <span className="font-bold">{editModal.order.fulfilledQty}</span> (already fulfilled)
                    </div>
                  )}
                  <div className="mt-4 space-y-2">
                    <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">New Quantity</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        autoFocus
                        value={editQty}
                        onChange={(e) => { setEditQty(e.target.value.replace(/\D/g, "")); setEditError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") handleEditQty(); if (e.key === "Escape") setEditModal(null); }}
                        className="w-24 h-11 px-3 text-center text-xl font-bold text-primary font-mono bg-surface-container border border-outline-variant/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <p className="text-xs text-on-surface-variant">
                        Current: <span className="font-bold text-primary">{editModal.item.qty}</span>
                        {" · "}Price locked at <span className="font-bold text-primary font-mono">{peso(editModal.item.unitPrice)}</span>/unit
                      </p>
                    </div>
                    {editError && (
                      <p className="text-xs text-error flex items-center gap-1">
                        <Icon name="error" size={12} /> {editError}
                      </p>
                    )}
                  </div>
                </>
              );
            })()}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditModal(null)}
                disabled={editSaving}
                className="px-5 h-10 rounded-lg border border-outline text-primary text-sm font-semibold hover:bg-surface-container transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleEditQty}
                disabled={editSaving}
                className="px-5 h-10 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-2"
              >
                {editSaving ? "Saving…" : "Save Change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
