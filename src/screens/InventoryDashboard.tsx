import React, { useState } from "react";
import { Ingredient } from "../data/inventory.ts";
import Icon from "../components/Icon.tsx";

interface Props {
  ingredients: Ingredient[];
  onAddIngredient: (ing: Ingredient) => void;
  onViewIngredient: (id: string) => void;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  optimal: { label: "Optimal", bg: "bg-secondary-container", text: "text-on-secondary-container", dot: "bg-secondary" },
  low: { label: "Low Stock", bg: "bg-tertiary-fixed", text: "text-on-tertiary-fixed-variant", dot: "bg-on-tertiary-container" },
  critical: { label: "Out of Stock", bg: "bg-error-container", text: "text-on-error-container", dot: "bg-error" },
};

const iconOptions = ["grain", "water_drop", "science", "auto_awesome", "egg", "cake", "local_cafe", "cookie", "nutrition", "set_meal"];

interface NewIngForm {
  name: string;
  sku: string;
  stockValue: string;
  unit: string;
  status: "optimal" | "low" | "critical";
  icon: string;
}

const emptyForm: NewIngForm = { name: "", sku: "", stockValue: "", unit: "kg", status: "optimal", icon: "grain" };

export default function InventoryDashboard({ ingredients, onAddIngredient, onViewIngredient }: Props) {
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewIngForm>(emptyForm);
  const [search, setSearch] = useState("");

  const attention = ingredients.filter((i) => i.status === "low" || i.status === "critical");
  const filtered = ingredients.filter((i) => {
    const matchCat = filter === "all" || (filter === "low" && i.status === "low") || (filter === "out" && i.status === "critical");
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const val = parseFloat(form.stockValue) || 0;
    const newIng: Ingredient = {
      id: `ing-${Date.now()}`,
      name: form.name.trim(),
      sku: form.sku.trim() || `ING-${Date.now()}`,
      stock: `${val} ${form.unit}`,
      stockValue: val,
      unit: form.unit,
      status: form.status,
      icon: form.icon,
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCpSnC71P8IBi6VGgsyrsm0jMtSjUwWW6bdfRJ5yE7C-v6Qf-CM7jNvJYs3JNr-O3K0Dgg2Nd1eRjAJ9WVwaxRKvKqYjBlVLa_icCC7iKLMDm4gU1sYsgys3wFc6NJAc9aTwMM9LnvBj-hg-YFR33Tu0IJx4glef1ST0pQB6GQqcn_6oxNUfLiscc_l3_IX1lwfW7Z0xlZyWBSA8H4VO7CE2o03FzpDIpzk_cUu3S2PAj9sIiUsIVChaduWlKCN0HhwS7L_iWYrIExc",
    };
    onAddIngredient(newIng);
    setForm(emptyForm);
    setShowModal(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      {/* TopBar */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <h1 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Inventory</h1>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex bg-surface-container rounded-full px-3 py-1.5 items-center gap-2 border border-outline-variant/20">
            <Icon name="search" size={16} className="text-outline" />
            <input
              className="bg-transparent border-none focus:outline-none text-sm w-44 text-on-surface placeholder:text-on-surface-variant/60"
              placeholder="Search ingredients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors text-on-surface-variant">
            <Icon name="notifications" size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[11px] font-bold text-on-primary">BM</span>
          </div>
        </div>
      </header>

      <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6">
        {/* Needs Attention */}
        {attention.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-semibold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 16 }}>Needs Attention</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {attention.map((item) => (
                <div key={item.id} className={`flex items-center gap-3 p-4 rounded-xl border ${item.status === "critical" ? "bg-error-container/30 border-error/20" : "bg-tertiary-fixed/30 border-on-tertiary-container/20"}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.status === "critical" ? "bg-error-container text-error" : "bg-tertiary-fixed text-on-tertiary-fixed-variant"}`}>
                    <Icon name={item.icon} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary text-sm truncate">{item.name}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{item.stock} remaining</p>
                  </div>
                  <button
                    onClick={() => onViewIngredient(item.id)}
                    className="shrink-0 px-3 h-8 rounded-lg text-xs font-semibold border border-outline text-primary hover:bg-surface-container transition-colors"
                  >
                    Order
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Filter + Add */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex gap-2 flex-wrap">
            {[{ key: "all", label: "All" }, { key: "low", label: "Low Stock" }, { key: "out", label: "Out of Stock" }].map((pill) => (
              <button
                key={pill.key}
                onClick={() => setFilter(pill.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === pill.key ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}
              >
                {pill.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 h-9 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-all active:scale-95 shrink-0"
            style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
          >
            <Icon name="add" size={16} strokeWidth={2.5} />
            Add Ingredient
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const s = statusConfig[item.status];
            return (
              <div
                key={item.id}
                onClick={() => onViewIngredient(item.id)}
                className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group"
              >
                <div className="aspect-[16/9] overflow-hidden bg-surface-container">
                  <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-primary text-sm leading-tight truncate" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{item.name}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5 font-mono">{item.sku}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${s.bg} ${s.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
                    <span className="text-sm font-bold text-primary font-mono">{item.stock}</span>
                    <button className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition-colors">
                      <Icon name="scale" size={14} />
                      <span>Adjust</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-3 py-16 text-center text-on-surface-variant text-sm">No ingredients match your filter.</div>
          )}
        </div>
      </div>

      {/* Add Ingredient Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(29,27,26,0.5)" }}>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/10">
              <h3 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>Add New Ingredient</h3>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); }} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors">
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Ingredient Name *</label>
                <input
                  className="w-full bg-surface-bright border border-outline-variant px-4 py-2.5 rounded-lg text-sm text-primary font-medium focus:outline-none focus:border-primary/50"
                  placeholder="e.g. Whole Wheat Flour"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">SKU / Reference</label>
                <input
                  className="w-full bg-surface-bright border border-outline-variant px-4 py-2.5 rounded-lg text-sm text-on-surface-variant focus:outline-none focus:border-primary/50 font-mono"
                  placeholder="FLR-WHT-001"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Initial Stock</label>
                  <input
                    className="w-full bg-surface-bright border border-outline-variant px-4 py-2.5 rounded-lg text-sm font-bold text-primary focus:outline-none focus:border-primary/50 font-mono"
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="0.0"
                    value={form.stockValue}
                    onChange={(e) => setForm((f) => ({ ...f, stockValue: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Unit</label>
                  <select
                    className="w-full bg-surface-bright border border-outline-variant px-4 py-2.5 rounded-lg text-sm text-primary font-bold focus:outline-none font-mono"
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  >
                    <option>kg</option><option>g</option><option>L</option><option>ml</option><option>units</option><option>bags</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Stock Status</label>
                <div className="flex gap-2">
                  {(["optimal", "low", "critical"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setForm((f) => ({ ...f, status: s }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all border ${
                        form.status === s
                          ? s === "optimal" ? "bg-secondary-container text-on-secondary-container border-secondary/30"
                            : s === "low" ? "bg-tertiary-fixed text-on-tertiary-fixed-variant border-on-tertiary-container/30"
                            : "bg-error-container text-on-error-container border-error/30"
                          : "bg-surface-container text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-high"
                      }`}
                    >
                      {s === "optimal" ? "Optimal" : s === "low" ? "Low" : "Out"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {iconOptions.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                      title={ic}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all border ${form.icon === ic ? "bg-primary text-on-primary border-primary" : "bg-surface-container text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-high"}`}
                    >
                      <Icon name={ic} size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant/10 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); setForm(emptyForm); }}
                className="px-5 h-9 rounded-lg border border-outline text-primary text-sm font-semibold hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.name.trim()}
                className="px-5 h-9 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add to Inventory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
