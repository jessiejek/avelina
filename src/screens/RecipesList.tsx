import React, { useRef, useState } from "react";
import Icon from "../components/Icon.tsx";
import { Recipe, RecipeIngredient, RecipeStep } from "../data/recipes.ts";
import { Ingredient } from "../data/inventory.ts";
import { supabase, uploadImage, validateImageFile } from "../lib/supabase.ts";

export type { Recipe };

const PLACEHOLDER_IMG = "https://lh3.googleusercontent.com/aida-public/AB6AXuCZEA9Bb0E92ttiNPKygaTFeC4dzXBznNOXNamZP3o7bVGUwv6Hzf4GvcLSLSKZaHSEF3WxskKkxdKPSd_UpV32ZH-EcJT0uepYb2E7k70ffBDdz1mpaIjvaXKtezW-QbHZYtSSphohNe2_MDahWfWGmhNIjR2Ax8tQrOW0W190tn8Xz7E_Y9ub1lA0KNjOJPeiilJF4d6ef2YjqGkwBr9QIYmpcyzX5E1ShDsdKblhprVsIrizOMrkIEP0sEWCHaO8zlS_AEyfbhtm";
const CATEGORIES = ["Sourdough", "Viennoiserie", "Cakes", "Pastry", "Bread", "Other"];

interface Props {
  recipes: Recipe[];
  inventory: Ingredient[];
  onAddRecipe: (r: Recipe) => void;
  onViewRecipe: (recipe: Recipe) => void;
}

