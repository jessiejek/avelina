import React, { useEffect, useState } from "react";
import Icon from "../components/Icon.tsx";
import { Recipe } from "../data/recipes.ts";
import { Ingredient } from "../data/inventory.ts";
import { BakeEntry } from "./BakeLog.tsx";
import { supabase } from "../lib/supabase.ts";

interface Props {
  onBack: () => void;
  onLogBake: (entry: BakeEntry) => void;
  recipe: Recipe;
  inventory: Ingredient[];
}

const INV_ICON: Record<string, string> = {
  wheat: "grain",
  sparkles: "auto_awesome",
  flask: "science",
  droplets: "water_drop",
  leaf: "compost",
  egg: "egg",
};

function normalizeQty(qty: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return qty;
  if ((fromUnit === "g" || fromUnit === "ml") && toUnit === "kg") return qty / 1000;
  if (fromUnit === "kg" && (toUnit === "g" || toUnit === "ml")) return qty * 1000;
  return qty;
}

function fmtQty(value: number, unit: string): string {
  return `${value.toFixed(2)}${unit}`;
}

export default function BakeConfirmation({ onBack, onLogBake, recipe, inventory }: Props) {
  const [baker, setBaker] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("users").select("name").eq("id", user.id).single();
      setBaker(data?.name || user.user_metadata?.name || user.email?.split("@")[0] || "");
    });
  }, []);

  const bakerInitials = baker
    ? baker.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "—";

  const reconciliation = recipe.ingredients.map((ri) => {
    const inv = inventory.find((i) => i.id === ri.ingredientId);
    const reqRaw = parseFloat(ri.qty);
    const displayUnit = inv?.unit ?? ri.unit;
    const required = normalizeQty(reqRaw, ri.unit, displayUnit);
    const available = inv?.stockValue ?? 0;
    const isShort = required > available;
    const isLow = !isShort && (inv?.status === "low" || inv?.status === "critical");
    return {
      name: ri.name,
      icon: inv ? (INV_ICON[inv.icon] ?? "inventory_2") : "inventory_2",
      required: fmtQty(required, displayUnit),
      available: fmtQty(available, displayUnit),
      status: isShort ? "short" : isLow ? "low" : "ready",
    };
  });

  const hasShortage = reconciliation.some((r) => r.status !== "ready");
  const batchId = `#SKU-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

  const handleInitiateBake = async () => {
    const now = new Date();
    const entry: BakeEntry = {
      id: `bake-${Date.now()}`,
      recipe_id: recipe.id,
      product: recipe.name,
      img: recipe.img,
      batchId,
      baker: baker || "Unknown",
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
      qty: recipe.yield,
      status: "in_progress",
    };
    const { error } = await supabase.from("bake_entries").insert({
      id: entry.id, recipe_id: entry.recipe_id,
      batch_id: entry.batchId, baker: entry.baker,
      started_at: now.toISOString(), qty: entry.qty,
      status: entry.status, img: entry.img,
    });
    if (error) console.error("Failed to save bake entry:", error.message);
    onLogBake(entry);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <nav className="flex items-center gap-1 text-sm text-on-surface-variant">
          <button onClick={onBack} className="hover:text-primary transition-colors px-2 py-1 flex items-center gap-1">
            <Icon name="arrow_back" size={14} /> New Production
          </button>
          <Icon name="chevron_right" size={14} className="text-outline-variant" />
          <span className="text-primary font-semibold px-2 py-1" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Confirm & Start Bake</span>
        </nav>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
            <Icon name="notifications" size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center" title={baker}>
            <span className="text-[11px] font-bold text-on-primary">{bakerInitials}</span>
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-12 max-w-7xl mx-auto w-full space-y-6">
        {hasShortage && (
          <div className="bg-error-container text-on-error-container p-4 rounded-xl flex items-center gap-4 border border-error/20">
            <Icon name="warning" size={24} className="shrink-0" />
            <div>
              <h4 className="font-semibold text-base" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Inventory Shortage Detected</h4>
              <p className="text-sm mt-0.5 opacity-80">Some ingredients are below required amounts. You can still proceed — shortfalls are flagged below.</p>
            </div>
          </div>
        )}

        {/* Recipe Summary */}
        <section className="flex flex-col md:flex-row gap-4 items-start bg-surface-container-lowest p-4 lg:p-6 rounded-xl border border-outline-variant/10">
          <div className="w-full md:w-64 rounded-xl overflow-hidden shadow-sm shrink-0" style={{ aspectRatio: "4/3" }}>
            <img src={recipe.img} alt={recipe.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <span className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-[10px] font-bold uppercase tracking-wider">{recipe.category}</span>
              <h2 className="text-primary mt-3 font-bold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 36, lineHeight: "44px", letterSpacing: "-0.02em" }}>{recipe.name}</h2>
              <p className="text-sm text-on-surface-variant font-mono mt-1">Batch ID: {batchId}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-outline-variant/10">
              {[
                { label: "Total Time", value: recipe.time || "—" },
                { label: "Planned Yield", value: recipe.yield || "—" },
                { label: "Difficulty", value: recipe.difficulty ? recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1) : "—" },
              ].map((m) => (
                <div key={m.label}>
                  <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">{m.label}</p>
                  <p className="font-bold text-primary text-sm font-mono">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Inventory Reconciliation */}
        <section className="space-y-4">
          <h3 className="text-primary font-semibold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Inventory Check</h3>
          <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/20">
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Ingredient</th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {reconciliation.map((row) => {
                  const isOk = row.status === "ready";
                  const isLow = row.status === "low";
                  return (
                    <tr key={row.name}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isOk ? "bg-surface-container text-primary" : "bg-error-container/30 text-error"}`}>
                            <Icon name={row.icon} size={15} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-primary text-sm truncate">{row.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className={`text-xs font-bold font-mono ${!isOk ? "text-error" : "text-primary"}`}>{row.required.replace(" ", "")}</span>
                              <span className="text-on-surface-variant/40 text-xs">/</span>
                              <span className="text-xs font-mono text-on-surface-variant">{row.available.replace(" ", "")}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isOk ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-secondary-container text-on-secondary-container rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                            <Icon name="check_circle" size={10} /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-error-container text-on-error-container rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                            <Icon name="error" size={10} /> {isLow ? "Low" : "Short"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer — single clear CTA */}
        <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface-container-low p-4 lg:p-6 rounded-xl border border-outline-variant/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-surface-bright bg-primary flex items-center justify-center text-on-primary font-bold text-xs">{bakerInitials}</div>
            <div>
              <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Baker</p>
              <p className="text-sm font-semibold text-primary">{baker || "Loading…"}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onBack} className="flex-1 sm:flex-none h-12 px-6 border border-outline text-primary rounded-lg font-semibold text-sm hover:bg-surface-container transition-colors">
              Back
            </button>
            <button
              onClick={handleInitiateBake}
              className="flex-1 sm:flex-none h-12 px-6 bg-primary text-on-primary rounded-lg font-bold text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="oven_gen" size={16} />
              Initiate Bake
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
