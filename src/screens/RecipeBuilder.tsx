import React, { useRef, useState } from "react";
import { Ingredient } from "../data/inventory.ts";
import { Recipe } from "../data/recipes.ts";
import Icon from "../components/Icon.tsx";
import { supabase, uploadImage, validateImageFile } from "../lib/supabase.ts";

interface Props {
  onBack: () => void;
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

const YIELD_UNITS = ["units", "pcs", "loaves", "rolls", "slices", "trays", "dozen", "servings", "cakes", "jars"];
const YIELD_QTYS = ["1", "2", "3", "4", "6", "8", "10", "12", "16", "18", "24", "30", "36", "48", "60", "72", "100"];

// "18h 45m" -> { hours: "18", minutes: "45" }
function parseDuration(t: string) {
  const h = /(\d+)\s*h/i.exec(t || "");
  const m = /(\d+)\s*m/i.exec(t || "");
  return { hours: h ? h[1] : "", minutes: m ? m[1] : "" };
}
function composeDuration(hours: string, minutes: string) {
  return [hours && `${hours}h`, minutes && `${minutes}m`].filter(Boolean).join(" ");
}
// "24 units" -> { qty: "24", unit: "units" }
function parseYield(y: string) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(.*)$/.exec(y || "");
  return { qty: m ? m[1] : "", unit: m && m[2].trim() ? m[2].trim() : "units" };
}

