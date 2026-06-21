import React, { useState } from "react";
import Icon from "../components/Icon.tsx";

interface Props {
  onBack: () => void;
}

export default function StockAdjustment({ onBack }: Props) {
  const [mode, setMode] = useState<"add" | "sub">("add");
  const [amount, setAmount] = useState(0);
  const [unit, setUnit] = useState("kg");
  const base = 142.50;

  const factor = unit === "g" ? 0.001 : unit === "bags" ? 25 : 1;
  const adjKg = amount * factor;
  const projected = mode === "add" ? base + adjKg : base - adjKg;

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
        {/* Current State Card */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-6 mb-6 flex items-center justify-between gap-4" style={{ boxShadow: "0 4px 12px -2px rgba(61,43,31,0.07)" }}>
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-outline-variant/20 shrink-0">
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCpSnC71P8IBi6VGgsyrsm0jMtSjUwWW6bdfRJ5yE7C-v6Qf-CM7jNvJYs3JNr-O3K0Dgg2Nd1eRjAJ9WVwaxRKvKqYjBlVLa_icCC7iKLMDm4gU1sYsgys3wFc6NJAc9aTwMM9LnvBj-hg-YFR33Tu0IJx4glef1ST0pQB6GQqcn_6oxNUfLiscc_l3_IX1lwfW7Z0xlZyWBSA8H4VO7CE2o03FzpDIpzk_cUu3S2PAj9sIiUsIVChaduWlKCN0HhwS7L_iWYrIExc" alt="Flour" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-on-tertiary-container bg-tertiary-fixed px-2 py-0.5 rounded uppercase tracking-wide mb-1 inline-block">Ingredient</span>
              <h3 className="text-primary font-bold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Organic Bread Flour (T65)</h3>
              <p className="text-sm text-outline font-mono">SKU: FLR-O-T65-25KG · Last Audit: 4h ago</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-semibold text-outline uppercase tracking-wider mb-1">Current Level</p>
            <p className="text-primary font-bold font-mono" style={{ fontSize: 32 }}>142.50 <span className="text-base opacity-60">kg</span></p>
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
                    type="number" step={0.01}
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
                  <select className="w-full h-full rounded-lg border border-outline-variant/40 focus:border-primary focus:outline-none appearance-none px-4 text-sm bg-surface-bright">
                    <option>New Shipment Received</option>
                    <option>Spoilage / Waste</option>
                    <option>Inventory Correction</option>
                    <option>Inter-Kitchen Transfer</option>
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
                <p className="text-primary/40 font-bold font-mono" style={{ fontSize: 28 }}>142.50 <span className="text-sm">kg</span></p>
              </div>
              <div className="flex flex-col items-center">
                <Icon name="trending_flat" size={28} className="text-primary" />
                <span className={`text-xs font-bold px-3 py-1 rounded-full mt-2 font-mono ${mode === "add" ? "bg-secondary text-white" : "bg-error text-white"}`}>
                  {mode === "add" ? "+" : "-"}{adjKg.toFixed(2)} kg
                </span>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-outline mb-2 uppercase tracking-wider">Projected After</p>
                <p className="text-primary font-bold font-mono" style={{ fontSize: 36 }}>{projected.toFixed(2)} <span className="text-lg">kg</span></p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-outline uppercase tracking-wider">Internal Notes</label>
              <textarea className="w-full rounded-xl border border-outline-variant/40 p-4 text-sm focus:border-primary focus:outline-none min-h-[90px]" placeholder="Optional: batch number, supplier name, or spoilage notes..." />
            </div>
          </div>

          <div className="px-8 py-5 bg-surface-container border-t border-outline-variant/10 flex justify-end gap-3">
            <button onClick={onBack} className="px-6 h-10 rounded-lg border border-outline text-primary font-semibold hover:bg-surface-variant transition-colors text-sm">Cancel</button>
            <button className="px-8 h-10 rounded-lg bg-primary text-white font-bold shadow-md hover:opacity-90 active:scale-95 transition-all text-sm">Confirm Adjustment</button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex gap-3 p-4 rounded-xl bg-secondary-container/30 border border-secondary/10">
            <Icon name="info" size={18} className="text-secondary shrink-0 mt-0.5" />
            <div>
              <h5 className="font-semibold text-on-secondary-container text-sm">Standardization Warning</h5>
              <p className="text-xs text-on-secondary-container/80 mt-1">Adjustments must be in absolute units. System converts partial bag weights based on 25kg standard.</p>
            </div>
          </div>
          <div className="flex gap-3 p-4 rounded-xl bg-tertiary-fixed/20 border border-tertiary-fixed/40">
            <Icon name="history" size={18} className="text-on-tertiary-fixed-variant shrink-0 mt-0.5" />
            <div>
              <h5 className="font-semibold text-on-tertiary-fixed-variant text-sm">Recent History</h5>
              <ul className="mt-2 text-xs text-on-tertiary-fixed-variant/80 space-y-1.5">
                <li className="flex justify-between border-b border-on-tertiary-fixed-variant/10 pb-1">
                  <span>2 days ago · Delivery</span>
                  <span className="font-mono">+500.00 kg</span>
                </li>
                <li className="flex justify-between">
                  <span>Today · Baking Loss</span>
                  <span className="font-mono">-12.40 kg</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
