import React, { useEffect, useState } from "react";
import { supabase, uploadImage, validateImageFile } from "../lib/supabase.ts";
import {
  Wheat, Droplets, FlaskConical, Sparkles, Egg, ChefHat, Coffee, Cookie,
  Leaf, Flame, Apple, UtensilsCrossed, Milk, Nut, Croissant, CakeSlice,
  Carrot, Grape, Cherry, Wine, Candy, Donut, Thermometer, Scale,
  CookingPot, Banana, IceCreamCone,
} from "lucide-react";
import { Ingredient } from "../data/inventory.ts";
import Icon from "../components/Icon.tsx";
import { peso } from "../lib/money.ts";

interface Props {
  ingredients: Ingredient[];
  onAddIngredient: (ing: Ingredient) => void;
  onViewIngredient: (id: string) => void;
  onDeleteIngredient: (id: string) => void;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  optimal:   { label: "Optimal",      bg: "bg-secondary-container", text: "text-on-secondary-container",    dot: "bg-secondary" },
  low:       { label: "Low Stock",    bg: "bg-tertiary-fixed",      text: "text-on-tertiary-fixed-variant", dot: "bg-on-tertiary-container" },
  critical:  { label: "Out of Stock", bg: "bg-error-container",     text: "text-on-error-container",        dot: "bg-error" },
  untracked: { label: "Not Tracked",  bg: "bg-surface-container",   text: "text-on-surface-variant",        dot: "bg-outline" },
};

const ICON_MAP: Record<string, React.FC<{ size?: number; strokeWidth?: number }>> = {
  wheat: Wheat, croissant: Croissant, cake: CakeSlice, donut: Donut, cookie: Cookie,
  milk: Milk, egg: Egg, "ice-cream": IceCreamCone, droplets: Droplets, coffee: Coffee,
  wine: Wine, apple: Apple, banana: Banana, cherry: Cherry, grape: Grape, carrot: Carrot,
  nut: Nut, candy: Candy, leaf: Leaf, flame: Flame, flask: FlaskConical, sparkles: Sparkles,
  thermo: Thermometer, scale: Scale, pot: CookingPot, chef: ChefHat, pantry: UtensilsCrossed,
};

interface NewIngForm {
  name: string;
  sku: string;
  stockValue: string;
  cost: string;
  unit: string;
  status: "optimal" | "low" | "critical" | "untracked";
}

// Fix E — shelf stock
type DispositionReason = "cash_sale" | "personal_use" | "donated_comped" | "spoiled_discarded";

interface ShelfItem {
  recipeId: string;
  name: string;
  quantity: number;
  bakedAt: string | null;
  costPerUnit: number;
  unit: string;
  shelfLifeDays: number | null;
}

const DISPOSITION_OPTS: { value: DispositionReason; label: string; sub: string }[] = [
  { value: "cash_sale",         label: "Sold — Walk-in",    sub: "Customer paid on the spot"   },
  { value: "personal_use",      label: "Staff / Personal",  sub: "Consumed in-house"            },
  { value: "donated_comped",    label: "Given / Comped",    sub: "Free to customer or donated"  },
  { value: "spoiled_discarded", label: "Thrown Away",       sub: "Spoiled or can't be sold"     },
];

const emptyForm: NewIngForm = { name: "", sku: "", stockValue: "", cost: "", unit: "kg", status: "optimal" };