function NewRecipeModal({ inventory, onSave, onClose }: { inventory: Ingredient[]; onSave: (r: Recipe) => void; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Sourdough");
  const [yieldAmt, setYieldAmt] = useState("");
  const [time, setTime] = useState("");
  const [img, setImg] = useState(PLACEHOLDER_IMG);
  const [imgFile, setImgFile] = useState<File | null>(null);
  type IngRow = RecipeIngredient & { rowType: "inventory" | "custom" };
  const [ingredients, setIngredients] = useState<IngRow[]>([
    { ingredientId: inventory[0]?.id ?? "", name: inventory[0]?.name ?? "", qty: "", unit: inventory[0]?.unit ?? "g", rowType: "inventory" },
  ]);
  const [steps, setSteps] = useState<RecipeStep[]>([
    { num: "01", title: "", description: "" },
  ]);
  const fileRef = useRef<HTMLInputElement>(null);

  const addIngredientRow = (rowType: "inventory" | "custom" = "inventory") => {
    const first = inventory[0];
    setIngredients((prev) => [...prev, {
      ingredientId: rowType === "inventory" ? (first?.id ?? "") : "",
      name: rowType === "inventory" ? (first?.name ?? "") : "",
      qty: "", unit: rowType === "inventory" ? (first?.unit ?? "g") : "g",
      rowType,
    }]);
  };

  const toggleRowType = (i: number) => {
    setIngredients((prev) => prev.map((row, idx) => {
      if (idx !== i) return row;
      const next = row.rowType === "inventory" ? "custom" : "inventory";
      return {
        ...row, rowType: next,
        ingredientId: next === "inventory" ? (inventory[0]?.id ?? "") : "",
        name: next === "inventory" ? (inventory[0]?.name ?? "") : "",
        unit: next === "inventory" ? (inventory[0]?.unit ?? "g") : row.unit,
      };
    }));
  };

  const updateIngredient = (i: number, field: keyof RecipeIngredient, value: string) => {
    setIngredients((prev) => prev.map((row, idx) => {
      if (idx !== i) return row;
      if (field === "ingredientId") {
        const ing = inventory.find((x) => x.id === value);
        return { ...row, ingredientId: value, name: ing?.name ?? "", unit: ing?.unit ?? row.unit };
      }
      return { ...row, [field]: value };
    }));
  };

  const addStep = () => setSteps((prev) => [...prev, { num: String(prev.length + 1).padStart(2, "0"), title: "", description: "" }]);
  const updateStep = (i: number, field: keyof RecipeStep, value: string) => {
    setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    const id = `rec-${Date.now()}`;

    let finalImg = img;
    if (imgFile) {
      try { finalImg = await uploadImage("recipe-images", imgFile); }
      catch (e: any) { setSaveError("Photo upload failed: " + e.message); setSaving(false); return; }
    }

    const allIngredients = ingredients.filter((r) => r.ingredientId || r.name.trim());
    const recipe: Recipe = {
      id, name: name.trim(), category,
      yield: yieldAmt.trim() || "—",
      time: time.trim() || "—",
      img: finalImg,
      ingredients: allIngredients,
      steps: steps.filter((s) => s.title.trim()),
    };

    const { error: recErr } = await supabase.from("recipes").insert({
      id: recipe.id, name: recipe.name, category: recipe.category,
      yield: recipe.yield, time: recipe.time, img: recipe.img,
    });
    if (recErr) { setSaveError(recErr.message); setSaving(false); return; }

    for (const ing of allIngredients) {
      if (!ing.ingredientId) continue; // custom (free-text) rows have no inventory link
      await supabase.from("recipe_ingredients").insert({
        recipe_id: recipe.id, ingredient_id: ing.ingredientId,
        qty: ing.qty, unit: ing.unit,
      });
    }

    for (let i = 0; i < recipe.steps.length; i++) {
      const s = recipe.steps[i];
      await supabase.from("recipe_steps").insert({
        recipe_id: recipe.id, num: s.num,
        title: s.title, description: s.description, sort_order: i,
      });
    }

    setSaving(false);
    onSave(recipe);
  };

  const stepTitles = ["Basics", "Ingredients", "Steps"];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(29,27,26,0.6)" }} onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10 shrink-0">
          <div>
            <h3 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>New Recipe</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Step {step} of 3 — {stepTitles[step - 1]}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Progress */}
        <div className="flex shrink-0">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-1 transition-colors ${s <= step ? "bg-primary" : "bg-outline-variant/20"}`} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Step 1 — Basics */}
          {step === 1 && (
            <>
              <div className="relative w-full rounded-xl overflow-hidden border border-outline-variant/20 bg-surface-container" style={{ aspectRatio: "16/7" }}>
                <img src={img} alt="Recipe" className="w-full h-full object-cover" />
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { const err = validateImageFile(f); if (err) { setSaveError(err); return; } setImgFile(f); setImg(URL.createObjectURL(f)); setSaveError(""); }
                }} />
                <button onClick={() => fileRef.current?.click()} className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest/90 backdrop-blur-sm text-primary text-xs font-semibold border border-outline-variant/30 hover:bg-surface-container-lowest transition-colors">
                  <Icon name="photo_camera" size={13} /> Upload Photo
                </button>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Recipe Name *</label>
                <input autoFocus className="w-full bg-surface-bright border border-outline-variant px-4 py-2.5 rounded-lg text-sm text-primary font-medium focus:outline-none focus:border-primary/60" placeholder="e.g. Leche Flan" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Category</label>
                <select className="w-full bg-surface-bright border border-outline-variant px-4 py-2.5 rounded-lg text-sm text-primary focus:outline-none" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Yield</label>
                  <input className="w-full bg-surface-bright border border-outline-variant px-4 py-2.5 rounded-lg text-sm text-primary focus:outline-none font-mono" placeholder="e.g. 12 units" value={yieldAmt} onChange={(e) => setYieldAmt(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Total Time</label>
                  <input className="w-full bg-surface-bright border border-outline-variant px-4 py-2.5 rounded-lg text-sm text-primary focus:outline-none font-mono" placeholder="e.g. 1h 30m" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Step 2 — Ingredients */}
          {step === 2 && (
            <>
              <p className="text-xs text-on-surface-variant">Add ingredients from your inventory or type a custom one.</p>
              <div className="space-y-2">
                {ingredients.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {/* Toggle: inventory vs custom */}
                    <button
                      title={row.rowType === "inventory" ? "Switch to free text" : "Switch to inventory"}
                      onClick={() => toggleRowType(i)}
                      className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border transition-all text-xs ${
                        row.rowType === "inventory"
                          ? "border-primary/30 bg-primary/8 text-primary"
                          : "border-outline-variant bg-surface-bright text-on-surface-variant"
                      }`}
                    >
                      <Icon name={row.rowType === "inventory" ? "inventory_2" : "edit"} size={13} />
                    </button>

                    {/* Name: dropdown or text input */}
                    {row.rowType === "inventory" && inventory.length > 0 ? (
                      <select
                        className="flex-1 bg-surface-bright border border-outline-variant px-3 py-2 rounded-lg text-sm text-primary focus:outline-none min-w-0"
                        value={row.ingredientId}
                        onChange={(e) => updateIngredient(i, "ingredientId", e.target.value)}
                      >
                        {inventory.map((inv) => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                      </select>
                    ) : (
                      <input
                        className="flex-1 bg-surface-bright border border-outline-variant px-3 py-2 rounded-lg text-sm text-primary focus:outline-none min-w-0"
                        placeholder={row.rowType === "inventory" ? "No inventory yet — type name" : "e.g. Vanilla extract, Lemon zest…"}
                        value={row.name}
                        onChange={(e) => updateIngredient(i, "name", e.target.value)}
                      />
                    )}

                    <input
                      className="w-20 bg-surface-bright border border-outline-variant px-3 py-2 rounded-lg text-sm text-primary focus:outline-none font-mono text-center"
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) => updateIngredient(i, "qty", e.target.value)}
                    />
                    <select
                      className="w-20 bg-surface-bright border border-outline-variant px-2 py-2 rounded-lg text-xs font-bold text-primary focus:outline-none font-mono"
                      value={row.unit}
                      onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                    >
                      <option>g</option><option>kg</option><option>ml</option><option>L</option><option>units</option><option>tbsp</option><option>tsp</option><option>pcs</option>
                    </select>
                    <button onClick={() => setIngredients((prev) => prev.filter((_, idx) => idx !== i))} className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-all shrink-0">
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => addIngredientRow("inventory")}
                    className="flex-1 py-2.5 rounded-xl border-2 border-dashed border-outline-variant/30 text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1.5"
                  >
                    <Icon name="inventory_2" size={13} /> From Inventory
                  </button>
                  <button
                    onClick={() => addIngredientRow("custom")}
                    className="flex-1 py-2.5 rounded-xl border-2 border-dashed border-outline-variant/30 text-xs font-semibold text-on-surface-variant hover:border-secondary hover:text-secondary transition-all flex items-center justify-center gap-1.5"
                  >
                    <Icon name="edit" size={13} /> Custom
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step 3 — Steps */}
          {step === 3 && (
            <>
              <p className="text-xs text-on-surface-variant">Define the production process step by step.</p>
              <div className="space-y-3">
                {steps.map((s, i) => (
                  <div key={i} className="bg-surface-container rounded-xl p-4 space-y-2 relative">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-primary/20 font-mono w-8 shrink-0">{s.num}</span>
                      <input
                        className="flex-1 bg-surface-bright border border-outline-variant px-3 py-2 rounded-lg text-sm font-semibold text-primary focus:outline-none"
                        placeholder="Step title (e.g. Mix batter)"
                        value={s.title}
                        onChange={(e) => updateStep(i, "title", e.target.value)}
                      />
                      {steps.length > 1 && (
                        <button onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i).map((st, idx) => ({ ...st, num: String(idx + 1).padStart(2, "0") })))} className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-all shrink-0">
                          <Icon name="close" size={13} />
                        </button>
                      )}
                    </div>
                    <textarea
                      className="w-full bg-surface-bright border border-outline-variant px-3 py-2 rounded-lg text-sm text-on-surface-variant focus:outline-none resize-none"
                      rows={2}
                      placeholder="Describe what to do in this step..."
                      value={s.description}
                      onChange={(e) => updateStep(i, "description", e.target.value)}
                    />
                  </div>
                ))}
                <button onClick={addStep} className="w-full py-2.5 rounded-xl border-2 border-dashed border-outline-variant/30 text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1.5">
                  <Icon name="add" size={14} strokeWidth={2.5} /> Add Step
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/10 flex justify-between gap-3 shrink-0">
          <button
            onClick={() => step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : onClose()}
            className="px-5 h-9 rounded-lg border border-outline text-primary text-sm font-semibold hover:bg-surface-container transition-colors"
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              disabled={step === 1 && !name.trim()}
              className="px-5 h-9 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          ) : (
            <>
              {saveError && <p className="text-xs text-error">{saveError}</p>}
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 h-9 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Recipe"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RecipesList({ recipes, inventory, onAddRecipe, onViewRecipe }: Props) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const filtered = recipes.filter((r) => {
    const matchCat = activeCategory === "All" || r.category === activeCategory;
    return matchCat && r.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <h1 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Recipes</h1>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex bg-surface-container rounded-full px-3 py-1.5 items-center gap-2 border border-outline-variant/20">
            <Icon name="search" size={16} className="text-outline" />
            <input className="bg-transparent border-none focus:outline-none text-sm w-44 placeholder:text-on-surface-variant/60" placeholder="Search recipes..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
            <Icon name="notifications" size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[11px] font-bold text-on-primary">AV</span>
          </div>
        </div>
      </header>

      <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex gap-2 flex-wrap">
            {["All", ...CATEGORIES].map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${activeCategory === cat ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}>
                {cat}
              </button>
            ))}
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 h-9 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-all active:scale-95 shrink-0">
            <Icon name="add" size={16} strokeWidth={2.5} /> New Recipe
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((recipe) => (
            <div key={recipe.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all group">
              {/* Photo — click to edit */}
              <div onClick={() => onViewRecipe(recipe)} className="relative overflow-hidden bg-surface-container cursor-pointer" style={{ aspectRatio: "16/10" }}>
                <img src={recipe.img} alt={recipe.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-[#26170c] text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <Icon name="edit" size={12} /> Edit Recipe
                  </span>
                </div>
              </div>

              <div className="p-4">
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant uppercase tracking-wide mb-1.5">{recipe.category}</span>
                <h3 className="font-semibold text-primary text-sm leading-tight mb-1" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{recipe.name}</h3>
                <p className="text-xs text-on-surface-variant mb-3">
                  {recipe.ingredients.length > 0 ? `${recipe.ingredients.length} ingredient${recipe.ingredients.length !== 1 ? "s" : ""}` : "No ingredients set"}
                </p>
                <div className="flex items-center gap-2 pt-3 border-t border-outline-variant/10">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                      <Icon name="restaurant" size={13} />
                      <span className="font-mono">{recipe.yield}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                      <Icon name="timer" size={13} />
                      <span className="font-mono">{recipe.time}</span>
                    </div>
                  </div>
                  {/* Edit button */}
                  <button
                    onClick={() => onViewRecipe(recipe)}
                    className="flex items-center gap-1 px-3 h-7 rounded-lg border border-outline text-primary text-[11px] font-semibold hover:bg-surface-container active:scale-95 transition-all"
                  >
                    <Icon name="edit" size={12} /> Edit
                  </button>
                  {/* Bake button */}
                  <button
                    onClick={() => onViewRecipe(recipe)}
                    className="flex items-center gap-1 px-3 h-7 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:opacity-90 active:scale-95 transition-all"
                  >
                    <Icon name="oven_gen" size={12} strokeWidth={2} /> Bake
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 py-20 text-center">
              <Icon name="menu_book" size={40} className="text-outline/30 mx-auto mb-3" />
              <p className="text-sm text-on-surface-variant">No recipes found.</p>
              <button onClick={() => setShowModal(true)} className="mt-3 text-sm font-semibold text-primary hover:underline">+ Add your first recipe</button>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NewRecipeModal
          inventory={inventory}
          onSave={(r) => { onAddRecipe(r); setShowModal(false); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
