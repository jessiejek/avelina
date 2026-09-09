import React, { useEffect, useState } from "react";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";
import PushToggle from "../components/PushToggle.tsx";

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
  customerSocial: string;
  customerAddress: string;
  items: AdminOrderItem[];
}

const isDoneStatus = (s: OrderStatus) => s === "completed" || s === "cancelled";

const statusStyle = (s: OrderStatus) => {
  if (s === "completed") return "bg-green-100 text-green-800 border border-green-300";
  if (s === "cancelled") return "bg-red-100 text-red-700 border border-red-300";
  if (s === "pending") return "bg-amber-100 text-amber-800 border border-amber-300";
  return "bg-blue-100 text-blue-800 border border-blue-300";
};

const statusLabel = (s: OrderStatus) => {
  if (s === "completed") return "Done";
  if (s === "cancelled") return "Cancelled";
  if (s === "pending") return "Pending";
  return "Confirmed";
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
    customerSocial: o.customer_social || "",
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setMeId(data.session?.user.id ?? null));
  }, []);

  const copyText = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1500);
    } catch { /* clipboard unavailable */ }
  };

  const fetchOrders = async () => {
    setLoadError("");
    const { data, error } = await supabase.from("orders").select(SELECT).order("placed_at", { ascending: false });

    if (!error && data) {
      const mapped = data.map(mapOrder);
      setOrders(mapped);
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

  const markConfirmed = async (order: AdminOrder) => {
    setUpdatingId(order.id);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "confirmed" } : o)));
    const { error } = await supabase.from("orders").update({ status: "confirmed" }).eq("id", order.id);
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

  const fulfillmentToggle = (order: AdminOrder, done: boolean) => (
    <button
      onClick={() => toggleFulfillment(order)}
      disabled={done}
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-outline-variant/40 hover:bg-surface-container transition-colors disabled:opacity-50"
    >
      <Icon name={order.fulfillmentType === "delivery" ? "local_shipping" : "storefront"} size={11} />
      {order.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}
    </button>
  );

  const socialLink = (order: AdminOrder) =>
    order.customerSocial ? (
      <div className="flex items-center gap-1.5 min-w-0">
        {/^https?:\/\//i.test(order.customerSocial) ? (
          <a href={order.customerSocial} target="_blank" rel="noreferrer" className="text-primary underline truncate" title={order.customerSocial}>
            {order.customerSocial}
          </a>
        ) : (
          <span className="text-on-surface-variant truncate" title={order.customerSocial}>{order.customerSocial}</span>
        )}
        <button
          onClick={() => copyText(order.id + ":social", order.customerSocial)}
          title="Copy"
          className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md border border-outline-variant/40 hover:bg-surface-container transition-colors"
        >
          <Icon name={copiedKey === order.id + ":social" ? "check" : "content_copy"} size={12} />
        </button>
      </div>
    ) : (
      <span className="text-on-surface-variant">—</span>
    );

  const orderActions = (order: AdminOrder, done: boolean) =>
    done ? (
      <span className="text-xs text-on-surface-variant">—</span>
    ) : (
      <>
        <button
          onClick={() => setCancelModal(order)}
          className="h-8 px-2.5 rounded-lg border border-error/30 text-error text-xs font-semibold hover:bg-error-container/30 active:scale-95 transition-all"
        >
          Cancel
        </button>
        {order.status === "pending" && (
          <button
            onClick={() => markConfirmed(order)}
            disabled={updatingId === order.id}
            className="h-8 px-3 rounded-lg border border-blue-400 text-blue-700 text-xs font-bold hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-50"
          >
            {updatingId === order.id ? "…" : "Confirm"}
          </button>
        )}
        <button
          onClick={() => markDone(order)}
          disabled={updatingId === order.id}
          className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
        >
          {updatingId === order.id ? "…" : "Mark Done"}
        </button>
      </>
    );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <h1 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Orders</h1>
        <div className="flex items-center gap-2 text-primary">
          {meId && <PushToggle userId={meId} role="admin" variant="icon" />}
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[11px] font-bold text-on-primary">MJ</span>
          </div>
        </div>
      </header>

      <div className="p-4 lg:px-8 lg:py-8 w-full space-y-4">
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
          <>
          {/* Mobile: one readable card per order */}
          <div className="lg:hidden space-y-3">
            {visible.map((order) => {
              const total = order.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
              const done = isDoneStatus(order.status);
              return (
                <div
                  key={order.id}
                  className={`rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 space-y-3 ${done ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${statusStyle(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                    <span className="text-xs text-on-surface-variant whitespace-nowrap">
                      {new Date(order.placedAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div>
                    <p className="font-semibold text-primary">{order.customerName}</p>
                    <p className="text-[11px] text-on-surface-variant font-mono">#{order.id}</p>
                  </div>

                  <div className="text-sm">
                    {order.items.length === 0 ? (
                      <span className="text-error">no items</span>
                    ) : (
                      <ul className="space-y-1">
                        {order.items.map((it, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span className="text-on-surface">{it.name} ×{it.qty}</span>
                            <span className="font-mono text-on-surface-variant whitespace-nowrap">{peso(it.unitPrice * it.qty)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-outline-variant/15 pt-2">
                    <span className="text-[11px] uppercase tracking-wide text-on-surface-variant">Total</span>
                    <span className="font-mono font-bold text-primary">{peso(total)}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {fulfillmentToggle(order, done)}
                    {order.customerPhone && (
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-outline-variant/40"
                      >
                        <Icon name="call" size={11} />
                        {order.customerPhone}
                      </a>
                    )}
                  </div>

                  {order.customerSocial && <div className="text-xs">{socialLink(order)}</div>}

                  {order.fulfillmentType === "delivery" && order.customerAddress && (
                    <div className="flex items-start gap-1.5 text-xs text-on-surface-variant">
                      <Icon name="location_on" size={13} className="shrink-0 mt-0.5" />
                      <span className="flex-1 break-words">{order.customerAddress}</span>
                      <button
                        onClick={() => copyText(order.id + ":addr", order.customerAddress)}
                        title="Copy address"
                        className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md border border-outline-variant/40 hover:bg-surface-container transition-colors"
                      >
                        <Icon name={copiedKey === order.id + ":addr" ? "check" : "content_copy"} size={12} />
                      </button>
                    </div>
                  )}

                  {order.notes && (
                    <p className="text-xs text-on-surface-variant">
                      <span className="uppercase tracking-wide">Notes:</span> {order.notes}
                    </p>
                  )}

                  {!done && <div className="flex flex-wrap items-center gap-2 pt-1">{orderActions(order, done)}</div>}
                </div>
              );
            })}
          </div>

          {/* Desktop: full table */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant text-[10px] uppercase tracking-wider">
                  <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">Customer</th>
                  <th className="text-left font-semibold px-3 py-2.5 w-full">Items</th>
                  <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Total</th>
                  <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">Type</th>
                  <th className="text-left font-semibold px-3 py-2.5 whitespace-nowrap">Notes</th>
                  <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => {
                  const total = order.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
                  const done = isDoneStatus(order.status);
                  return (
                    <tr
                      key={order.id}
                      className={`border-t border-outline-variant/15 hover:bg-surface-container/40 transition-colors [&>td]:align-top ${done ? "opacity-60" : ""}`}
                    >
                      <td className="px-3 py-3 min-w-[240px] max-w-[320px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-primary">{order.customerName}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusStyle(order.status)}`}>
                            {statusLabel(order.status)}
                          </span>
                        </div>
                        {order.customerAddress && (
                          <div className="flex items-start gap-1.5 mt-1">
                            <span className="text-xs text-on-surface-variant" title={order.customerAddress}>{order.customerAddress}</span>
                            <button
                              onClick={() => copyText(order.id + ":addr", order.customerAddress)}
                              title="Copy address"
                              className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md border border-outline-variant/40 hover:bg-surface-container transition-colors"
                            >
                              <Icon name={copiedKey === order.id + ":addr" ? "check" : "content_copy"} size={11} />
                            </button>
                          </div>
                        )}
                        {order.customerPhone && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <a href={`tel:${order.customerPhone}`} className="text-xs text-on-surface-variant">{order.customerPhone}</a>
                            <button
                              onClick={() => copyText(order.id + ":phone", order.customerPhone)}
                              title="Copy number"
                              className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md border border-outline-variant/40 hover:bg-surface-container transition-colors"
                            >
                              <Icon name={copiedKey === order.id + ":phone" ? "check" : "content_copy"} size={11} />
                            </button>
                          </div>
                        )}
                        {order.customerSocial && <div className="mt-1 text-xs">{socialLink(order)}</div>}
                        <div className="text-[11px] text-on-surface-variant mt-1">
                          {new Date(order.placedAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-on-surface-variant min-w-[280px]">
                        {order.items.length === 0
                          ? <span className="text-error">no items</span>
                          : order.items.map((it) => `${it.name} ×${it.qty}`).join(", ")}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-primary whitespace-nowrap">{peso(total)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button
                          onClick={() => toggleFulfillment(order)}
                          disabled={done}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-outline-variant/40 hover:bg-surface-container transition-colors disabled:opacity-50"
                        >
                          <Icon name={order.fulfillmentType === "delivery" ? "local_shipping" : "storefront"} size={11} />
                          {order.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-on-surface-variant max-w-[200px] truncate" title={order.notes || ""}>{order.notes || "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 justify-end whitespace-nowrap">
                          {done ? (
                            <span className="text-xs text-on-surface-variant">—</span>
                          ) : (
                            <>
                              <button
                                onClick={() => setCancelModal(order)}
                                className="h-8 px-2.5 rounded-lg border border-error/30 text-error text-xs font-semibold hover:bg-error-container/30 active:scale-95 transition-all"
                              >
                                Cancel
                              </button>
                              {order.status === "pending" && (
                                <button
                                  onClick={() => markConfirmed(order)}
                                  disabled={updatingId === order.id}
                                  className="h-8 px-3 rounded-lg border border-blue-400 text-blue-700 text-xs font-bold hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-50"
                                >
                                  {updatingId === order.id ? "…" : "Confirm"}
                                </button>
                              )}
                              <button
                                onClick={() => markDone(order)}
                                disabled={updatingId === order.id}
                                className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                              >
                                {updatingId === order.id ? "…" : "Mark Done"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
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
