import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { supabase, uploadImage, validateImageFile } from "../lib/supabase.ts";

interface Props {
  onBack: () => void;
}

export default function IngredientDetail({ onBack }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [measureTab, setMeasureTab] = useState<"mass" | "volume" | "count">("mass");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [stockValue, setStockValue] = useState<number | "">("");
  const [unit, setUnit] = useState("kg");
  const [status, setStatus] = useState<"optimal" | "low" | "critical">("optimal");
  const [img, setImg] = useState<string | null>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [shelfLife, setShelfLife] = useState(180);
  const [lowThreshold, setLowThreshold] = useState<number | "">("");

  useEffect(() => {
    if (!id) return;
    supabase.from("ingredients").select("*").eq("id", id).single().then(({ data }) => {
      if (data) {
        setName(data.name ?? "");
        setSku(data.sku ?? "");
        setStockValue(data.stock_value ?? "");
        setUnit(data.unit ?? "kg");
        setStatus(data.status ?? "optimal");
        setImg(data.img ?? null);
      }
      setLoading(false);
    });
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
    const { error } = await supabase.from("ingredients").update({ name, sku, img: finalImg, stock_value: stockValue === "" ? 0 : stockValue, unit, status }).eq("id", id);
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAdjustStock = () => {
    navigate("/admin/inventory/adjust", {
      state: { ingredient: { id, name, sku, stockValue, unit, status, img } },
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
              <button onClick={handleAdjustStock} className="h-10 px-5 rounded-lg border border-outline text-on-surface font-semibold hover:bg-surface-container transition-colors flex items-center gap-2 text-sm">
                <Icon name="scale" size={16} />
                Adjust Stock
              </button>
              <button onClick={handleSave} disabled={saving} className={`h-10 px-6 rounded-lg font-bold transition-all text-sm disabled:opacity-50 flex items-center gap-2 ${saved ? "bg-secondary text-white" : "bg-primary text-on-primary hover:opacity-90"}`}>
                {saving ? "Saving…" : saved ? <><Icon name="check_circle" size={15} /> Saved!</> : "Save Changes"}
              </button>
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
                        className="w-full bg-surface-bright border border-outline-variant/40 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary focus:outline-none focus:border-primary/50"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">SKU / Reference</label>
                      <input
                        className="w-full bg-surface-bright border border-outline-variant/40 px-4 py-2.5 rounded-lg text-sm text-on-surface-variant focus:outline-none font-mono"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                      />
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Current Stock</label>
                      <div className="flex">
                        <input
                          className="flex-1 bg-surface-bright border border-outline-variant/40 px-4 py-2.5 rounded-l-lg text-base font-bold text-primary focus:outline-none font-mono"
                          type="number" value={stockValue}
                          onChange={(e) => setStockValue(e.target.value === "" ? "" : Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                        />
                        <div className="w-20 bg-surface-container-high border border-l-0 border-outline-variant/40 px-3 rounded-r-lg flex items-center text-xs font-bold text-on-surface-variant font-mono">
                          {unit}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Low Stock Warning</label>
                      <div className="flex">
                        <input
                          className="flex-1 bg-surface-bright border border-outline-variant/40 px-4 py-2.5 rounded-l-lg text-base font-bold text-on-tertiary-container focus:outline-none font-mono"
                          type="number" value={lowThreshold}
                          onChange={(e) => setLowThreshold(e.target.value === "" ? "" : Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                        />
                        <div className="w-20 bg-surface-container-high border border-l-0 border-outline-variant/40 px-3 rounded-r-lg flex items-center text-xs font-bold text-on-surface-variant font-mono">
                          {unit}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
                <button
                  onClick={() => imgInputRef.current?.click()}
                  className="absolute bottom-4 right-4 bg-surface-container-lowest/90 backdrop-blur-sm text-primary px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-outline-variant/30 hover:bg-surface-container-lowest transition-colors shadow-sm"
                >
                  <Icon name="photo_camera" size={14} /> {img ? "Change Photo" : "Upload Photo"}
                </button>
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
                  Current: <span className="font-bold font-mono">{stockValue === "" ? 0 : stockValue} {unit}</span>
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
