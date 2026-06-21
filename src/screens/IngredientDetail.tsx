import React, { useState } from "react";
import Icon from "../components/Icon.tsx";

interface Props {
  onBack: () => void;
  onAdjustStock: () => void;
}

export default function IngredientDetail({ onBack, onAdjustStock }: Props) {
  const [measureTab, setMeasureTab] = useState<"mass" | "volume" | "count">("mass");

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="lg:hidden p-2 text-on-surface-variant">
            <Icon name="menu" size={20} />
          </button>
          <nav className="hidden md:flex items-center gap-1">
            <button onClick={onBack} className="text-sm text-on-surface-variant hover:text-primary transition-colors px-2 py-1">Inventory</button>
            <Icon name="chevron_right" size={14} className="text-outline-variant" />
            <span className="text-sm text-primary font-semibold px-2 py-1">Ingredient Detail</span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input className="pl-9 pr-4 py-1.5 bg-surface-container border border-outline-variant/30 rounded-full text-sm w-52 focus:outline-none" placeholder="Search ingredients..." />
          </div>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
            <Icon name="notifications" size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex justify-between items-end mb-8">
            <div>
              <button onClick={onBack} className="flex items-center gap-1.5 text-outline mb-2 hover:text-primary transition-colors text-xs font-semibold uppercase tracking-wide">
                <Icon name="arrow_back" size={14} />
                Back to Inventory
              </button>
              <h1 className="text-primary font-bold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 32 }}>
                Organic Bread Flour
              </h1>
            </div>
            <div className="flex gap-3">
              <button onClick={onAdjustStock} className="h-10 px-5 rounded-lg border border-outline text-on-surface font-semibold hover:bg-surface-container transition-colors flex items-center gap-2 text-sm">
                <Icon name="scale" size={16} />
                Adjust Stock
              </button>
              <button className="h-10 px-6 rounded-lg bg-primary text-on-primary font-bold hover:opacity-90 transition-opacity text-sm">
                Save Changes
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20">
                <h2 className="font-semibold text-primary mb-4 pb-2 border-b border-outline-variant/10 text-base">Core Specifications</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Ingredient Name</label>
                      <input className="w-full bg-surface-bright border border-outline-variant/40 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary focus:outline-none focus:border-primary/50" defaultValue="Organic Bread Flour" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">SKU / Reference</label>
                      <input className="w-full bg-surface-bright border border-outline-variant/40 px-4 py-2.5 rounded-lg text-sm text-on-surface-variant focus:outline-none font-mono" defaultValue="FLR-ORG-HRD-001" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Shelf Life</label>
                      <div className="relative">
                        <input className="w-full bg-surface-bright border border-outline-variant/40 px-4 py-2.5 rounded-lg text-sm focus:outline-none" type="number" defaultValue={180} />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-outline font-mono">days</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20">
                <h2 className="font-semibold text-primary mb-4 pb-2 border-b border-outline-variant/10 text-base">Inventory Control</h2>
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Measurement Strategy</label>
                    <div className="flex bg-surface-container p-1 rounded-lg">
                      {(["mass", "volume", "count"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setMeasureTab(tab)}
                          className={`flex-1 py-2 text-xs font-semibold uppercase rounded transition-all ${measureTab === tab ? "bg-surface-container-lowest text-primary shadow-sm" : "text-outline hover:text-on-surface"}`}
                        >
                          {tab === "mass" ? "Mass (Weight)" : tab}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Current Stock</label>
                      <div className="flex">
                        <input className="flex-1 bg-surface-bright border border-outline-variant/40 px-4 py-2.5 rounded-l-lg text-base font-bold text-primary focus:outline-none font-mono" type="number" defaultValue={45.5} />
                        <select className="w-20 bg-surface-container-high border border-l-0 border-outline-variant/40 px-2 rounded-r-lg text-xs font-bold text-on-surface-variant focus:outline-none font-mono">
                          <option>kg</option><option>g</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Low Stock Warning</label>
                      <div className="flex">
                        <input className="flex-1 bg-surface-bright border border-outline-variant/40 px-4 py-2.5 rounded-l-lg text-base font-bold text-on-tertiary-container focus:outline-none font-mono" type="number" defaultValue={15.0} />
                        <select className="w-20 bg-surface-container-high border border-l-0 border-outline-variant/40 px-2 rounded-r-lg text-xs font-bold text-on-surface-variant focus:outline-none font-mono">
                          <option>kg</option><option>g</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20">
                <label className="block font-semibold text-primary mb-4 pb-2 border-b border-outline-variant/10 text-base">Internal Kitchen Notes</label>
                <textarea className="w-full bg-surface-bright border border-outline-variant/40 px-4 py-3 rounded-lg text-sm italic text-on-surface-variant focus:outline-none" placeholder="Sourced from Miller's Mill. High protein content (12.5%)." rows={3} />
              </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-5 space-y-5">
              <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-outline-variant/20 group shadow-lg">
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCpSnC71P8IBi6VGgsyrsm0jMtSjUwWW6bdfRJ5yE7C-v6Qf-CM7jNvJYs3JNr-O3K0Dgg2Nd1eRjAJ9WVwaxRKvKqYjBlVLa_icCC7iKLMDm4gU1sYsgys3wFc6NJAc9aTwMM9LnvBj-hg-YFR33Tu0IJx4glef1ST0pQB6GQqcn_6oxNUfLiscc_l3_IX1lwfW7Z0xlZyWBSA8H4VO7CE2o03FzpDIpzk_cUu3S2PAj9sIiUsIVChaduWlKCN0HhwS7L_iWYrIExc" alt="Flour" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-5 left-5 text-white">
                  <span className="text-[10px] uppercase tracking-[0.2em] opacity-80">Inventory Visualization</span>
                  <h3 className="font-bold text-sm mt-0.5">Grade A – Hard Wheat</h3>
                </div>
              </div>

              <div className="bg-secondary-container p-5 rounded-xl border border-secondary/20">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-on-secondary-container font-bold text-sm">Stock Health</span>
                  <span className="bg-secondary text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Optimal</span>
                </div>
                <div className="w-full bg-white/30 h-2.5 rounded-full mb-2 overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: "78%" }} />
                </div>
                <p className="text-on-secondary-container text-xs opacity-80">Covers approx. 12 production cycles based on average usage.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container p-4 rounded-xl border border-outline-variant/20">
                  <Icon name="trending_up" size={18} className="text-primary mb-2" />
                  <span className="block text-[10px] font-semibold text-outline uppercase tracking-wider">Monthly Usage</span>
                  <span className="font-bold text-primary text-base font-mono">142.8 kg</span>
                </div>
                <div className="bg-surface-container p-4 rounded-xl border border-outline-variant/20">
                  <Icon name="history" size={18} className="text-primary mb-2" />
                  <span className="block text-[10px] font-semibold text-outline uppercase tracking-wider">Last Restock</span>
                  <span className="font-bold text-primary text-base font-mono">04 Oct</span>
                </div>
                <div className="col-span-2 bg-surface-container-high p-4 rounded-xl border border-outline-variant/30 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-semibold text-outline uppercase tracking-wider">Vendor Primary</span>
                    <span className="font-bold text-primary text-sm">Miller's Grain Co.</span>
                  </div>
                  <Icon name="local_shipping" size={20} className="text-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
