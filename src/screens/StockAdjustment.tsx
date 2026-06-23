import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";

interface Props {
  onBack: () => void;
}

interface IngredientState {
  id: string;
  name: string;
  sku: string;
  stockValue: number;
  unit: string;
  status: string;
  costPerUnit?: number;
}

const REASONS = [
  "New Shipment Received",
  "Spoilage / Waste",
  "Inventory Correction",
  "Inter-Kitchen Transfer",
];

export default function StockAdjustment({ onBack }: Props) {
  const location = useLocation();
  const ingredient = (location.state as { ingredient?: IngredientState })?.ingredient ?? null;

  const [mode, setMode] = useState<"add" | "sub">("add");
  const [amount, setAmount] = useState(0);
  const [unit, setUnit] = useState(ingredient?.unit ?? "kg");
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [currentStock, setCurrentStock] = useState(ingredient?.stockValue ?? 0);
  const [recentHistory, setRecentHistory] = useState<{ created_at: string; delta: number; reason: string }[]>([]);

  const base = currentStock;
  const factor = unit === "g" ? 0.001 : unit === "bags" ? 25 : 1;
  const adjKg = amount * factor;
  const projected = mode === "add" ? base + adjKg : base - adjKg;

  useEffect(() => {
    if (!ingredient?.id) return;
    supabase
      .from("inventory_adjustments")
      .select("created_at, delta, reason")
      .eq("ingredient_id", ingredient.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setRecentHistory(data);
      });
  }, [ingredient?.id]);

  const handleConfirm = async () => {
    if (!ingredient?.id || amount <= 0) return;
    setSaving(true);
    setError("");

    const delta = mode === "add" ? adjKg : -adjKg;
    const newStock = base + delta;

    const { error: adjErr } = await supabase.from("inventory_adjustments").insert({
      ingredient_id: ingredient.id,
      delta,
      unit: ingredient.unit,
      reason,
      notes: notes.trim() || null,
      adjusted_by: "Avelina",
    });

    if (adjErr) { setError(adjErr.message); setSaving(false); return; }

    const costNum = parseFloat(cost) || 0;
    const ingUpdate: Record<string, any> = { stock_value: newStock, status: newStock <= 0 ? "critical" : newStock < 5 ? "low" : "optimal" };
    // On a purchase with a cost, log the expense and blend into a weighted-average cost.
    if (mode === "add" && costNum > 0) {
      await supabase.from("expenses").insert({
        type: "ingredient_purchase",
        amount: costNum,
        ingredient_id: ingredient.id,
        qty: adjKg,
        unit: ingredient.unit,
        note: reason,
        created_by: "Avelina",
      });
      // Weighted average: (existing value + new spend) / new quantity.
      const oldCost = ingredient.costPerUnit ?? 0;
      const oldValue = base * oldCost;
      ingUpdate.cost_per_unit = newStock > 0 ? (oldValue + costNum) / newStock : oldCost;
    }

    const { error: updErr } = await supabase
      .from("ingredients")
      .update(ingUpdate)
      .eq("id", ingredient.id);

    if (updErr) { setError(updErr.message); setSaving(false); return; }

    setCurrentStock(newStock);
    setRecentHistory((prev) => [{ created_at: new Date().toISOString(), delta, reason }, ...prev.slice(0, 4)]);
    setAmount(0);
    setCost("");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="lg:hidden p-2 text-primary"><Icon name="menu" size={20} /></button>
          <h2 className="font-semibold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>Stock Adjustment</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant/20 gap-2">
            <Icon name="search" size={16} className="text-outline" />
            <input className="bg-transparent border-none focus:outline-none text-sm w-40" placeholder="Quick search..." />
          </div>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
            <Icon name="notifications" size={18} />
          </button>
        </div>
      </header>

      <div className="max-w-[900px] mx-auto p-6 lg:p-10 w-full">
        {!ingredient && (
          <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl text-sm flex items-center gap-3">
            <Icon name="warning" size={18} />
            No ingredient selected. Navigate here from an ingredient's detail page.
          </div>
        )}

        {/* Current State Card */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ boxShadow: "0 4px 12px -2px rgba(61,43,31,0.07)" }}>
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-xl bg-surface-container flex items-center justify-center border border-outline-variant/20 shrink-0">
              <Icon name="inventory_2" size={28} className="text-primary" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-on-tertiary-container bg-tertiary-fixed px-2 py-0.5 rounded uppercase tracking-wide mb-1 inline-block">Ingredient</span>
              <h3 className="text-primary font-bold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>
                {ingredient?.name ?? "No ingredient selected"}
              </h3>
              <p className="text-sm text-outline font-mono">{ingredient?.sku ? `SKU: ${ingredient.sku}` : "—"}</p>
            </div>
          </div>
          <div className="sm:text-right shrink-0">
            <p className="text-[10px] font-semibold text-outline uppercase tracking-wider mb-1">Current Level</p>
            <p className="text-primary font-bold font-mono" style={{ fontSize: 32 }}>
              {currentStock.toFixed(2)} <span className="text-base opacity-60">{ingredient?.unit ?? "kg"}</span>
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden" style={{ boxShadow: "0 4px 12px -2px rgba(61,43,31,0.07)" }}>
          <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low">
            <h4 className="font-semibold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 16 }}>Adjustment Details</h4>
          </div>
          <div className="p-6 lg:p-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">Adjustment Amount</label>
                <div className="flex h-11">
                  <input
                    className="flex-1 h-full px-4 rounded-l-lg border border-outline-variant/40 focus:border-primary focus:outline-none text-base font-mono"
                    type="number" step={0.01} min={0}
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  />
                  <div className="relative w-20">
                    <select className="w-full h-full rounded-r-lg border-y border-r border-outline-variant/40 bg-surface-container-high px-2 text-xs font-bold text-primary focus:outline-none appearance-none font-mono" value={unit} onChange={(e) => setUnit(e.target.value)}>
                      <option>kg</option><option>g</option><option>bags</option>
                    </select>
                    <Icon name="unfold_more" size={14} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline" />
                  </div>
                </div>
              </div>

              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">Reason for Change</label>
                <div className="relative h-11">
                  <select
                    className="w-full h-full rounded-lg border border-outline-variant/40 focus:border-primary focus:outline-none appearance-none px-4 text-sm bg-surface-bright"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    {REASONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <Icon name="keyboard_arrow_down" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline" />
                </div>
              </div>

              <div className="md:col-span-3 flex bg-surface-container rounded-lg p-1 h-11">
                <button onClick={() => setMode("add")} className={`flex-1 rounded-md flex items-center justify-center font-bold text-sm gap-1 transition-all ${mode === "add" ? "bg-white shadow-sm text-primary" : "text-outline hover:text-primary"}`}>
                  <Icon name="add" size={16} strokeWidth={2.5} /> ADD
                </button>
                <button onClick={() => setMode("sub")} className={`flex-1 rounded-md flex items-center justify-center font-bold text-sm gap-1 transition-all ${mode === "sub" ? "bg-white shadow-sm text-primary" : "text-outline hover:text-primary"}`}>
                  <Icon name="remove" size={16} strokeWidth={2.5} /> SUB
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-6 p-5 bg-surface-bright rounded-xl border-2 border-dashed border-outline-variant/30 grid grid-cols-3 items-center">
              <div className="text-center">
                <p className="text-[10px] font-semibold text-outline mb-2 uppercase tracking-wider">Before</p>
                <p className="text-primary/40 font-bold font-mono" style={{ fontSize: 28 }}>{base.toFixed(2)} <span className="text-sm">{ingredient?.unit ?? "kg"}</span></p>
              </div>
              <div className="flex flex-col items-center">
                <Icon name="trending_flat" size={28} className="text-primary" />
                <span className={`text-xs font-bold px-3 py-1 rounded-full mt-2 font-mono ${mode === "add" ? "bg-secondary text-white" : "bg-error text-white"}`}>
                  {mode === "add" ? "+" : "-"}{adjKg.toFixed(2)} {ingredient?.unit ?? "kg"}
                </span>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-outline mb-2 uppercase tracking-wider">Projected After</p>
                <p className="text-primary font-bold font-mono" style={{ fontSize: 36 }}>{projected.toFixed(2)} <span className="text-lg">{ingredient?.unit ?? "kg"}</span></p>
              </div>
            </div>

            {mode === "add" && (
              <div className="mt-5 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-outline uppercase tracking-wider">Purchase Cost (optional)</label>
                <div className="flex items-center gap-1 bg-surface-bright border border-outline-variant/40 rounded-xl px-4 focus-within:border-primary">
                  <span className="text-base font-bold text-on-surface-variant">₱</span>
                  <input
                    className="flex-1 min-w-0 bg-transparent py-3 text-base font-bold text-primary font-mono focus:outline-none"
                    inputMode="decimal" placeholder="0.00"
                    value={cost}
                    onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ""))}
                  />
                  <span className="text-xs text-outline whitespace-nowrap">total for this shipment</span>
                </div>
                {parseFloat(cost) > 0 && amount > 0 && (() => {
                  const c = parseFloat(cost);
                  const thisUnit = adjKg > 0 ? c / adjKg : 0;
                  const oldCost = ingredient?.costPerUnit ?? 0;
                  const newAvg = projected > 0 ? (base * oldCost + c) / projected : thisUnit;
                  return (
                    <p className="text-[11px] text-on-surface-variant">
                      ₱{thisUnit.toFixed(2)}/{ingredient?.unit ?? "kg"} this buy · new avg cost <span className="font-bold text-primary">₱{newAvg.toFixed(2)}/{ingredient?.unit ?? "kg"}</span> · logged to expenses
                    </p>
                  );
                })()}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-outline uppercase tracking-wider">Internal Notes</label>
              <textarea
                className="w-full rounded-xl border border-outline-variant/40 p-4 text-sm focus:border-primary focus:outline-none min-h-[90px]"
                placeholder="Optional: batch number, supplier name, or spoilage notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="px-5 py-4 bg-surface-container border-t border-outline-variant/10 flex flex-col gap-2">
            {error && <p className="text-xs text-error">{error}</p>}
            {saved && <p className="text-xs text-secondary font-semibold flex items-center gap-1"><Icon name="check_circle" size={14} /> Adjustment saved!</p>}
            <div className="flex gap-3">
              <button onClick={onBack} className="flex-1 sm:flex-none px-5 h-10 rounded-lg border border-outline text-primary font-semibold hover:bg-surface-variant transition-colors text-sm">Cancel</button>
              <button
                onClick={handleConfirm}
                disabled={saving || !ingredient || amount <= 0}
                className="flex-1 sm:flex-none px-6 h-10 rounded-lg bg-primary text-white font-bold shadow-md hover:opacity-90 active:scale-95 transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Confirm Adjustment"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex gap-3 p-4 rounded-xl bg-secondary-container/30 border border-secondary/10">
            <Icon name="info" size={18} className="text-secondary shrink-0 mt-0.5" />
            <div>
              <h5 className="font-semibold text-on-secondary-container text-sm">Standardization Warning</h5>
              <p className="text-xs text-on-secondary-container/80 mt-1">Adjustments must be in absolute units. System converts partial bag weights based on 25 kg standard.</p>
            </div>
          </div>
          <div className="flex gap-3 p-4 rounded-xl bg-tertiary-fixed/20 border border-tertiary-fixed/40">
            <Icon name="history" size={18} className="text-on-tertiary-fixed-variant shrink-0 mt-0.5" />
            <div>
              <h5 className="font-semibold text-on-tertiary-fixed-variant text-sm">Recent History</h5>
              {recentHistory.length === 0 ? (
                <p className="mt-2 text-xs text-on-tertiary-fixed-variant/60">No adjustments yet.</p>
              ) : (
                <ul className="mt-2 text-xs text-on-tertiary-fixed-variant/80 space-y-1.5">
                  {recentHistory.map((h, i) => (
                    <li key={i} className="flex justify-between border-b border-on-tertiary-fixed-variant/10 pb-1 last:border-0">
                      <span>{new Date(h.created_at).toLocaleDateString()} · {h.reason}</span>
                      <span className="font-mono">{h.delta >= 0 ? "+" : ""}{h.delta.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
