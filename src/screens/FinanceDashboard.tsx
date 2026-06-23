import React, { useEffect, useState } from "react";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function normalizeQty(qty: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return qty;
  if ((fromUnit === "g" || fromUnit === "ml") && toUnit === "kg") return qty / 1000;
  if (fromUnit === "kg" && (toUnit === "g" || toUnit === "ml")) return qty * 1000;
  return qty;
}

interface DayBar { label: string; revenue: number; expense: number }
interface ProductRow { name: string; units: number; revenue: number; price: number; unitCost: number }
interface ExpenseRow { amount: number; note: string; created_at: string; type: string }

export default function FinanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(0);
  const [pipeline, setPipeline] = useState(0);
  const [purchases, setPurchases] = useState(0);
  const [cogs, setCogs] = useState(0);
  const [stockValue, setStockValue] = useState(0);
  const [completedOrders, setCompletedOrders] = useState(0);
  const [bakesCount, setBakesCount] = useState(0);
  const [bars, setBars] = useState<DayBar[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<ExpenseRow[]>([]);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    Promise.all([
      supabase.from("orders").select("status, placed_at, order_items(qty, unit_price, recipes(id, name))"),
      supabase.from("expenses").select("amount, note, created_at, type").order("created_at", { ascending: false }),
      supabase.from("bake_entries").select("cost, started_at"),
      supabase.from("ingredients").select("stock_value, cost_per_unit"),
      supabase.from("recipes").select("id, name, price, yield, recipe_ingredients(qty, unit, ingredients(cost_per_unit, unit))"),
    ]).then(([ordRes, expRes, bakeRes, ingRes, recRes]) => {
      const orders = ordRes.data ?? [];
      const orderTotal = (o: any) => (o.order_items || []).reduce((s: number, it: any) => s + (it.unit_price ?? 0) * (it.qty ?? 0), 0);

      // Revenue (completed) vs pipeline (everything else)
      let rev = 0, pipe = 0;
      const revByDay: Record<string, number> = {};
      const prodAgg: Record<string, { name: string; units: number; revenue: number }> = {};
      for (const o of orders) {
        const total = orderTotal(o);
        if (o.status === "completed") {
          rev += total;
          const key = DAY_NAMES[new Date(o.placed_at).getDay()];
          revByDay[key] = (revByDay[key] || 0) + total;
          for (const it of (o.order_items || []) as any[]) {
            const id = it.recipes?.id || "?";
            if (!prodAgg[id]) prodAgg[id] = { name: it.recipes?.name || "—", units: 0, revenue: 0 };
            prodAgg[id].units += it.qty ?? 0;
            prodAgg[id].revenue += (it.unit_price ?? 0) * (it.qty ?? 0);
          }
        } else {
          pipe += total;
        }
      }
      setRevenue(rev); setPipeline(pipe);
      setCompletedOrders(orders.filter((o: any) => o.status === "completed").length);

      // Expenses
      const expenses = expRes.data ?? [];
      const purch = expenses.reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
      setPurchases(purch);
      setRecentExpenses(expenses.slice(0, 6) as ExpenseRow[]);
      const expByDay: Record<string, number> = {};
      for (const e of expenses) {
        const d = new Date(e.created_at);
        if (d >= since) { const key = DAY_NAMES[d.getDay()]; expByDay[key] = (expByDay[key] || 0) + (e.amount ?? 0); }
      }

      // COGS from bakes
      const bakes = bakeRes.data ?? [];
      setCogs(bakes.reduce((s: number, b: any) => s + (b.cost ?? 0), 0));
      setBakesCount(bakes.length);

      // Raw stock value
      const ings = ingRes.data ?? [];
      setStockValue(ings.reduce((s: number, i: any) => s + (i.stock_value ?? 0) * (i.cost_per_unit ?? 0), 0));

      // 7-day bars
      setBars(Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const key = DAY_NAMES[d.getDay()];
        return { label: key, revenue: revByDay[key] || 0, expense: expByDay[key] || 0 };
      }));

      // Per-product unit cost → margin
      const costByRecipe: Record<string, { price: number; unitCost: number }> = {};
      for (const r of (recRes.data ?? []) as any[]) {
        const yieldNum = parseFloat(r.yield) || 0;
        const batch = (r.recipe_ingredients || []).reduce((s: number, ri: any) => {
          const ing = ri.ingredients;
          const consumed = normalizeQty(parseFloat(ri.qty) || 0, ri.unit, ing?.unit ?? ri.unit);
          return s + consumed * (ing?.cost_per_unit ?? 0);
        }, 0);
        costByRecipe[r.id] = { price: r.price ?? 0, unitCost: yieldNum > 0 ? batch / yieldNum : 0 };
      }
      setProducts(
        Object.entries(prodAgg)
          .map(([id, p]) => ({ ...p, price: costByRecipe[id]?.price ?? 0, unitCost: costByRecipe[id]?.unitCost ?? 0 }))
          .sort((a, b) => b.revenue - a.revenue)
      );

      setLoading(false);
    });
  }, []);

  const grossProfit = revenue - cogs;
  const maxBar = Math.max(...bars.map((b) => Math.max(b.revenue, b.expense)), 1);

  const kpi = [
    { label: "Revenue", sub: "completed sales", value: peso(revenue), icon: "payments", tone: "good" },
    { label: "Purchases", sub: "ingredient spend", value: peso(purchases), icon: "receipt_long", tone: "bad" },
    { label: "Gross Profit", sub: "revenue − COGS", value: peso(grossProfit), icon: grossProfit >= 0 ? "trending_up" : "trending_down", tone: grossProfit >= 0 ? "good" : "bad" },
    { label: "Stock Value", sub: "raw inventory", value: peso(stockValue), icon: "inventory_2", tone: "neutral" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <h1 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Finance</h1>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
            <Icon name="notifications" size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[11px] font-bold text-on-primary">AV</span>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm">Loading finances…</div>
      ) : (
        <div className="p-4 lg:p-10 max-w-7xl mx-auto w-full space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpi.map((k) => (
              <div key={k.label} className={`rounded-xl border p-4 ${k.tone === "good" ? "bg-secondary-container border-secondary/20" : k.tone === "bad" ? "bg-error-container/40 border-error/20" : "bg-surface-container-lowest border-outline-variant/20"}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name={k.icon} size={15} className={k.tone === "bad" ? "text-error" : "text-primary"} />
                  <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">{k.label}</span>
                </div>
                <p className="font-bold text-primary font-mono" style={{ fontSize: 24, lineHeight: 1.1 }}>{k.value}</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* secondary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Pipeline", sub: "unpaid orders", value: peso(pipeline) },
              { label: "COGS", sub: `${bakesCount} bakes`, value: peso(cogs) },
              { label: "Completed Orders", sub: "all time", value: String(completedOrders) },
              { label: "Net Cash", sub: "revenue − purchases", value: peso(revenue - purchases) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
                <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">{s.label}</span>
                <p className="font-bold text-primary font-mono mt-1" style={{ fontSize: 18 }}>{s.value}</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Revenue vs Expense chart */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Cash Flow</p>
                <p className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>Last 7 days</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-semibold">
                <span className="flex items-center gap-1 text-on-surface-variant"><span className="w-2.5 h-2.5 rounded-sm bg-secondary inline-block" /> Revenue</span>
                <span className="flex items-center gap-1 text-on-surface-variant"><span className="w-2.5 h-2.5 rounded-sm bg-error inline-block" /> Expense</span>
              </div>
            </div>
            <div className="flex items-end gap-2 h-44">
              {bars.map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-1 h-36">
                    <div className="w-1/2 rounded-t bg-secondary transition-all" style={{ height: `${(b.revenue / maxBar) * 100}%`, minHeight: b.revenue > 0 ? 3 : 0 }} title={peso(b.revenue)} />
                    <div className="w-1/2 rounded-t bg-error transition-all" style={{ height: `${(b.expense / maxBar) * 100}%`, minHeight: b.expense > 0 ? 3 : 0 }} title={peso(b.expense)} />
                  </div>
                  <span className="text-[10px] text-on-surface-variant">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Product margins */}
          <section className="space-y-3">
            <h3 className="font-semibold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>Product Performance</h3>
            <div className="overflow-x-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
              {products.length === 0 ? (
                <div className="py-12 text-center text-sm text-on-surface-variant">No completed sales yet.</div>
              ) : (
                <table className="w-full text-left min-w-[560px]">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant/20">
                      <th className="px-5 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest">Product</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest text-right">Units sold</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest text-right">Revenue</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest text-right">Margin / unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {products.map((p) => {
                      const margin = p.price - p.unitCost;
                      const hasCost = p.unitCost > 0 && p.price > 0;
                      return (
                        <tr key={p.name} className="hover:bg-surface-container/30 transition-colors">
                          <td className="px-5 py-3 text-sm font-semibold text-primary">{p.name}</td>
                          <td className="px-5 py-3 text-sm text-on-surface-variant font-mono text-right">{p.units}</td>
                          <td className="px-5 py-3 text-sm font-semibold text-primary font-mono text-right">{peso(p.revenue)}</td>
                          <td className="px-5 py-3 text-right">
                            {hasCost ? (
                              <span className={`text-sm font-bold font-mono ${margin >= 0 ? "text-secondary" : "text-error"}`}>{peso(margin)}</span>
                            ) : (
                              <span className="text-xs text-on-surface-variant/50">set cost</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Recent expenses */}
          <section className="space-y-3">
            <h3 className="font-semibold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>Recent Expenses</h3>
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest divide-y divide-outline-variant/10">
              {recentExpenses.length === 0 ? (
                <div className="py-12 text-center text-sm text-on-surface-variant">No expenses logged yet. Add stock with a cost to start tracking.</div>
              ) : (
                recentExpenses.map((e, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-error-container/40 flex items-center justify-center shrink-0">
                        <Icon name="receipt_long" size={15} className="text-error" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary truncate">{e.note || e.type.replace(/_/g, " ")}</p>
                        <p className="text-[11px] text-on-surface-variant">{new Date(e.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-error font-mono shrink-0">−{peso(e.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
