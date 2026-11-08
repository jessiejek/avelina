import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";
import { fmtDate } from "../lib/preorder.ts";
import { downPayment, PaymentStatus } from "../lib/payment.ts";
import PaymentProofForm from "../components/PaymentProofForm.tsx";

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
  preorderDate: string | null;
  /** null = payment columns not there yet (migration not run) */
  paymentStatus: PaymentStatus | null;
  downPayment: number | null;
  paymentRef: string | null;
  paymentNote: string | null;
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
    preorderDate: o.preorder_date ?? null,
    paymentStatus: o.payment_status ?? null,
    downPayment: o.down_payment != null ? Number(o.down_payment) : null,
    paymentRef: o.payment_ref ?? null,
    paymentNote: o.payment_note ?? null,
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

// What the customer sees: until the bakery verifies the down payment, an open
// order never reads "Confirmed" (even if the admin confirmed it early).
const customerPill = (o: OrderView): { label: string; cls: string } => {
  const open = o.status === "pending" || o.status === "confirmed";
  if (open && (o.paymentStatus === "unpaid" || o.paymentStatus === "rejected"))
    return { label: "Awaiting payment", cls: "bg-red-100 text-red-700" };
  if (open && o.paymentStatus === "submitted")
    return { label: "Awaiting confirmation", cls: "bg-amber-100 text-amber-800" };
  return { label: statusLabel(o.status), cls: statusColor(o.status) };
};

type Section = { key: "pre" | "open" | "past"; title: string; icon: string; items: OrderView[] };
const isPast = (o: OrderView) => o.status === "completed" || o.status === "cancelled";
function buildSections(orders: OrderView[]): Section[] {
  const newest = (x: OrderView, y: OrderView) => (y.placedAt || "").localeCompare(x.placedAt || "");
  const open = orders.filter((o) => !isPast(o)).sort(newest);
  const past = orders.filter(isPast).sort(newest);
  return ([
    { key: "open", title: "Orders", icon: "shopping_bag", items: open },
    { key: "past", title: "Past orders", icon: "history", items: past },
  ] as Section[]).filter((s) => s.items.length > 0);
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
  const sections = buildSections(orders);
  const [payFor, setPayFor] = useState<OrderView | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) { setOrders([]); setLoading(false); return; }

    let cancelled = false;
    const fetchOrders = async () => {
      // RLS only returns the caller's own orders; filter explicitly anyway.
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(qty, unit_price, recipes(name, img, price))")
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
        setOrders((prev) => prev.map((o) => o.id === row.id ? {
          ...o,
          status: row.status as OrderStatus,
          paymentStatus: row.payment_status ?? o.paymentStatus,
          paymentRef: row.payment_ref ?? o.paymentRef,
          paymentNote: row.payment_note ?? null,
          downPayment: row.down_payment != null ? Number(row.down_payment) : o.downPayment,
        } : o));
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userId, authLoading, reloadKey]);

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
          <div className="space-y-10">
          {sections.map((sec) => (
            <section key={sec.key} className={sec.key === "past" ? "pt-8 border-t-2 border-dashed border-[#26170c]/15" : ""}>
              <div className="flex items-center gap-2 mb-3">
                <Icon name={sec.icon} size={18} className={sec.key === "pre" ? "text-orange-600" : "text-[#26170c]"} />
                <h2 className="font-bold text-[#26170c] text-lg" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{sec.title}</h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sec.key === "pre" ? "bg-orange-500 text-white" : sec.key === "past" ? "bg-[#26170c]/10 text-[#26170c]/60" : "bg-[#26170c] text-white"}`}>{sec.items.length}</span>
                <div className="flex-1 h-px bg-[#26170c]/10 ml-1" />
              </div>
              <div className={`space-y-4 ${sec.key === "past" ? "opacity-60" : ""}`}>
          {sec.items.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-[#26170c]/8 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#26170c] text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>#{order.id}</p>
                  {order.preorderDate && (
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide text-[#8a4b14] bg-[#f3e1cf] rounded-md px-2 py-0.5">
                      Pre-order · Ready {fmtDate(order.preorderDate)}
                    </span>
                  )}
                  <p className="text-xs text-[#26170c]/40">{new Date(order.placedAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${customerPill(order).cls}`}>
                  {customerPill(order).label}
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
              {order.paymentStatus && order.status !== "cancelled" && (() => {
                const dp = order.downPayment ?? downPayment(lineTotal(order));
                if (order.paymentStatus === "verified") return (
                  <div className="rounded-xl bg-green-50 border border-green-200 p-3 flex items-center gap-2 text-xs">
                    <Icon name="check_circle" size={16} className="text-green-700" />
                    <span className="font-bold text-green-800">Down payment verified · {peso(dp)}</span>
                    <span className="ml-auto text-green-700/80">Balance {peso(lineTotal(order) - dp)}</span>
                  </div>
                );
                if (order.paymentStatus === "submitted") return (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-center gap-2">
                    <Icon name="hourglass" size={16} className="text-amber-700 shrink-0" />
                    <div className="text-xs">
                      <p className="font-bold text-amber-800">Uploaded · awaiting confirmation</p>
                      <p className="text-amber-700/80">{order.paymentRef ? `Ref ${order.paymentRef} · ` : ""}{peso(dp)}</p>
                    </div>
                  </div>
                );
                return (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-600 text-white">
                        {order.paymentStatus === "rejected" ? "Proof rejected" : "Awaiting payment"}
                      </span>
                      <span className="text-xs font-mono font-bold text-red-700">Down {peso(dp)}</span>
                    </div>
                    {order.paymentStatus === "rejected" && order.paymentNote && (
                      <p className="text-xs text-red-800">Reason: {order.paymentNote}</p>
                    )}
                    <button onClick={() => setPayFor(order)} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#26170c] text-white text-xs font-bold">
                      <Icon name="upload" size={14} /> {order.paymentStatus === "rejected" ? "Upload new proof" : "Upload proof"}
                    </button>
                  </div>
                );
              })()}
            </div>
          ))}
              </div>
            </section>
          ))}
          </div>
        )}
      </div>

      {payFor && userId && (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#fff8f5]">
          <div className="max-w-md mx-auto px-5 py-6 space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={() => setPayFor(null)} className="flex items-center gap-2 text-[#26170c] font-semibold text-sm">
                <Icon name="arrow_back" size={16} /> My Orders
              </button>
              <span className="text-xs font-mono text-[#26170c]/60">#{payFor.id}</span>
            </div>
            <h2 className="font-bold text-[#26170c] text-xl text-center" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Pay your down payment</h2>
            <PaymentProofForm
              userId={userId}
              orderIds={[payFor.id]}
              amount={payFor.downPayment ?? downPayment(lineTotal(payFor))}
              balance={lineTotal(payFor) - (payFor.downPayment ?? downPayment(lineTotal(payFor)))}
              note={payFor.paymentStatus === "rejected" ? payFor.paymentNote : null}
              onSubmitted={() => { setPayFor(null); setReloadKey((k) => k + 1); }}
              onLater={() => setPayFor(null)}
              laterLabel="Not now"
            />
          </div>
        </div>
      )}
    </div>
  );
}
