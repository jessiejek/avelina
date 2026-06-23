import React, { useEffect, useState } from "react";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";

interface BarDay { day: string; count: number }
interface TopRecipe { name: string; img: string; pct: number }
interface StockRow { id: string; name: string; stock: string; status: "optimal" | "low" | "critical" }

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Stats() {
  const [barData, setBarData] = useState<BarDay[]>([]);
  const [topRecipes, setTopRecipes] = useState<TopRecipe[]>([]);
  const [stockHealth, setStockHealth] = useState<StockRow[]>([]);
  const [completedBakes, setCompletedBakes] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    Promise.all([
      // Bake entries last 7 days (for bar chart + top recipes + completed count)
      supabase.from("bake_entries")
        .select("started_at, status, recipe_id, recipes(name, img)")
        .gte("started_at", since.toISOString()),

      // Pending orders count
      supabase.from("orders").select("id", { count: "exact" }).eq("status", "pending"),

      // Ingredients for stock health
      supabase.from("ingredients")
        .select("id, name, stock_value, unit, status")
        .order("stock_value", { ascending: true })
        .limit(8),
    ]).then(([bakeRes, ordersRes, ingRes]) => {
      // ── Bar chart ──
      const entries = bakeRes.data ?? [];
      const byDay: Record<string, number> = {};
      for (const e of entries) {
        const key = DAY_NAMES[new Date(e.started_at).getDay()];
        byDay[key] = (byDay[key] || 0) + 1;
      }
      const bars: BarDay[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const day = DAY_NAMES[d.getDay()];
        return { day, count: byDay[day] || 0 };
      });
      setBarData(bars);

      // ── Completed bakes ──
      setCompletedBakes(entries.filter((e) => e.status === "completed").length);

      // ── Top recipes ──
      const recipeCounts: Record<string, { name: string; img: string; count: number }> = {};
      for (const e of entries) {
        const id = e.recipe_id;
        if (!recipeCounts[id]) {
          recipeCounts[id] = {
            name: (e as any).recipes?.name || "Unknown",
            img: (e as any).recipes?.img || "",
            count: 0,
          };
        }
        recipeCounts[id].count++;
      }
      const sorted = Object.values(recipeCounts).sort((a, b) => b.count - a.count).slice(0, 3);
      const total = sorted.reduce((s, r) => s + r.count, 0);
      setTopRecipes(sorted.map((r) => ({ ...r, pct: total ? Math.round((r.count / total) * 100) : 0 })));

      // ── Orders ──
      setPendingOrders(ordersRes.count ?? 0);

      // ── Ingredients ──
      const ings = ingRes.data ?? [];
      const lowCrit = ings.filter((i) => i.status === "low" || i.status === "critical").length;
      setAlertCount(lowCrit);
      setStockHealth(ings.map((i) => ({
        id: i.id,
        name: i.name,
        stock: `${i.stock_value} ${i.unit}`,
        status: i.status as "optimal" | "low" | "critical",
      })));

      setLoading(false);
    });
  }, []);

  const maxBar = Math.max(...barData.map((d) => d.count), 1);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <span className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Stats</span>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex bg-surface-container rounded-full px-3 py-1.5 items-center gap-2 border border-outline-variant/20">
            <Icon name="search" size={16} className="text-outline" />
            <input className="bg-transparent border-none focus:outline-none text-sm w-44 placeholder:text-on-surface-variant/60" placeholder="Search..." />
          </div>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
            <Icon name="notifications" size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[11px] font-bold text-on-primary">AV</span>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm">Loading stats…</div>
      ) : (
        <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6">
          {/* Chart + Top Recipes */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl border border-primary/10 p-6" style={{ boxShadow: "0 2px 8px -2px rgba(38,23,12,0.05)" }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Bake Activity</p>
                  <p className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 20 }}>7-Day Overview</p>
                </div>
                <span className="text-xs font-semibold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full border border-outline-variant/20">This Week</span>
              </div>
              <div className="flex items-end gap-3 h-40">
                {barData.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-semibold text-primary font-mono">{d.count}</span>
                    <div className="w-full rounded-t-lg bg-primary/80 transition-all hover:bg-primary" style={{ height: `${(d.count / maxBar) * 120}px`, minHeight: d.count > 0 ? "4px" : "0" }} />
                    <span className="text-[10px] text-on-surface-variant">{d.day}</span>
                  </div>
                ))}
              </div>
              {barData.every((d) => d.count === 0) && (
                <p className="text-xs text-on-surface-variant/50 text-center mt-3">No bakes in the last 7 days</p>
              )}
            </div>

            <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl border border-primary/10 p-6" style={{ boxShadow: "0 2px 8px -2px rgba(38,23,12,0.05)" }}>
              <div className="mb-4">
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Top Recipes</p>
                <p className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 20 }}>By Volume</p>
              </div>
              {topRecipes.length === 0 ? (
                <p className="text-xs text-on-surface-variant/50 py-8 text-center">No bake entries yet</p>
              ) : (
                <div className="space-y-3">
                  {topRecipes.map((r, i) => (
                    <div key={r.name} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-on-surface-variant w-5 font-mono">0{i + 1}</span>
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-surface-container">
                        {r.img ? <img src={r.img} alt={r.name} className="w-full h-full object-cover" /> : <Icon name="bakery_dining" size={20} className="m-auto mt-1.5 text-on-surface-variant" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-primary truncate" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{r.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                            <div className="h-full bg-primary/70 rounded-full" style={{ width: `${r.pct}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-on-surface-variant font-mono">{r.pct}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-secondary-container rounded-xl p-6 border border-secondary/20">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="oven_gen" size={18} className="text-on-secondary-container" />
                <span className="text-xs font-semibold text-on-secondary-container uppercase tracking-wider">Completed Bakes</span>
              </div>
              <p className="font-bold text-on-secondary-container font-mono" style={{ fontSize: 48, lineHeight: 1 }}>
                {completedBakes}<span className="text-2xl"> batches</span>
              </p>
              <p className="text-xs text-on-secondary-container/70 mt-2">In the last 7 days</p>
            </div>

            <div className="bg-tertiary-fixed rounded-xl p-6 border border-on-tertiary-container/20">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="assignment" size={18} className="text-on-tertiary-fixed-variant" />
                <span className="text-xs font-semibold text-on-tertiary-fixed-variant uppercase tracking-wider">Pending Orders</span>
              </div>
              <p className="font-bold text-on-tertiary-fixed-variant font-mono" style={{ fontSize: 48, lineHeight: 1 }}>
                {pendingOrders}<span className="text-2xl"> orders</span>
              </p>
              <p className="text-xs text-on-tertiary-fixed-variant/70 mt-2">Awaiting fulfillment</p>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-6 border border-primary/10" style={{ boxShadow: "0 2px 8px -2px rgba(38,23,12,0.05)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon name="warning" size={18} className={alertCount > 0 ? "text-error" : "text-primary"} />
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Stock Alerts</span>
              </div>
              <p className={`font-bold font-mono ${alertCount > 0 ? "text-error" : "text-primary"}`} style={{ fontSize: 48, lineHeight: 1 }}>
                {alertCount}<span className="text-2xl"> items</span>
              </p>
              <p className="text-xs text-on-surface-variant/70 mt-2">Low or critical stock level</p>
            </div>
          </div>

          {/* Inventory Stock Health Table */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 20 }}>Inventory Stock Health</h3>
              <button className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors">
                <Icon name="download" size={14} />
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
              {stockHealth.length === 0 ? (
                <div className="py-16 text-center text-sm text-on-surface-variant">No ingredients found.</div>
              ) : (
                <table className="w-full text-left min-w-[400px]">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant/20">
                      <th className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Ingredient</th>
                      <th className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest hidden md:table-cell">Current Stock</th>
                      <th className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Status</th>
                      <th className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {stockHealth.map((row) => {
                      const isOk = row.status === "optimal";
                      const isCrit = row.status === "critical";
                      return (
                        <tr key={row.id} className="hover:bg-surface-container-lowest transition-colors">
                          <td className="px-6 py-4 text-sm font-semibold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{row.name}</td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant hidden md:table-cell font-mono">{row.stock}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${isCrit ? "bg-error-container text-on-error-container" : isOk ? "bg-secondary-container text-on-secondary-container" : "bg-tertiary-fixed text-on-tertiary-fixed-variant"}`}>
                              {isCrit ? "Critical" : isOk ? "Optimal" : "Low"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className={`text-xs font-semibold px-3 h-7 rounded-lg border transition-colors ${isCrit ? "border-error text-error hover:bg-error-container" : "border-outline-variant/40 text-on-surface-variant hover:bg-surface-container"}`}>
                              {isCrit ? "Order Now" : "Review"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
