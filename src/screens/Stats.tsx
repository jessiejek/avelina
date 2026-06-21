import React from "react";
import Icon from "../components/Icon.tsx";

const barData = [
  { day: "Mon", kg: 42 },
  { day: "Tue", kg: 58 },
  { day: "Wed", kg: 35 },
  { day: "Thu", kg: 71 },
  { day: "Fri", kg: 88 },
  { day: "Sat", kg: 95 },
  { day: "Sun", kg: 63 },
];
const maxBar = Math.max(...barData.map((d) => d.kg));

const topRecipes = [
  { name: "Signature Sourdough Batard", pct: 34, img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBDgc7Eo_mKPDx7RQkmK3E6Oeg55QQKBMRAT1pEHPGUta986kzcUL47FPPj-8cDc_WI6I_f2dtvxDAyYwcbPoDDht9sWmF4J1aJZytIK_oURhBgPwHm57llVjrVhEQGLdGgxFnklIJv8uHKahRkeHJ44wZXli3uxhZzJqTMnTf3tcR1LQUujai0kOGJ1RdMNdDu3T1cZQQDnbB9_mV9T3qa1CpFATf1UxhMiVp4raaczYYKzO3jRNzuWdcQ5X4V18E6mkisi6tuAfFe" },
  { name: "Classic Butter Croissant", pct: 28, img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCtc_UaixfCeUfz7q-g-E2U7ue-5DUoAJ4_Awhbcne1Q9gqtchX-DNHyKA_78DKpO4MQVzsGKgAWqIHGVnBxmghnEpD09aNRan9CnB0O2nYnluwMgE1zkNst8H6xU-qC8_SUBycg-_1T8HDgSax6NRSiGl7EpBwY3DoKjZUjQsKIkUewjQi1oeNPBE_dhZFu0FWi8lAHemG3mlXcn5sTkNyau0DkPRb96uym9FSc7LCVoWkm7kRKOlTPmyPjdMMTrQxb5izdTO2LJwz" },
  { name: "Focaccia Barese", pct: 18, img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCZEA9Bb0E92ttiNPKygaTFeC4dzXBznNOXNamZP3o7bVGUwv6Hzf4GvcLSLSKZaHSEF3WxskKkxdKPSd_UpV32ZH-EcJT0uepYb2E7k70ffBDdz1mpaIjvaXKtezW-QbHZYtSSphohNe2_MDahWfWGmhNIjR2Ax8tQrOW0W190tn8Xz7E_Y9ub1lA0KNjOJPeiilJF4d6ef2YjqGkwBr9QIYmpcyzX5E1ShDsdKblhprVsIrizOMrkIEP0sEWCHaO8zlS_AEyfbhtm" },
];

const stockHealth = [
  { name: "Bread Flour (T65)", stock: "45.5 kg", usage: "38.2 kg", runout: "8 days", status: "healthy" },
  { name: "Active Levain", stock: "0.80 kg", usage: "2.1 kg", runout: "Today", status: "critical" },
  { name: "Sea Salt (Fine)", stock: "5.00 kg", usage: "0.8 kg", runout: "44 days", status: "healthy" },
  { name: "European Butter", stock: "12.0 kg", usage: "9.4 kg", runout: "9 days", status: "healthy" },
  { name: "T45 Pastry Flour", stock: "8.2 kg", usage: "7.1 kg", runout: "7 days", status: "low" },
];

export default function Stats() {
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
            <span className="text-[11px] font-bold text-on-primary">BM</span>
          </div>
        </div>
      </header>

      <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6">
        {/* Chart + Top Recipes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl border border-primary/10 p-6" style={{ boxShadow: "0 2px 8px -2px rgba(38,23,12,0.05)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Flour Utilization Trend</p>
                <p className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 20 }}>7-Day Overview</p>
              </div>
              <span className="text-xs font-semibold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full border border-outline-variant/20">This Week</span>
            </div>
            <div className="flex items-end gap-3 h-40">
              {barData.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-primary font-mono">{d.kg}</span>
                  <div className="w-full rounded-t-lg bg-primary/80 transition-all hover:bg-primary" style={{ height: `${(d.kg / maxBar) * 120}px` }} />
                  <span className="text-[10px] text-on-surface-variant">{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl border border-primary/10 p-6" style={{ boxShadow: "0 2px 8px -2px rgba(38,23,12,0.05)" }}>
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Top Recipes</p>
              <p className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 20 }}>By Volume</p>
            </div>
            <div className="space-y-3">
              {topRecipes.map((r, i) => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-on-surface-variant w-5 font-mono">0{i + 1}</span>
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
                    <img src={r.img} alt={r.name} className="w-full h-full object-cover" />
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
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-secondary-container rounded-xl p-6 border border-secondary/20">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="water_drop" size={18} className="text-on-secondary-container" />
              <span className="text-xs font-semibold text-on-secondary-container uppercase tracking-wider">Hydration Accuracy</span>
            </div>
            <p className="font-bold text-on-secondary-container font-mono" style={{ fontSize: 48, lineHeight: 1 }}>
              98.4<span className="text-2xl">%</span>
            </p>
            <p className="text-xs text-on-secondary-container/70 mt-2">Consistent across all 7 batches this week</p>
          </div>

          <div className="bg-tertiary-fixed rounded-xl p-6 border border-on-tertiary-container/20">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="thermostat" size={18} className="text-on-tertiary-fixed-variant" />
              <span className="text-xs font-semibold text-on-tertiary-fixed-variant uppercase tracking-wider">Dough Temp Mean</span>
            </div>
            <p className="font-bold text-on-tertiary-fixed-variant font-mono" style={{ fontSize: 48, lineHeight: 1 }}>
              24.2<span className="text-2xl">°C</span>
            </p>
            <p className="text-xs text-on-tertiary-fixed-variant/70 mt-2">±0.3°C variance — target range met</p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-6 border border-primary/10" style={{ boxShadow: "0 2px 8px -2px rgba(38,23,12,0.05)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Icon name="sync_alt" size={18} className="text-primary" />
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Storage Turn Rate</span>
            </div>
            <p className="font-bold text-primary font-mono" style={{ fontSize: 48, lineHeight: 1 }}>
              4.8<span className="text-2xl">x</span>
            </p>
            <p className="text-xs text-on-surface-variant/70 mt-2">Average monthly ingredient turnover</p>
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
          <div className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/20">
                  <th className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Ingredient</th>
                  <th className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest hidden md:table-cell">Current Stock</th>
                  <th className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest hidden lg:table-cell">7-Day Usage</th>
                  <th className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Projected Runout</th>
                  <th className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {stockHealth.map((row) => {
                  const isOk = row.status === "healthy";
                  const isCrit = row.status === "critical";
                  return (
                    <tr key={row.name} className="hover:bg-surface-container-lowest transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{row.name}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant hidden md:table-cell font-mono">{row.stock}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant hidden lg:table-cell font-mono">{row.usage}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${isCrit ? "bg-error-container text-on-error-container" : isOk ? "bg-secondary-container text-on-secondary-container" : "bg-tertiary-fixed text-on-tertiary-fixed-variant"}`}>
                          {row.runout}
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
          </div>
        </section>
      </div>
    </div>
  );
}
