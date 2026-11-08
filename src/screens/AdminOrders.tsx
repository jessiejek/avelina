import React, { useEffect, useState } from "react";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";
import PushToggle from "../components/PushToggle.tsx";
import { fmtDate, todayManila } from "../lib/preorder.ts";
import { downPayment, paymentLabel, PaymentStatus, proofUrl } from "../lib/payment.ts";

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
  preorderDate: string | null;
  /** null = payment columns not there yet (migration not run) */
  paymentStatus: PaymentStatus | null;
  downPayment: number | null;
  paymentProofPath: string | null;
  paymentRef: string | null;
  paymentNote: string | null;
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
    preorderDate: o.preorder_date ?? null,
    paymentStatus: o.payment_status ?? null,
    downPayment: o.down_payment != null ? Number(o.down_payment) : null,
    paymentProofPath: o.payment_proof_path ?? null,
    paymentRef: o.payment_ref ?? null,
    paymentNote: o.payment_note ?? null,
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

type Filter = "all" | "active" | "preorders" | "unpaid" | "submitted" | "completed" | "cancelled";

const orderTotal = (o: { items: { unitPrice: number; qty: number }[] }) => o.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
const dpOf = (o: AdminOrder) => o.downPayment ?? downPayment(orderTotal(o));
const needsPayment = (o: AdminOrder) => o.paymentStatus === "unpaid" || o.paymentStatus === "rejected";

const payBadge = (o: AdminOrder) => {
  if (!o.paymentStatus) return null;
  const cls =
    o.paymentStatus === "verified" ? "bg-green-600 text-white"
    : o.paymentStatus === "submitted" ? "bg-amber-400 text-amber-950"
    : "bg-red-600 text-white";
  const icon = o.paymentStatus === "verified" ? "check" : o.paymentStatus === "submitted" ? "hourglass" : "alert";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      <Icon name={icon} size={10} strokeWidth={3} /> {paymentLabel(o.paymentStatus)}
    </span>
  );
};

const dpLine = (o: AdminOrder) =>
  o.paymentStatus ? (
    <span className="text-[11px] text-on-surface-variant whitespace-nowrap">Down {peso(dpOf(o))} · Bal {peso(orderTotal(o) - dpOf(o))}</span>
  ) : null;

const unverifiedWarn = (o: AdminOrder) =>
  o.paymentStatus && o.paymentStatus !== "verified" && !isDoneStatus(o.status) ? (
    <p className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1 inline-flex items-center gap-1">
      <Icon name="warning" size={12} /> Down payment not verified
    </p>
  ) : null;