export default function RecipeBuilder({ onBack, inventory, recipe }: Props) {
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [recipeName, setRecipeName] = useState(recipe.name);
  const [description, setDescription] = useState(recipe.description ?? "");
  const [difficulty, setDifficulty] = useState(recipe.difficulty ?? "");
  const initTime = parseDuration(recipe.time ?? "");
  const [hours, setHours] = useState(initTime.hours);
  const [minutes, setMinutes] = useState(initTime.minutes);
  const [prepMinutes, setPrepMinutes] = useState((recipe.prep_time ?? "").match(/\d+/)?.[0] ?? "");
  const initYield = parseYield(recipe.yield ?? "");
  const [yieldQty, setYieldQty] = useState(initYield.qty);
  const [yieldUnit, setYieldUnit] = useState(initYield.unit);

  const totalTime = composeDuration(hours, minutes);
  const yieldAmt = yieldQty ? `${yieldQty} ${yieldUnit}` : "";
  const prepTime = prepMinutes ? `${prepMinutes} min` : "";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError("");

    let finalImg = photo;
    if (photoFile) {
      try { finalImg = await uploadImage("recipe-images", photoFile); setPhoto(finalImg); setPhotoFile(null); }
      catch (e: any) { setSaveError("Photo upload failed: " + e.message); setSaving(false); return; }
    }

    // Update recipe basics
    const { error: recErr } = await supabase.from("recipes").update({ name: recipeName, img: finalImg, description, prep_time: prepTime || null, difficulty: difficulty || null, time: totalTime || null, yield: yieldAmt || null }).eq("id", recipe.id);
    if (recErr) { setSaveError(recErr.message); setSaving(false); return; }
    // Replace ingredients
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipe.id);
    for (const row of rows) {
      if (!row.ingredientId) continue;
      await supabase.from("recipe_ingredients").insert({ recipe_id: recipe.id, ingredient_id: row.ingredientId, qty: row.qty, unit: row.unit });
    }
    // Replace steps
    await supabase.from("recipe_steps").delete().eq("recipe_id", recipe.id);
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await supabase.from("recipe_steps").insert({ recipe_id: recipe.id, num: s.num, title: s.title, description: s.description, sort_order: i });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const err = validateImageFile(file); if (err) { setSaveError(err); return; } setPhotoFile(file); setPhoto(URL.createObjectURL(file)); setSaveError(""); }
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
          <span className="text-primary font-semibold px-2 py-1 truncate max-w-[200px]" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Edit: {recipeName}</span>
        </nav>
        <div className="flex items-center gap-3">
          {saveError && <p className="text-xs text-error">{saveError}</p>}
          <button onClick={handleSave} disabled={saving} className="px-5 h-9 rounded-lg bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-all active:scale-95 disabled:opacity-50">
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </header>

      <div className="p-4 lg:p-12 max-w-7xl mx-auto w-full space-y-6">
        {/* Hero Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl border border-primary/10 p-6 space-y-4">
            <input
              className="w-full bg-transparent border-none focus:outline-none text-primary font-bold text-2xl lg:text-[40px] lg:leading-[48px]"
              style={{ fontFamily: "'Hanken Grotesk', sans-serif", letterSpacing: "-0.02em" }}
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
            />
            <textarea
              className="w-full bg-transparent border-none focus:outline-none text-on-surface-variant text-sm italic resize-none"
              rows={2}
              placeholder="Short description of this recipe…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-outline-variant/10">
              <div>
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Total Time</p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text" inputMode="numeric" maxLength={3}
                    className="w-12 bg-surface-container border border-outline-variant/40 rounded-lg px-2 py-1.5 text-sm font-bold text-primary font-mono text-center focus:outline-none focus:border-primary/50"
                    value={hours}
                    onChange={(e) => setHours(e.target.value.replace(/\D/g, ""))}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                  />
                  <span className="text-xs font-semibold text-on-surface-variant">h</span>
                  <input
                    type="text" inputMode="numeric" maxLength={2}
                    className="w-12 bg-surface-container border border-outline-variant/40 rounded-lg px-2 py-1.5 text-sm font-bold text-primary font-mono text-center focus:outline-none focus:border-primary/50"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                  />
                  <span className="text-xs font-semibold text-on-surface-variant">m</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Yield</p>
                <div className="flex items-center gap-1">
                  <select
                    className="w-14 bg-surface-container border border-outline-variant/40 rounded-lg px-1.5 py-1.5 text-sm font-bold text-primary font-mono focus:outline-none focus:border-primary/50"
                    value={yieldQty}
                    onChange={(e) => setYieldQty(e.target.value)}
                  >
                    <option value="">—</option>
                    {(yieldQty && !YIELD_QTYS.includes(yieldQty) ? [yieldQty, ...YIELD_QTYS] : YIELD_QTYS).map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                  <select
                    className="flex-1 min-w-0 bg-surface-container border border-outline-variant/40 rounded-lg px-2 py-1.5 text-xs font-bold text-primary focus:outline-none focus:border-primary/50"
                    value={yieldUnit}
                    onChange={(e) => setYieldUnit(e.target.value)}
                  >
                    {(YIELD_UNITS.includes(yieldUnit) ? YIELD_UNITS : [yieldUnit, ...YIELD_UNITS]).map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Prep Time</p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text" inputMode="numeric" maxLength={3}
                    className="w-12 bg-surface-container border border-outline-variant/40 rounded-lg px-2 py-1.5 text-sm font-bold text-primary font-mono text-center focus:outline-none focus:border-primary/50"
                    value={prepMinutes}
                    onChange={(e) => setPrepMinutes(e.target.value.replace(/\D/g, ""))}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                  />
                  <span className="text-xs font-semibold text-on-surface-variant">min</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest mb-1">Difficulty</p>
                <select
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-2 py-1.5 text-sm font-bold text-primary focus:outline-none focus:border-primary/50"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="">—</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
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
              {/* Mobile: cards */}
              <div className="lg:hidden space-y-2">
                {rows.map((row, i) => {
                  const ing = getIngredient(row.ingredientId);
                  return (
                    <div key={i} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        {ing?.img && <div className="w-7 h-7 rounded-md overflow-hidden shrink-0"><img src={ing.img} alt={ing.name} className="w-full h-full object-cover" /></div>}
                        <select
                          className="flex-1 bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 text-sm font-semibold text-primary focus:outline-none min-w-0"
                          value={row.ingredientId}
                          onChange={(e) => updateRow(i, "ingredientId", e.target.value)}
                        >
                          {inventory.map((inv) => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                        </select>
                        <button onClick={() => removeRow(i)} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-all shrink-0">
                          <Icon name="close" size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] font-semibold text-outline uppercase tracking-wider">Qty</label>
                          <input className="w-full bg-surface-container px-3 py-1.5 rounded-lg text-sm text-center border border-outline-variant/30 focus:outline-none font-mono mt-0.5" value={row.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-semibold text-outline uppercase tracking-wider">Unit</label>
                          <select className="w-full bg-surface-container px-3 py-1.5 rounded-lg text-sm font-bold border border-outline-variant/30 focus:outline-none font-mono mt-0.5" value={row.unit} onChange={(e) => updateRow(i, "unit", e.target.value)}>
                            <option>kg</option><option>g</option><option>L</option><option>ml</option><option>units</option>
                          </select>
                        </div>
                        {ing && (
                          <div className="shrink-0 pt-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusStyle(ing.status)}`}>
                              {ing.status === "optimal" ? "OK" : ing.status === "low" ? "Low" : "Out"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant/20">
                      <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Ingredient</th>
                      <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest w-24">Qty</th>
                      <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest w-20">Unit</th>
                      <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest text-right">Stock</th>
                      <th className="px-3 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {rows.map((row, i) => {
                      const ing = getIngredient(row.ingredientId);
                      return (
                        <tr key={i} className="hover:bg-surface-container-lowest/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {ing?.img && <div className="w-7 h-7 rounded-md overflow-hidden shrink-0"><img src={ing.img} alt={ing.name} className="w-full h-full object-cover" /></div>}
                              <select className="flex-1 bg-transparent border-none focus:outline-none text-sm font-semibold text-primary min-w-0" value={row.ingredientId} onChange={(e) => updateRow(i, "ingredientId", e.target.value)}>
                                {inventory.map((inv) => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                              </select>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input className="w-full bg-surface-container px-2 py-1.5 rounded text-sm text-center border border-outline-variant/30 focus:outline-none font-mono" value={row.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} />
                          </td>
                          <td className="px-4 py-3">
                            <select className="w-full bg-surface-container px-2 py-1.5 rounded text-xs font-bold border border-outline-variant/30 focus:outline-none font-mono" value={row.unit} onChange={(e) => updateRow(i, "unit", e.target.value)}>
                              <option>kg</option><option>g</option><option>L</option><option>ml</option><option>units</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-right">
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
          {steps.map((step, i) => (
            <div key={i} className="bg-surface-container-lowest rounded-xl border border-primary/10 p-4 flex gap-4 relative">
              <div className="shrink-0 text-primary/15 select-none font-bold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 36, lineHeight: 1 }}>{step.num}</div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Step Title</label>
                  <input
                    className="w-full bg-surface-bright border border-outline-variant/40 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 font-semibold text-primary pr-8 placeholder:font-normal placeholder:text-on-surface-variant/40"
                    style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 15 }}
                    value={step.title}
                    onChange={(e) => setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, title: e.target.value } : s))}
                    placeholder="e.g. Mix the dough"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Instructions</label>
                  <textarea
                    className="w-full bg-surface-bright border border-outline-variant/40 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 text-sm text-on-surface resize-none leading-relaxed placeholder:text-on-surface-variant/40"
                    rows={3}
                    value={step.description}
                    onChange={(e) => setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, description: e.target.value } : s))}
                    placeholder="Describe what to do in this step…"
                  />
                </div>
              </div>
              <button
                onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, num: String(idx + 1).padStart(2, "0") })))}
                className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-outline hover:bg-error-container hover:text-error transition-all"
                title="Remove step"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setSteps((prev) => [...prev, { num: String(prev.length + 1).padStart(2, "0"), title: "", description: "" }])}
            className="w-full py-4 rounded-xl border-2 border-dashed border-outline-variant/40 text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
          >
            <Icon name="add" size={16} strokeWidth={2.5} /> Add Step
          </button>
        </section>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-4 border-t border-outline-variant/10">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors">
            <Icon name="arrow_back" size={16} /> Back to Recipes
          </button>
          <button onClick={handleSave} disabled={saving} className="h-12 px-8 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm">
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
