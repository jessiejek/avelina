import React, { useRef, useState } from "react";
import { Ingredient } from "../data/inventory.ts";
import { Recipe } from "../data/recipes.ts";
import Icon from "../components/Icon.tsx";

interface Props {
  onBack: () => void;
  onInitiateBake: (recipe: Recipe) => void;
  inventory: Ingredient[];
  recipe: Recipe;
}

interface RecipeRow {
  ingredientId: string;
  qty: string;
  unit: string;
}

const initialSteps = [
  { num: "01", title: "Autolyse", description: "Combine the bread flour and 700g of the water in a large mixing bowl. Mix until no dry flour remains. Cover and rest at room temperature for 45–60 minutes." },
  { num: "02", title: "Levain & Salt Incorporation", description: "Add the active levain and remaining 50g water to the autolysed dough. Use the slap-and-fold technique for 8–10 minutes until fully incorporated. Add sea salt and work in evenly." },
  { num: "03", title: "Bulk Fermentation — Stretch & Fold", description: "Transfer to a clear container. Over the next 4 hours, perform 4 sets of stretch and folds at 30-minute intervals. Ferment until dough has grown by 75–80% and passes the windowpane test." },
];

export default function RecipeBuilder({ onBack, onInitiateBake, inventory, recipe }: Props) {
  const [rows, setRows] = useState<RecipeRow[]>(() => {
    if (recipe.ingredients.length > 0) {
      return recipe.ingredients.map((ri) => ({
        ingredientId: ri.ingredientId || inventory.find((x) => x.name === ri.name)?.id || inventory[0]?.id || "",
        qty: ri.qty,
        unit: ri.unit,
      }));
    }
    return inventory.slice(0, 4).map((ing) => ({ ingredientId: ing.id, qty: "100", unit: ing.unit }));
  });
  const [steps, setSteps] = useState(() =>
    recipe.steps.length > 0 ? recipe.steps : initialSteps
  );
  const [photo, setPhoto] = useState<string>(recipe.img);
  const [recipeName, setRecipeName] = useState(recipe.name);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPhoto(URL.createObjectURL(file));
  };

  const addRow = () => setRows((prev) => [...prev, { ingredientId: inventory[0]?.id ?? "", qty: "0", unit: inventory[0]?.unit ?? "g" }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof RecipeRow, value: string) => {
    setRows((prev) => prev.map((r, idx) => {
      if (idx !== i) return r;
      if (field === "ingredientId") {
        const ing = inventory.find((x) => x.id === value);
        return { ...r, ingredientId: value, unit: ing?.unit ?? r.unit };
      }
      return { ...r, [field]: value };
    }));
  };
  const getIngredient = (id: string) => inventory.find((x) => x.id === id);
  const statusStyle = (s: string) => {
    if (s === "optimal") return "bg-secondary-container text-on-secondary-container";
    if (s === "low") return "bg-tertiary-fixed text-on-tertiary-fixed-variant";
    return "bg-error-container text-on-error-container";
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <nav className="flex items-center gap-1 text-sm text-on-surface-variant">
          <button onClick={onBack} className="hover:text-primary transition-colors px-2 py-1 flex items-center gap-1">
            <Icon name="arrow_back" size={14} /> Recipes
          </button>
          <Icon name="chevron_right" size={14} className="text-outline-variant" />
          <span className="text-primary font-semibold px-2 py-1 truncate max-w-[200px]" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{recipeName}</span>
        </nav>
        <div className="flex items-center gap-3">
          <button className="px-4 h-9 rounded-lg border border-outline text-primary text-xs font-semibold hover:bg-surface-container transition-colors">
            Save Draft
          </button>
          <button
            onClick={() => onInitiateBake({ ...recipe, name: recipeName, img: photo })}
            className="px-5 h-9 rounded-lg bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-all active:scale-95 flex items-center gap-2"
          >
            <Icon name="oven_gen" size={14} />
            Initiate Bake
          </button>
        </div>
      </header>

      <div className="p-8 lg:p-12 max-w-7xl mx-auto w-full space-y-8">
        {/* Hero Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl border border-primary/10 p-6 space-y-4">
            <input
              className="w-full bg-transparent border-none focus:outline-none text-primary font-bold"
              style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 40, lineHeight: "48px", letterSpacing: "-0.02em" }}
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
            />
            <textarea
              className="w-full bg-transparent border-none focus:outline-none text-on-surface-variant text-base italic resize-none"
              rows={2}
              defaultValue="A classic open-crumb country loaf with complex fermentation notes."
            />
            <div className="grid grid-cols-4 gap-4 pt-4 border-t border-outline-variant/10">
              {[
                { label: "Prep Time", value: "45 min" },
                { label: "Fermentation", value: recipe.time },
                { label: "Difficulty", value: "Advanced" },
                { label: "Yield", value: recipe.yield },
              ].map((meta) => (
                <div key={meta.label}>
                  <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest mb-0.5">{meta.label}</p>
                  <p className="font-bold text-primary text-sm font-mono">{meta.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl overflow-hidden relative" style={{ aspectRatio: "4/3" }}>
            <img src={photo} alt={recipeName} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-4 right-4 bg-surface-container-lowest/90 backdrop-blur-sm text-primary px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-outline-variant/30 hover:bg-surface-container-lowest transition-colors shadow-sm"
            >
              <Icon name="photo_camera" size={14} /> Change Photo
            </button>
          </div>
        </div>

        {/* Ingredients */}
        <section className="space-y-3">
          <h3 className="font-semibold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Ingredients</h3>

          {inventory.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-outline-variant/40 py-12 text-center">
              <Icon name="inventory_2" size={32} className="text-outline mx-auto mb-2" />
              <p className="text-sm text-on-surface-variant">Your inventory is empty. Add ingredients first.</p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant/20">
                      <th className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Ingredient</th>
                      <th className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest w-32">Qty</th>
                      <th className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest w-24">Unit</th>
                      <th className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest text-right">Stock</th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {rows.map((row, i) => {
                      const ing = getIngredient(row.ingredientId);
                      return (
                        <tr key={i} className="hover:bg-surface-container-lowest/50 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              {ing && <div className="w-7 h-7 rounded-md overflow-hidden shrink-0"><img src={ing.img} alt={ing.name} className="w-full h-full object-cover" /></div>}
                              <select
                                className="flex-1 bg-transparent border-none focus:outline-none text-sm font-semibold text-primary min-w-0"
                                value={row.ingredientId}
                                onChange={(e) => updateRow(i, "ingredientId", e.target.value)}
                              >
                                {inventory.map((inv) => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                              </select>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <input className="w-full bg-surface-container px-2 py-1.5 rounded text-sm text-center border border-outline-variant/30 focus:outline-none font-mono" value={row.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} />
                          </td>
                          <td className="px-6 py-3">
                            <select className="w-full bg-surface-container px-2 py-1.5 rounded text-xs font-bold border border-outline-variant/30 focus:outline-none font-mono" value={row.unit} onChange={(e) => updateRow(i, "unit", e.target.value)}>
                              <option>kg</option><option>g</option><option>L</option><option>ml</option><option>units</option>
                            </select>
                          </td>
                          <td className="px-6 py-3 text-right">
                            {ing && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusStyle(ing.status)}`}>
                                {ing.status === "optimal" ? "OK" : ing.status === "low" ? "Low" : "Out"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <button onClick={() => removeRow(i)} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-all">
                              <Icon name="close" size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button onClick={addRow} className="w-full py-3 rounded-xl border-2 border-dashed border-outline-variant/40 text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                <Icon name="add" size={16} strokeWidth={2.5} /> Add Ingredient Row
              </button>
            </>
          )}
        </section>

        {/* Production Steps */}
        <section className="space-y-4">
          <h3 className="font-semibold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Production Process</h3>
          {steps.map((step) => (
            <div key={step.num} className="bg-surface-container-lowest rounded-xl border border-primary/10 p-6 flex gap-6">
              <div className="shrink-0 text-primary/10 select-none font-bold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 64, lineHeight: 1 }}>{step.num}</div>
              <div className="flex-1 pt-1">
                <input className="w-full bg-transparent border-none focus:outline-none font-semibold text-primary mb-2" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }} defaultValue={step.title} />
                <textarea className="w-full bg-transparent border-none focus:outline-none text-sm text-on-surface-variant resize-none leading-relaxed" rows={3} defaultValue={step.description} />
              </div>
            </div>
          ))}
          <button
            onClick={() => setSteps((prev) => [...prev, { num: String(prev.length + 1).padStart(2, "0"), title: "New Step", description: "" }])}
            className="w-full py-4 rounded-xl border-2 border-dashed border-outline-variant/40 text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
          >
            <Icon name="add" size={16} strokeWidth={2.5} /> Add Step
          </button>
        </section>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t border-outline-variant/10">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors">
            <Icon name="arrow_back" size={16} /> Back to Recipes
          </button>
          <button
            onClick={() => onInitiateBake({ ...recipe, name: recipeName, img: photo })}
            className="px-8 h-12 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center gap-2"
          >
            <Icon name="oven_gen" size={16} /> Initiate Bake
          </button>
        </div>
      </div>
    </div>
  );
}