const preorderBadge = (order: { preorderDate: string | null }) =>
  order.preorderDate ? (
    <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full shadow-sm whitespace-nowrap bg-orange-500 text-white`}>
      <Icon name="calendar" size={12} strokeWidth={2.5} /> Pre-order · {fmtDate(order.preorderDate)}
    </span>
  ) : null;

const preorderTags = (order: { preorderDate: string | null }) =>
  order.preorderDate ? (
    <>
      {preorderBadge(order)}
      {order.preorderDate === todayManila() && (
        <span className="inline-flex items-center text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full border-2 border-orange-500 text-orange-700 bg-white whitespace-nowrap">
          For today
        </span>
      )}
    </>
  ) : null;

const bakeFor = (order: { preorderDate: string | null }) =>
  order.preorderDate ? (
    <div className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-orange-800 bg-orange-100 border border-orange-300 rounded-lg px-2.5 py-1">
      <Icon name="calendar" size={14} strokeWidth={2.5} />
      Bake for {fmtDate(order.preorderDate)}
    </div>
  ) : null;

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("active");
  const [preorderDay, setPreorderDay] = useState<string>("all");
  const [proofFor, setProofFor] = useState<AdminOrder | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
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
              ? { ...o, status: row.status as OrderStatus, fulfillmentType: row.fulfillment_type === "delivery" ? "delivery" : "pickup", preorderDate: row.preorder_date ?? o.preorderDate,
                  paymentStatus: row.payment_status ?? o.paymentStatus,
                  paymentProofPath: row.payment_proof_path ?? o.paymentProofPath,
                  paymentRef: row.payment_ref ?? o.paymentRef,
                  paymentNote: row.payment_note ?? null,
                  downPayment: row.down_payment != null ? Number(row.down_payment) : o.downPayment }
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

  // Update one order and require that a row was actually changed: under RLS a
  // blocked UPDATE returns no error, just zero rows.
  const updateOrder = async (id: string, fields: Record<string, unknown>): Promise<string | null> => {
    const { data, error } = await supabase.from("orders").update(fields).eq("id", id).select("id");
    if (error) return error.message;
    if (!data || data.length === 0) return "No permission to update this order (or it no longer exists).";
    return null;
  };

  const markDone = async (order: AdminOrder) => {
    setUpdatingId(order.id);
    setActionError("");
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "completed" } : o)));
    const err = await updateOrder(order.id, { status: "completed", completed_at: new Date().toISOString() });
    if (err) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: order.status } : o)));
      setActionError(`Could not mark #${order.id} done: ${err}`);
    }
    setUpdatingId(null);
  };

  // Warn (never block) when the down payment isn't verified yet.
  const confirmClick = (order: AdminOrder) => {
    if (order.paymentStatus && order.paymentStatus !== "verified") {
      const what = order.paymentStatus === "submitted" ? "has a proof waiting for your review" : "is not paid yet";
      if (!window.confirm(`The ${peso(dpOf(order))} down payment for #${order.id} ${what}.\n\nConfirm the order anyway?`)) return;
    }
    markConfirmed(order);
  };

  const markConfirmed = async (order: AdminOrder) => {
    setUpdatingId(order.id);
    setActionError("");
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "confirmed" } : o)));
    const err = await updateOrder(order.id, { status: "confirmed" });
    if (err) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: order.status } : o)));
      setActionError(`Could not confirm #${order.id}: ${err}`);
    }
    setUpdatingId(null);
  };

  const toggleFulfillment = async (order: AdminOrder) => {
    const next: "pickup" | "delivery" = order.fulfillmentType === "pickup" ? "delivery" : "pickup";
    setActionError("");
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, fulfillmentType: next } : o)));
    const err = await updateOrder(order.id, { fulfillment_type: next });
    if (err) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, fulfillmentType: order.fulfillmentType } : o)));
      setActionError(`Could not change #${order.id} to ${next}: ${err}`);
    }
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    const target = cancelModal;
    setCancelling(true);
    setActionError("");
    const err = await updateOrder(target.id, { status: "cancelled", cancelled_at: new Date().toISOString() });
    setCancelling(false);
    setCancelModal(null);
    if (err) {
      setActionError(`Could not cancel #${target.id}: ${err}`);
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === target.id ? { ...o, status: "cancelled" } : o)));
  };

  const counts = {
    all: orders.length,
    active: orders.filter((o) => !isDoneStatus(o.status)).length,
    preorders: orders.filter((o) => o.preorderDate && !isDoneStatus(o.status)).length,
    unpaid: orders.filter((o) => needsPayment(o) && o.status !== "cancelled").length,
    submitted: orders.filter((o) => o.paymentStatus === "submitted").length,
    completed: orders.filter((o) => o.status === "completed").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  // Open pre-orders, soonest bake date first.
  const openPreorders = orders
    .filter((o) => o.preorderDate && !isDoneStatus(o.status))
    .sort((a, b) => a.preorderDate!.localeCompare(b.preorderDate!) || a.placedAt.localeCompare(b.placedAt));
  const preorderDays = Array.from(new Set(openPreorders.map((o) => o.preorderDate!)));

  const visible =
    filter === "all"
      ? orders
      : filter === "active"
      ? orders.filter((o) => !isDoneStatus(o.status))
      : filter === "unpaid"
      ? orders.filter((o) => needsPayment(o) && o.status !== "cancelled")
      : filter === "submitted"
      ? orders.filter((o) => o.paymentStatus === "submitted")
      : filter === "preorders"
      ? openPreorders.filter((o) => preorderDay === "all" || o.preorderDate === preorderDay)
      : orders.filter((o) => o.status === filter);

  const chips: { id: Filter; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "preorders", label: "Pre-orders" },
    ...(orders.some((o) => o.paymentStatus) ? [
      { id: "unpaid" as Filter, label: "Unpaid" },
      { id: "submitted" as Filter, label: "Proof sent" },
    ] : []),
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
        {order.paymentProofPath && (
          <button onClick={() => setProofFor(order)} className="h-8 px-3 rounded-lg bg-amber-400 text-amber-950 text-xs font-bold hover:opacity-90 active:scale-95 transition-all inline-flex items-center gap-1">
            <Icon name="eye" size={12} /> {order.paymentStatus === "submitted" ? "View proof" : "Proof"}
          </button>
        )}
        <button
          onClick={() => setCancelModal(order)}
          className="h-8 px-2.5 rounded-lg border border-error/30 text-error text-xs font-semibold hover:bg-error-container/30 active:scale-95 transition-all"
        >
          Cancel
        </button>
        {order.status === "pending" && (
          <button
            onClick={() => confirmClick(order)}
            disabled={updatingId === order.id}
            className={`h-8 px-3 rounded-lg border text-xs font-bold active:scale-95 transition-all disabled:opacity-50 inline-flex items-center gap-1 ${order.paymentStatus && order.paymentStatus !== "verified" ? "border-red-400 text-red-700 bg-red-50 hover:bg-red-100" : "border-blue-400 text-blue-700 hover:bg-blue-50"}`}
            title={order.paymentStatus && order.paymentStatus !== "verified" ? "Down payment not verified" : undefined}
          >
            {order.paymentStatus && order.paymentStatus !== "verified" && <Icon name="warning" size={12} />}{updatingId === order.id ? "…" : "Confirm"}
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

        {filter === "preorders" && preorderDays.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-[11px] uppercase tracking-wide text-on-surface-variant">Bake date</span>
            {["all", ...preorderDays].map((d) => (
              <button
                key={d}
                onClick={() => setPreorderDay(d)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  preorderDay === d ? "bg-primary text-on-primary border-primary" : "border-outline-variant/40 text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {d === "all" ? "All upcoming" : `${fmtDate(d)} · ${openPreorders.filter((o) => o.preorderDate === d).length}`}
              </button>
            ))}
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

        {actionError && (
          <div className="bg-error-container text-on-error-container p-4 rounded-xl flex items-start gap-3 border border-error/20">
            <Icon name="warning" size={20} className="shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">Action failed</p>
              <p className="text-xs mt-0.5 opacity-80 break-words">{actionError}</p>
            </div>
            <button onClick={() => setActionError("")} title="Dismiss" className="shrink-0">
              <Icon name="close" size={16} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-on-surface-variant text-sm">Loading orders…</div>
        ) : visible.length === 0 ? (
          <div className="py-24 text-center rounded-xl border-2 border-dashed border-outline-variant/30">
            <Icon name="assignment" size={40} className="mx-auto mb-3 text-outline/40" />
            <p className="text-sm text-on-surface-variant">{filter === "preorders" ? "No open pre-orders." : filter === "unpaid" ? "No unpaid orders." : filter === "submitted" ? "No proofs waiting." : `No ${filter === "all" ? "" : filter + " "}orders.`}</p>
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
                  className={`rounded-xl border p-4 space-y-3 ${order.preorderDate ? "border-orange-300 border-l-[6px] border-l-orange-500 bg-orange-50" : "border-outline-variant/20 bg-surface-container-lowest"} ${done ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${statusStyle(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                      {payBadge(order)}
                      {preorderTags(order)}
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
                    {bakeFor(order)}
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
                    <span className="flex flex-col"><span className="text-[11px] uppercase tracking-wide text-on-surface-variant">Total</span>{dpLine(order)}</span>
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

                  {unverifiedWarn(order)}
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
                      className={`border-t border-outline-variant/15 transition-colors [&>td]:align-top ${order.preorderDate ? "bg-orange-50 hover:bg-orange-100/70 [&>td:first-child]:border-l-[6px] [&>td:first-child]:border-l-orange-500" : "hover:bg-surface-container/40"} ${done ? "opacity-60" : ""}`}
                    >
                      <td className="px-3 py-3 min-w-[240px] max-w-[320px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-primary">{order.customerName}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusStyle(order.status)}`}>
                            {statusLabel(order.status)}
                          </span>
                          {payBadge(order)}
                      {preorderTags(order)}
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
                        {bakeFor(order)}
                        {order.items.length === 0 ? (
                          <span className="text-error">no items</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {order.items.map((it, i) => (
                              <li key={i}>{it.name} ×{it.qty}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-primary whitespace-nowrap">
                        {peso(total)}
                        {order.paymentStatus && <div className="font-sans font-normal mt-0.5">{dpLine(order)}</div>}
                        {order.paymentStatus && !isDoneStatus(order.status) && order.paymentStatus !== "verified" && <div className="font-sans mt-1">{unverifiedWarn(order)}</div>}
                      </td>
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
                              {order.paymentProofPath && (
                                <button onClick={() => setProofFor(order)} className="h-8 px-3 rounded-lg bg-amber-400 text-amber-950 text-xs font-bold hover:opacity-90 active:scale-95 transition-all inline-flex items-center gap-1">
                                  <Icon name="eye" size={12} /> {order.paymentStatus === "submitted" ? "View proof" : "Proof"}
                                </button>
                              )}
                              <button
                                onClick={() => setCancelModal(order)}
                                className="h-8 px-2.5 rounded-lg border border-error/30 text-error text-xs font-semibold hover:bg-error-container/30 active:scale-95 transition-all"
                              >
                                Cancel
                              </button>
                              {order.status === "pending" && (
                                <button
                                  onClick={() => confirmClick(order)}
                                  disabled={updatingId === order.id}
                                  className={`h-8 px-3 rounded-lg border text-xs font-bold active:scale-95 transition-all disabled:opacity-50 inline-flex items-center gap-1 ${order.paymentStatus && order.paymentStatus !== "verified" ? "border-red-400 text-red-700 bg-red-50 hover:bg-red-100" : "border-blue-400 text-blue-700 hover:bg-blue-50"}`}
            title={order.paymentStatus && order.paymentStatus !== "verified" ? "Down payment not verified" : undefined}
                                >
                                  {order.paymentStatus && order.paymentStatus !== "verified" && <Icon name="warning" size={12} />}{updatingId === order.id ? "…" : "Confirm"}
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

      {proofFor && (
        <ProofModal
          order={proofFor}
          onClose={() => setProofFor(null)}
          onDone={(path, fields) => {
            // one proof can cover several orders placed together
            setOrders((prev) => prev.map((o) => (o.paymentProofPath === path ? { ...o, ...fields } : o)));
            setProofFor(null);
          }}
        />
      )}

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

function ProofModal({ order, onClose, onDone }: {
  order: AdminOrder;
  onClose: () => void;
  onDone: (path: string, fields: Partial<AdminOrder>) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadingImg, setLoadingImg] = useState(true);
  const [reason, setReason] = useState(order.paymentStatus === "rejected" ? order.paymentNote || "" : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const path = order.paymentProofPath!;

  useEffect(() => {
    let cancelled = false;
    proofUrl(path).then((u) => { if (!cancelled) { setUrl(u); setLoadingImg(false); } });
    return () => { cancelled = true; };
  }, [path]);

  const act = async (verify: boolean) => {
    if (!verify && !reason.trim()) { setErr("Add a reason so the customer knows what to fix."); return; }
    setBusy(true);
    setErr("");
    const fields = verify
      ? { payment_status: "verified", payment_verified_at: new Date().toISOString(), payment_note: null }
      : { payment_status: "rejected", payment_verified_at: null, payment_note: reason.trim() };
    const { data, error } = await supabase.from("orders").update(fields).eq("payment_proof_path", path).select("id");
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (!data || data.length === 0) { setErr("No permission to update this order (or it no longer exists)."); return; }
    onDone(path, verify
      ? { paymentStatus: "verified", paymentNote: null }
      : { paymentStatus: "rejected", paymentNote: reason.trim() });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(29,27,26,0.6)" }} onClick={() => !busy && onClose()}>
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-full max-w-md shadow-2xl flex flex-col max-h-[94vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start px-5 py-4 border-b border-outline-variant/10">
          <div className="min-w-0">
            <h3 className="font-bold text-primary text-lg" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Payment proof</h3>
            <p className="text-xs text-on-surface-variant truncate">{order.customerName} · #{order.id}</p>
          </div>
          <div className="flex items-center gap-2">{payBadge(order)}
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center"><Icon name="close" size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loadingImg ? (
            <div className="h-64 rounded-xl bg-surface-container flex items-center justify-center text-sm text-on-surface-variant">Loading screenshot…</div>
          ) : url ? (
            <a href={url} target="_blank" rel="noreferrer" title="Open full size">
              <img src={url} alt="GCash proof" className="w-full max-h-[55vh] object-contain rounded-xl bg-surface-container" />
            </a>
          ) : (
            <div className="h-40 rounded-xl bg-error-container/40 flex items-center justify-center text-sm text-error">Couldn't load the screenshot.</div>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-surface-container p-2">
              <p className="text-[10px] uppercase text-on-surface-variant">Expected (this order)</p>
              <b className="font-mono">{peso(dpOf(order))}</b>
            </div>
            <div className="rounded-lg bg-surface-container p-2">
              <p className="text-[10px] uppercase text-on-surface-variant">Ref no.</p>
              <b className="font-mono break-all">{order.paymentRef || "—"}</b>
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant">If the customer paid for several orders at once, the amount covers all of them. Check the reference in the GCash app before verifying.</p>
          <div>
            <label className="block text-[10px] font-semibold uppercase text-on-surface-variant mb-1">Reject reason (shown to customer)</label>
            <input
              className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface-bright text-sm focus:outline-none focus:border-primary/60"
              placeholder="e.g. Amount doesn't match"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {err && <p className="text-xs text-error bg-error-container/40 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="px-5 py-4 border-t border-outline-variant/10 flex gap-3">
          <button onClick={() => act(false)} disabled={busy} className="flex-1 h-11 rounded-lg border border-error/40 text-error text-sm font-bold disabled:opacity-50">Reject</button>
          <button onClick={() => act(true)} disabled={busy} className="flex-1 h-11 rounded-lg bg-green-600 text-white text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-50">
            <Icon name="check" size={14} /> {busy ? "Saving…" : "Verify"}
          </button>
        </div>
      </div>
    </div>
  );
}
