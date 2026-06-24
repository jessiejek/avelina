import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { supabase, uploadImage, validateImageFile } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";

interface Props {
  onBack: () => void;
}

type Measure = "mass" | "volume" | "count";

const UNIT_GROUPS: Record<Measure, string[]> = {
  mass: ["g", "kg"],
  volume: ["ml", "L"],
  count: ["units", "dozen", "pcs"],
};

function measureForUnit(u: string): Measure {
  if (UNIT_GROUPS.volume.includes(u)) return "volume";
  if (UNIT_GROUPS.count.includes(u)) return "count";
  return "mass";
}

export default function IngredientDetail({ onBack }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [measureTab, setMeasureTab] = useState<"mass" | "volume" | "count">("mass");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editing, setEditing] = useState(false);

  // Read-only styling: when disabled, drop the box so it reads as plain text.
  const ro = "disabled:border-transparent disabled:bg-transparent disabled:cursor-default";
  const roSelect = ro + " disabled:appearance-none";

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [unit, setUnit] = useState("kg");
  const [status, setStatus] = useState<"optimal" | "low" | "critical">("optimal");
  const [img, setImg] = useState<string | null>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [shelfLife, setShelfLife] = useState<number | "">("");
  const [lowThreshold, setLowThreshold] = useState<number | "">("");
  const [costPerUnit, setCostPerUnit] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [movements, setMovements] = useState<{ created_at: string; delta: number; reason: string; notes: string | null }[]>([]);

  useEffect(() => {
    if (!id) return;
    supabase.from("ingredients").select("*").eq("id", id).single().then(({ data }) => {
      if (data) {
        setName(data.name ?? "");
        setSku(data.sku ?? "");
        setQuantity(data.quantity != null ? parseFloat(Number(data.quantity).toFixed(3)) : "");
        setUnit(data.unit ?? "kg");
        setMeasureTab(measureForUnit(data.unit ?? "kg"));
        setStatus(data.status ?? "optimal");
        setImg(data.img ?? null);
        setShelfLife(data.shelf_life ?? "");
        setLowThreshold(data.low_threshold ?? "");
        setCostPerUnit(data.cost_per_unit ?? "");
        setNotes(data.notes ?? "");
      }
      setLoading(false);
    });

    supabase.from("inventory_adjustments")
      .select("created_at, delta, reason, notes")
      .eq("ingredient_id", id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setMovements(data as any); });
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setSaved(false);
    setSaveError("");
    let finalImg = img;
    if (imgFile) {
      try { finalImg = await uploadImage("ingredient-images", imgFile); setImg(finalImg); setImgFile(null); }
      catch (e: any) { setSaveError("Photo upload failed: " + e.message); setSaving(false); return; }
    }
    // Recompute status from current stock level and the (possibly edited) low_threshold.
    // quantity is intentionally NOT written here — it only changes via Adjust Stock.
    const currentQty = typeof quantity === "number" ? quantity : 0;
    const threshold = typeof lowThreshold === "number" ? lowThreshold : 5;
    const newStatus: "optimal" | "low" | "critical" = currentQty <= 0 ? "critical" : currentQty < threshold ? "low" : "optimal";
    const { error } = await supabase.from("ingredients").update({ name, sku, img: finalImg, unit, status: newStatus, shelf_life: shelfLife === "" ? null : shelfLife, low_threshold: lowThreshold === "" ? null : lowThreshold, cost_per_unit: costPerUnit === "" ? 0 : costPerUnit, notes: notes.trim() || null }).eq("id", id);
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setStatus(newStatus);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAdjustStock = () => {
    navigate("/admin/inventory/adjust", {
      state: { ingredient: { id, name, sku, quantity, unit, status, img, costPerUnit: costPerUnit === "" ? 0 : costPerUnit, lowThreshold: lowThreshold === "" ? undefined : Number(lowThreshold) } },
    });
  };

  const statusColor = status === "optimal"
    ? "bg-secondary text-white"
    : status === "low"
    ? "bg-tertiary-fixed text-on-tertiary-fixed-variant"
    : "bg-error text-white";

  const statusLabel = status === "optimal" ? "Optimal" : status === "low" ? "Low Stock" : "Critical";

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface text-on-surface-variant text-sm">
        Loading ingredient…
      </div>
    );
  }

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
                {name || "—"}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {saveError && <p className="text-xs text-error font-semibold">{saveError}</p>}
              {saved && !editing && <p className="text-xs text-secondary font-semibold flex items-center gap-1"><Icon name="check_circle" size={13} /> Saved</p>}
              <button onClick={handleAdjustStock} className="h-10 px-5 rounded-lg border border-outline text-on-surface font-semibold hover:bg-surface-container transition-colors flex items-center gap-2 text-sm">
                <Icon name="scale" size={16} />
                Adjust Stock
              </button>
              {editing ? (
                <>
                  <button onClick={() => setEditing(false)} className="h-10 px-5 rounded-lg border border-outline text-primary font-semibold hover:bg-surface-container transition-colors text-sm">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="h-10 px-6 rounded-lg font-bold transition-all text-sm disabled:opacity-50 bg-primary text-on-primary hover:opacity-90">
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} className="h-10 px-6 rounded-lg font-bold transition-all text-sm bg-primary text-on-primary hover:opacity-90 flex items-center gap-2">
                  <Icon name="edit" size={15} /> Edit
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-5 order-2 lg:order-1">
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20">
                <h2 className="font-semibold text-primary mb-4 pb-2 border-b border-outline-variant/10 text-base">Core Specifications</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Ingredient Name</label>
                      <input
                        disabled={!editing}
                        className={`w-full bg-surface-bright border border-outline-variant/40 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary focus:outline-none focus:border-primary/50 ${ro}`}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">SKU / Reference</label>
                      <input
                        disabled={!editing}
                        className={`w-full bg-surface-bright border border-outline-variant/40 px-4 py-2.5 rounded-lg text-sm text-on-surface-variant focus:outline-none font-mono ${ro}`}
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Shelf Life</label>
                      <div className="flex">
                        <input
                          disabled={!editing}
                          className={`flex-1 bg-surface-bright border border-outline-variant/40 px-4 py-2.5 rounded-l-lg text-sm font-bold text-primary focus:outline-none font-mono ${ro}`}
                          type="number" min={0} value={shelfLife}
                          onChange={(e) => setShelfLife(e.target.value === "" ? "" : Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          placeholder="—"
                        />
                        <div className="w-20 bg-surface-container-high border border-l-0 border-outline-variant/40 px-3 rounded-r-lg flex items-center text-xs font-bold text-on-surface-variant">
                          days
                        </div>
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
                          disabled={!editing}
                          onClick={() => {
                            setMeasureTab(tab);
                            if (!UNIT_GROUPS[tab].includes(unit)) setUnit(UNIT_GROUPS[tab][0]);
                          }}
                          className={`flex-1 py-2 text-xs font-semibold uppercase rounded transition-all disabled:cursor-default ${measureTab === tab ? "bg-surface-container-lowest text-primary shadow-sm" : "text-outline hover:text-on-surface disabled:hover:text-outline"}`}
                        >
                          {tab === "mass" ? "Mass (Weight)" : tab}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Current Stock</label>
                        <span className="text-[10px] font-semibold text-outline flex items-center gap-1"><Icon name="lock" size={10} /> via Adjust Stock</span>
                      </div>
                      <div className="flex">
                        <div className="flex-1 min-w-0 bg-surface-container border border-outline-variant/40 px-4 py-2.5 rounded-l-lg text-base font-bold text-primary font-mono flex items-center">
                          {quantity === "" ? 0 : quantity}
                        </div>
                        <select
                          disabled={!editing}
                          className="w-20 shrink-0 bg-surface-container-high border border-l-0 border-outline-variant/40 px-2 rounded-r-lg text-xs font-bold text-primary focus:outline-none font-mono cursor-pointer disabled:cursor-default disabled:appearance-none"
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                        >
                          {(UNIT_GROUPS[measureTab].includes(unit) ? UNIT_GROUPS[measureTab] : [unit, ...UNIT_GROUPS[measureTab]]).map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Low Stock Warning</label>
                      <div className="flex">
                        <input
                          disabled={!editing}
                          className={`flex-1 min-w-0 bg-surface-bright border border-outline-variant/40 px-4 py-2.5 rounded-l-lg text-base font-bold text-on-tertiary-container focus:outline-none font-mono ${ro}`}
                          type="number" value={lowThreshold}
                          onChange={(e) => setLowThreshold(e.target.value === "" ? "" : Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                        />
                        <div className="w-20 shrink-0 bg-surface-container-high border border-l-0 border-outline-variant/40 px-3 rounded-r-lg flex items-center justify-center text-xs font-bold text-on-surface-variant font-mono">
                          {unit}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Purchase Cost</label>
                      <div className="flex">
                        <div className="w-10 shrink-0 bg-surface-container-high border border-r-0 border-outline-variant/40 rounded-l-lg flex items-center justify-center text-sm font-bold text-on-surface-variant">₱</div>
                        <input
                          disabled={!editing}
                          className={`flex-1 min-w-0 bg-surface-bright border border-outline-variant/40 px-4 py-2.5 text-base font-bold text-primary focus:outline-none font-mono ${ro}`}
                          type="number" min={0} step="0.01" value={costPerUnit}
                          onChange={(e) => setCostPerUnit(e.target.value === "" ? "" : Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          placeholder="0.00"
                        />
                        <div className="w-24 shrink-0 bg-surface-container-high border border-l-0 border-outline-variant/40 px-2 rounded-r-lg flex items-center justify-center text-[11px] font-bold text-on-surface-variant font-mono">
                          per {unit}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-end">
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Stock Value</label>
                      <div className="h-[46px] flex items-center px-4 rounded-lg bg-surface-container border border-outline-variant/30 text-base font-bold text-primary font-mono">
                        {peso((typeof costPerUnit === "number" ? costPerUnit : 0) * (typeof quantity === "number" ? quantity : 0))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-outline-variant/10">
                  <h2 className="font-semibold text-primary text-base">Stock Movements</h2>
                  <span className="text-[10px] font-semibold text-outline uppercase tracking-wider">last 10</span>
                </div>
                {movements.length === 0 ? (
                  <p className="text-sm text-on-surface-variant py-4 text-center">No movements yet. Use Adjust Stock to add or remove.</p>
                ) : (
                  <div className="divide-y divide-outline-variant/10">
                    {movements.map((m, i) => (
                      <div key={i} className="flex items-center justify-between py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-primary truncate">{m.reason}</p>
                          <p className="text-[11px] text-on-surface-variant">
                            {new Date(m.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                            {m.notes ? ` · ${m.notes}` : ""}
                          </p>
                        </div>
                        <span className={`text-sm font-bold font-mono shrink-0 ${m.delta >= 0 ? "text-secondary" : "text-error"}`}>
                          {m.delta >= 0 ? "+" : ""}{m.delta} {unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20">
                <h2 className="font-semibold text-primary mb-4 pb-2 border-b border-outline-variant/10 text-base">Kitchen Notes</h2>
                <textarea
                  disabled={!editing}
                  className={`w-full bg-surface-bright border border-outline-variant/40 px-4 py-3 rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary/50 resize-none ${ro}`}
                  rows={4}
                  placeholder={editing ? "Storage instructions, handling notes, supplier details, allergen info…" : "—"}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Right Column — photo first on mobile */}
            <div className="lg:col-span-5 space-y-5 order-1 lg:order-2">
              <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-outline-variant/20 group shadow-lg bg-surface-container flex items-center justify-center">
                {img ? (
                  <img src={img} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-on-surface-variant/40">
                    <Icon name="image" size={40} />
                    <span className="text-xs">No image</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { const err = validateImageFile(f); if (err) { alert(err); return; } setImgFile(f); setImg(URL.createObjectURL(f)); }
                }} />
                {editing && (
                  <button
                    onClick={() => imgInputRef.current?.click()}
                    className="absolute bottom-4 right-4 bg-surface-container-lowest/90 backdrop-blur-sm text-primary px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-outline-variant/30 hover:bg-surface-container-lowest transition-colors shadow-sm"
                  >
                    <Icon name="photo_camera" size={14} /> {img ? "Change Photo" : "Upload Photo"}
                  </button>
                )}
                {img && (
                  <div className="absolute bottom-5 left-5 text-white">
                    <span className="text-[10px] uppercase tracking-[0.2em] opacity-80">Inventory Visualization</span>
                    <h3 className="font-bold text-sm mt-0.5">{name}</h3>
                  </div>
                )}
              </div>

              <div className={`p-5 rounded-xl border ${status === "optimal" ? "bg-secondary-container border-secondary/20" : status === "low" ? "bg-tertiary-fixed/30 border-tertiary-fixed/40" : "bg-error-container border-error/20"}`}>
                <div className="flex justify-between items-center mb-3">
                  <span className={`font-bold text-sm ${status === "optimal" ? "text-on-secondary-container" : status === "low" ? "text-on-tertiary-fixed-variant" : "text-on-error-container"}`}>Stock Health</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>{statusLabel}</span>
                </div>
                <div className="w-full bg-white/30 h-2.5 rounded-full mb-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${status === "optimal" ? "bg-secondary" : status === "low" ? "bg-on-tertiary-fixed-variant" : "bg-error"}`}
                    style={{ width: status === "optimal" ? "78%" : status === "low" ? "35%" : "12%" }}
                  />
                </div>
                <p className={`text-xs opacity-80 ${status === "optimal" ? "text-on-secondary-container" : status === "low" ? "text-on-tertiary-fixed-variant" : "text-on-error-container"}`}>
                  Current: <span className="font-bold font-mono">{quantity === "" ? 0 : quantity} {unit}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container p-4 rounded-xl border border-outline-variant/20">
                  <Icon name="inventory_2" size={18} className="text-primary mb-2" />
                  <span className="block text-[10px] font-semibold text-outline uppercase tracking-wider">Unit</span>
                  <span className="font-bold text-primary text-base font-mono">{unit}</span>
                </div>
                <div className="bg-surface-container p-4 rounded-xl border border-outline-variant/20">
                  <Icon name="qr_code" size={18} className="text-primary mb-2" />
                  <span className="block text-[10px] font-semibold text-outline uppercase tracking-wider">SKU</span>
                  <span className="font-bold text-primary text-base font-mono truncate block">{sku || "—"}</span>
                </div>
                <div className="col-span-2 bg-surface-container-high p-4 rounded-xl border border-outline-variant/30 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-semibold text-outline uppercase tracking-wider">Ingredient ID</span>
                    <span className="font-bold text-primary text-sm font-mono truncate block max-w-[200px]">{id}</span>
                  </div>
                  <Icon name="tag" size={20} className="text-primary shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