export default function InventoryDashboard({ ingredients, onAddIngredient, onViewIngredient, onDeleteIngredient }: Props) {
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewIngForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const imgInputRef = React.useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Fix E — shelf stock state
  const [shelfStock, setShelfStock] = useState<ShelfItem[]>([]);
  const [dispModal, setDispModal] = useState<ShelfItem | null>(null);
  const [dispQty, setDispQty] = useState("1");
  const [dispReason, setDispReason] = useState<DispositionReason>("cash_sale");
  const [dispNotes, setDispNotes] = useState("");
  const [dispUnitPrice, setDispUnitPrice] = useState("");
  const [dispSaving, setDispSaving] = useState(false);
  const [dispError, setDispError] = useState("");
  const [currentUser, setCurrentUser] = useState("Avelina");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("users").select("name").eq("id", user.id).maybeSingle();
      if (data?.name) setCurrentUser(data.name);
    });
  }, []);

  useEffect(() => {
    const loadShelf = () =>
      supabase
        .from("finished_goods")
        .select("recipe_id, quantity, baked_at, cost_per_unit, unit, recipes(id, name, finished_shelf_life_days)")
        .gt("quantity", 0)
        .then(({ data }) => {
          setShelfStock(
            (data || []).map((row: any) => ({
              recipeId: row.recipe_id,
              name: row.recipes?.name || "Unknown",
              quantity: row.quantity ?? 0,
              bakedAt: row.baked_at ?? null,
              costPerUnit: row.cost_per_unit ?? 0,
              unit: row.unit || "units",
              shelfLifeDays: row.recipes?.finished_shelf_life_days ?? null,
            }))
          );
        });

    loadShelf();

    const ch = supabase.channel("rt-finished-goods")
      .on("postgres_changes", { event: "*", schema: "public", table: "finished_goods" }, loadShelf)
      .on("postgres_changes", { event: "*", schema: "public", table: "finished_goods_dispositions" }, loadShelf)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const isExpired = (item: ShelfItem) => {
    if (!item.shelfLifeDays || !item.bakedAt) return false;
    const daysSince = (Date.now() - new Date(item.bakedAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > item.shelfLifeDays;
  };

  const openDispModal = (item: ShelfItem) => {
    setDispModal(item);
    setDispQty("1");
    setDispReason("cash_sale");
    setDispNotes("");
    setDispUnitPrice("");
    setDispError("");
  };

  const handleDisposition = async () => {
    if (!dispModal) return;
    const qty = parseFloat(dispQty) || 0;
    if (qty <= 0) { setDispError("Quantity must be greater than 0"); return; }
    if (qty > dispModal.quantity) { setDispError(`Only ${dispModal.quantity} ${dispModal.unit} available`); return; }
    if (dispReason === "cash_sale" && !(parseFloat(dispUnitPrice) > 0)) { setDispError("Selling price is required for walk-in sales"); return; }

    setDispSaving(true);
    setDispError("");
    const now = new Date().toISOString();
    const amountCollected = dispReason === "cash_sale" ? (parseFloat(dispUnitPrice) || 0) * qty : null;
    const writeoffValue = dispReason !== "cash_sale" ? dispModal.costPerUnit * qty : null;
    const newQty = dispModal.quantity - qty;

    await supabase
      .from("finished_goods")
      .update({ quantity: newQty, updated_at: now })
      .eq("recipe_id", dispModal.recipeId);

    await supabase.from("finished_goods_dispositions").insert({
      recipe_id: dispModal.recipeId,
      quantity: qty,
      reason: dispReason,
      unit_price: dispReason === "cash_sale" ? (parseFloat(dispUnitPrice) || 0) : null,
      amount_collected: amountCollected,
      writeoff_value: writeoffValue,
      notes: dispNotes || null,
      tagged_at: now,
      tagged_by: currentUser,
    });

    if (dispReason !== "cash_sale" && writeoffValue && writeoffValue > 0) {
      const category = dispReason === "spoiled_discarded" ? "spoilage_writeoff" : "writeoff";
      await supabase.from("expenses").insert({
        category,
        amount: writeoffValue,
        description: `${dispModal.name} — ${qty} ${dispModal.unit} ${dispReason.replace(/_/g, " ")}`,
        recorded_at: now,
      });
    }

    setShelfStock((prev) =>
      prev
        .map((s) => s.recipeId === dispModal.recipeId ? { ...s, quantity: newQty } : s)
        .filter((s) => s.quantity > 0)
    );
    setDispSaving(false);
    setDispModal(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    const { error } = await supabase.from("ingredients").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      setDeleteError(
        /foreign key|violates/i.test(error.message)
          ? "This ingredient is used by a recipe or stock record, so it can't be deleted. Remove those references first."
          : error.message
      );
      return;
    }
    onDeleteIngredient(deleteTarget.id);
    setDeleteTarget(null);
  };

  const attention = ingredients.filter((i) => i.status === "low" || i.status === "critical");
  const filtered = ingredients.filter((i) => {
    const matchCat = filter === "all" || (filter === "low" && i.status === "low") || (filter === "out" && i.status === "critical");
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setAdding(true);
    setAddError("");
    let finalImg = "";
    if (imgFile) {
      try { finalImg = await uploadImage("ingredient-images", imgFile); }
      catch (e: any) { setAddError("Photo upload failed: " + e.message); setAdding(false); return; }
    }
    const isUntracked = form.stockValue.trim() === "";
    const val = isUntracked ? null : (parseFloat(form.stockValue) || 0);
    const status = isUntracked ? "untracked" : form.status;
    const newIng: Ingredient = {
      id: `ing-${Date.now()}`,
      name: form.name.trim(),
      sku: form.sku.trim() || `ING-${Date.now()}`,
      stock: isUntracked ? "—" : `${val} ${form.unit}`,
      quantity: val,
      unit: form.unit,
      status,
      icon: "wheat",
      img: finalImg,
    };
    const { error } = await supabase.from("ingredients").insert({
      id: newIng.id, name: newIng.name, sku: newIng.sku,
      quantity: newIng.quantity, unit: newIng.unit,
      status: newIng.status, icon: "wheat", img: newIng.img,
      cost_per_unit: form.cost === "" ? 0 : parseFloat(form.cost) || 0,
    });
    if (error) { setAddError(error.message); setAdding(false); return; }
    if (!isUntracked && val && val > 0) {
      await supabase.from("inventory_adjustments").insert({
        ingredient_id: newIng.id, delta: val, unit: newIng.unit,
        reason: "Opening balance", adjusted_by: currentUser,
      });
      const costPerUnit = form.cost === "" ? 0 : parseFloat(form.cost) || 0;
      if (costPerUnit > 0) {
        await supabase.from("expenses").insert({
          type: "ingredient_purchase",
          amount: val * costPerUnit,
          ingredient_id: newIng.id,
          qty: val,
          unit: newIng.unit,
          note: form.name.trim() + " opening stock",
          created_by: currentUser,
        });
      }
    }
    onAddIngredient(newIng);
    setForm(emptyForm);
    setImgFile(null);
    setImgPreview("");
    setAdding(false);
    setShowModal(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
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
            <span className="text-[11px] font-bold text-on-primary">AV</span>
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
                    {(() => { const IC = ICON_MAP[item.icon] ?? Wheat; return <IC size={16} />; })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary text-sm truncate">{item.name}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{item.stock} remaining</p>
                  </div>
                  <button onClick={() => onViewIngredient(item.id)} className="shrink-0 px-3 h-8 rounded-lg text-xs font-semibold border border-outline text-primary hover:bg-surface-container transition-colors">
                    Order
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Fix E: Finished Goods on Shelf */}
        {shelfStock.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-semibold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 16 }}>Ready to Sell — Items on Shelf</h3>
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest overflow-x-auto">
              <table className="w-full text-left min-w-[560px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant/20">
                    {["Product", "Available", "Baked On", "Best Before", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {shelfStock.map((item) => {
                    const expired = isExpired(item);
                    return (
                      <tr key={item.recipeId} className={expired ? "bg-error-container/10" : ""}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-primary text-sm">{item.name}</p>
                          {item.costPerUnit > 0 && (
                            <p className="text-[10px] text-on-surface-variant mt-0.5 font-mono">cost {peso(item.costPerUnit)}/{item.unit}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-primary font-mono">
                          {item.quantity} <span className="font-normal text-on-surface-variant">{item.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-on-surface-variant">
                          {item.bakedAt
                            ? new Date(item.bakedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {expired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-error-container text-on-error-container rounded-full text-[10px] font-bold uppercase tracking-wide">
                              <Icon name="warning" size={10} /> Expired
                            </span>
                          ) : item.shelfLifeDays ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded-full text-[10px] font-bold uppercase tracking-wide">
                              <Icon name="check_circle" size={10} /> Fresh
                            </span>
                          ) : (
                            <span className="text-xs text-on-surface-variant/50">No expiry set</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openDispModal(item)}
                            className="h-7 px-3 rounded-lg bg-primary text-on-primary text-xs font-bold hover:opacity-80 active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Icon name="sell" size={11} /> Sell or Give Away
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all group"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-surface-container cursor-pointer" onClick={() => onViewIngredient(item.id)}>
                  {item.img
                    ? <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full flex items-center justify-center text-on-surface-variant/30"><Icon name="image" size={32} /></div>
                  }
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-[#26170c] text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <Icon name="edit" size={12} /> Edit Ingredient
                    </span>
                  </div>
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
                    <span className="text-sm font-bold text-primary font-mono">{item.quantity == null ? "—" : item.stock}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="flex items-center justify-center w-7 h-7 rounded-lg border border-outline text-on-surface-variant hover:text-error hover:border-error/40 hover:bg-error-container/20 active:scale-95 transition-all"
                        title="Delete ingredient"
                      >
                        <Icon name="delete" size={13} />
                      </button>
                      <button
                        onClick={() => onViewIngredient(item.id)}
                        className="flex items-center gap-1 px-3 h-7 rounded-lg border border-outline text-primary text-[11px] font-semibold hover:bg-surface-container active:scale-95 transition-all"
                      >
                        <Icon name="edit" size={12} /> Edit
                      </button>
                      <button
                        onClick={() => onViewIngredient(item.id)}
                        className="flex items-center gap-1 px-3 h-7 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:opacity-90 active:scale-95 transition-all"
                      >
                        <Icon name="scale" size={12} /> Adjust
                      </button>
                    </div>
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

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(29,27,26,0.5)" }}
          onClick={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(""); } }}
        >
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-full max-w-sm shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center mb-4">
              <Icon name="delete" size={22} className="text-error" />
            </div>
            <h3 className="font-bold text-primary text-lg" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Delete ingredient?</h3>
            <p className="text-sm text-on-surface-variant mt-1.5">
              <span className="font-semibold text-primary">{deleteTarget.name}</span> will be permanently removed from inventory. This can't be undone.
            </p>
            {deleteError && <p className="text-xs text-error mt-3 bg-error-container/40 rounded-lg px-3 py-2">{deleteError}</p>}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(""); }}
                disabled={deleting}
                className="px-5 h-10 rounded-lg border border-outline text-primary text-sm font-semibold hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 h-10 rounded-lg bg-error text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fix E: Disposition Modal */}
      {dispModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(29,27,26,0.5)" }}
          onClick={() => !dispSaving && setDispModal(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-full max-w-sm shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center mb-4">
              <Icon name="sell" size={22} className="text-on-primary-fixed" />
            </div>
            <h3 className="font-bold text-primary text-lg" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>What happened to it?</h3>
            <p className="text-sm text-on-surface-variant mt-1">
              <span className="font-semibold text-primary">{dispModal.name}</span> · {dispModal.quantity} {dispModal.unit} on shelf
            </p>

            <div className="mt-4 space-y-4">
              {/* Reason */}
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">What happened?</label>
                <div className="mt-1.5 grid grid-cols-1 gap-1.5">
                  {DISPOSITION_OPTS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDispReason(opt.value)}
                      className={`py-2.5 px-3 rounded-lg text-left border transition-all ${
                        dispReason === opt.value
                          ? "bg-primary/10 border-primary"
                          : "bg-surface-container border-outline-variant/20 hover:bg-surface-container-high"
                      }`}
                    >
                      <p className={`text-sm font-bold leading-tight ${dispReason === opt.value ? "text-primary" : "text-on-surface-variant"}`}>{opt.label}</p>
                      <p className="text-[11px] text-on-surface-variant/70 mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Qty */}
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">How many pieces?</label>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex items-center border border-outline-variant/40 rounded-xl overflow-hidden bg-surface-container">
                    <button
                      type="button"
                      onClick={() => { const v = Math.max(1, (parseFloat(dispQty) || 1) - 1); setDispQty(String(v)); setDispError(""); }}
                      className="w-10 h-10 flex items-center justify-center text-lg font-bold text-on-surface-variant hover:bg-surface-container-high active:bg-surface-container-highest transition-colors select-none"
                    >−</button>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={dispQty}
                      onChange={(e) => { setDispQty(e.target.value.replace(/[^\d.]/g, "")); setDispError(""); }}
                      className="w-14 h-10 text-center font-bold text-primary font-mono bg-transparent border-x border-outline-variant/40 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => { setDispQty(String((parseFloat(dispQty) || 0) + 1)); setDispError(""); }}
                      className="w-10 h-10 flex items-center justify-center text-lg font-bold text-on-surface-variant hover:bg-surface-container-high active:bg-surface-container-highest transition-colors select-none"
                    >+</button>
                  </div>
                  <span className="text-xs text-on-surface-variant">{dispModal.unit}</span>
                </div>
              </div>

              {/* Unit price — cash sale only */}
              {dispReason === "cash_sale" && (
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Selling Price per piece</label>
                  <div className="mt-1.5 flex items-center gap-1 bg-surface-container border border-outline-variant/40 rounded-lg px-3 w-36">
                    <span className="text-sm font-bold text-on-surface-variant">₱</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={dispUnitPrice}
                      onChange={(e) => setDispUnitPrice(e.target.value.replace(/[^\d.]/g, ""))}
                      className="flex-1 bg-transparent py-2 text-sm font-bold text-primary focus:outline-none font-mono"
                      placeholder="0.00"
                    />
                  </div>
                  {dispUnitPrice && parseFloat(dispQty) > 0 && (
                    <p className="text-xs text-on-surface-variant mt-1">
                      Total cash collected: <span className="font-bold text-secondary font-mono">{peso((parseFloat(dispUnitPrice) || 0) * (parseFloat(dispQty) || 0))}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Write-off preview */}
              {dispReason !== "cash_sale" && dispModal.costPerUnit > 0 && parseFloat(dispQty) > 0 && (
                <p className="text-xs text-on-surface-variant bg-surface-container rounded-lg px-3 py-2">
                  Loss recorded: <span className="font-bold text-error font-mono">{peso(dispModal.costPerUnit * (parseFloat(dispQty) || 0))}</span> (at cost — logged as expense)
                </p>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Notes (optional)</label>
                <input
                  type="text"
                  value={dispNotes}
                  onChange={(e) => setDispNotes(e.target.value)}
                  className="mt-1.5 w-full h-9 px-3 text-sm text-primary bg-surface-container border border-outline-variant/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. sold at weekend market"
                />
              </div>

              {dispError && (
                <p className="text-xs text-error flex items-center gap-1">
                  <Icon name="error" size={12} /> {dispError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDispModal(null)}
                disabled={dispSaving}
                className="px-5 h-10 rounded-lg border border-outline text-primary text-sm font-semibold hover:bg-surface-container transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDisposition}
                disabled={dispSaving}
                className="px-5 h-10 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
              >
                {dispSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Ingredient Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
          style={{ backgroundColor: "rgba(29,27,26,0.5)" }}
          onClick={() => { setShowModal(false); setForm(emptyForm); }}
        >
          <div
            className="bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl border border-outline-variant/20 w-full sm:max-w-md shadow-2xl flex flex-col"
            style={{ maxHeight: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-outline-variant/40" />
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10 shrink-0">
              <h3 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>Add New Ingredient</h3>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); }} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors">
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
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
                    type="number" min={0} step={0.1} placeholder="0.0"
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
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Purchase Cost (₱ per {form.unit})</label>
                <div className="flex items-center gap-1 bg-surface-bright border border-outline-variant rounded-lg px-3">
                  <span className="text-sm font-bold text-on-surface-variant">₱</span>
                  <input
                    className="flex-1 min-w-0 bg-transparent py-2.5 text-sm font-bold text-primary focus:outline-none font-mono"
                    inputMode="decimal" placeholder="0.00"
                    value={form.cost}
                    onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value.replace(/[^\d.]/g, "") }))}
                  />
                </div>
              </div>
              {form.stockValue.trim() !== "" && (
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
              )}
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Photo (optional)</label>
                <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { const err = validateImageFile(f); if (err) { setAddError(err); return; } setImgFile(f); setImgPreview(URL.createObjectURL(f)); setAddError(""); }
                }} />
                {imgPreview ? (
                  <div className="relative w-full rounded-xl overflow-hidden border border-outline-variant/20 bg-surface-container" style={{ aspectRatio: "16/9" }}>
                    <img src={imgPreview} alt="Preview" className="w-full h-full object-cover" />
                    <button onClick={() => { setImgFile(null); setImgPreview(""); }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => imgInputRef.current?.click()} className="w-full py-6 rounded-xl border-2 border-dashed border-outline-variant/30 text-xs font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-all flex flex-col items-center gap-1.5">
                    <Icon name="add_photo_alternate" size={22} />
                    Upload Photo
                  </button>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-outline-variant/10 flex flex-col gap-2 shrink-0">
              {addError && <p className="text-xs text-error">{addError}</p>}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowModal(false); setForm(emptyForm); setImgFile(null); setImgPreview(""); setAddError(""); }}
                  className="px-5 h-10 rounded-lg border border-outline text-primary text-sm font-semibold hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!form.name.trim() || adding}
                  className="flex-1 sm:flex-none px-5 h-10 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {adding ? "Saving…" : "Add to Inventory"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
