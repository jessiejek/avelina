import React, { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.tsx";
import { Recipe } from "../data/recipes.ts";
import { supabase, uploadImage, validateImageFile } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";

const PLACEHOLDER_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCZEA9Bb0E92ttiNPKygaTFeC4dzXBznNOXNamZP3o7bVGUwv6Hzf4GvcLSLSKZaHSEF3WxskKkxdKPSd_UpV32ZH-EcJT0uepYb2E7k70ffBDdz1mpaIjvaXKtezW-QbHZYtSSphohNe2_MDahWfWGmhNIjR2Ax8tQrOW0W190tn8Xz7E_Y9ub1lA0KNjOJPeiilJF4d6ef2YjqGkwBr9QIYmpcyzX5E1ShDsdKblhprVsIrizOMrkIEP0sEWCHaO8zlS_AEyfbhtm";

interface Props {
  products: Recipe[];
  loading: boolean;
  onChanged: () => void;
}

interface Draft {
  name: string;
  category: string;
  price: string;
  active: boolean;
  img: string;
}

function ProductModal({
  mode,
  initial,
  categories,
  onDone,
  onClose,
}: {
  mode: "add" | "edit";
  initial: (Draft & { id?: string });
  categories: string[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState(initial.category);
  const [price, setPrice] = useState(initial.price);
  const [active, setActive] = useState(initial.active);
  const [img, setImg] = useState(initial.img || PLACEHOLDER_IMG);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError("Give the product a name."); return; }
    setSaving(true);
    setError("");

    let finalImg = img;
    if (imgFile) {
      try { finalImg = await uploadImage("recipe-images", imgFile); }
      catch (e: any) { setError("Photo upload failed: " + e.message); setSaving(false); return; }
    }

    const fields = {
      name: name.trim(),
      category: category.trim() || "Other",
      img: finalImg,
      price: price === "" ? 0 : Number(price),
      is_for_sale: active,
      is_available: active,
    };

    const { error: dbErr } =
      mode === "add"
        ? await supabase.from("recipes").insert({ id: `prod-${Date.now()}`, yield: "—", time: "—", ...fields })
        : await supabase.from("recipes").update(fields).eq("id", initial.id!);

    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(29,27,26,0.6)" }} onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-full max-w-md shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10 shrink-0">
          <h3 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>
            {mode === "add" ? "Add Product" : "Edit Product"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Photo */}
          <div className="relative w-full rounded-xl overflow-hidden border border-outline-variant/20 bg-surface-container" style={{ aspectRatio: "16/9" }}>
            <img src={img} alt="" className="w-full h-full object-cover" />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const err = validateImageFile(f);
                if (err) { setError(err); return; }
                setImgFile(f);
                setImg(URL.createObjectURL(f));
                setError("");
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest/90 backdrop-blur-sm text-primary text-xs font-semibold border border-outline-variant/30 hover:bg-surface-container-lowest transition-colors"
            >
              <Icon name="photo_camera" size={13} /> Photo
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Name *</label>
            <input
              autoFocus
              className="w-full bg-surface-bright border border-outline-variant px-4 py-2.5 rounded-lg text-sm text-primary font-medium focus:outline-none focus:border-primary/60"
              placeholder="e.g. Ube Cheese Pandesal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Category</label>
              <input
                list="product-categories"
                className="w-full bg-surface-bright border border-outline-variant px-4 py-2.5 rounded-lg text-sm text-primary focus:outline-none focus:border-primary/60"
                placeholder="Other"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id="product-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Price</label>
              <div className="flex items-center gap-1 bg-surface-bright border border-outline-variant rounded-lg px-3">
                <span className="text-sm font-bold text-on-surface-variant">₱</span>
                <input
                  className="flex-1 min-w-0 bg-transparent py-2.5 text-sm text-primary font-mono focus:outline-none"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Storefront</label>
            <button
              type="button"
              onClick={() => setActive((v) => !v)}
              className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-3 text-sm font-bold border transition-colors ${
                active
                  ? "bg-secondary-container text-on-secondary-container border-secondary/30"
                  : "bg-surface-container text-on-surface-variant border-outline-variant"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon name={active ? "storefront" : "visibility_off"} size={16} />
                {active ? "Selling — shown on home page" : "Not selling — hidden"}
              </span>
              <Icon name="sync_alt" size={14} className="opacity-60" />
            </button>
          </div>

          {error && <p className="text-xs text-error bg-error-container/40 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-outline-variant/10 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 h-10 rounded-lg border border-outline text-primary text-sm font-semibold hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 h-10 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? "Saving…" : mode === "add" ? "Add Product" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsList({ products, loading, onChanged }: Props) {
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Recipe | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [saleFilter, setSaleFilter] = useState<"all" | "selling" | "not">("all");

  useEffect(() => {
    supabase.from("recipe_categories").select("name").order("created_at").then(({ data }) => {
      if (data) setCategories(data.map((d: any) => d.name));
    });
  }, []);

  const toggleActive = async (p: Recipe) => {
    const next = !(p.is_for_sale !== false);
    setTogglingId(p.id);
    await supabase.from("recipes").update({ is_for_sale: next, is_available: next }).eq("id", p.id);
    setTogglingId(null);
    onChanged();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", deleteTarget.id);
    await supabase.from("recipe_steps").delete().eq("recipe_id", deleteTarget.id);
    const { error } = await supabase.from("recipes").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      setDeleteError(
        /foreign key|violates/i.test(error.message)
          ? "This product is used by an existing order, so it can't be deleted."
          : error.message
      );
      return;
    }
    setDeleteTarget(null);
    onChanged();
  };

  const filtered = products
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => {
      const selling = p.is_for_sale !== false;
      return saleFilter === "all" || (saleFilter === "selling" ? selling : !selling);
    })
    .sort((a, b) => Number(b.is_for_sale !== false) - Number(a.is_for_sale !== false) || a.name.localeCompare(b.name));

  const saleChips: { id: typeof saleFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "selling", label: "Selling" },
    { id: "not", label: "Not selling" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <h1 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Products</h1>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex bg-surface-container rounded-full px-3 py-1.5 items-center gap-2 border border-outline-variant/20">
            <Icon name="search" size={16} className="text-outline" />
            <input
              className="bg-transparent border-none focus:outline-none text-sm w-44 placeholder:text-on-surface-variant/60"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 h-9 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-all active:scale-95 shrink-0"
          >
            <Icon name="add" size={16} strokeWidth={2.5} /> Add Product
          </button>
        </div>
      </header>

      <div className="p-6 lg:p-10 max-w-6xl mx-auto w-full">
        <div className="flex gap-2 flex-wrap mb-5">
          {saleChips.map((c) => (
            <button
              key={c.id}
              onClick={() => setSaleFilter(c.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                saleFilter === c.id ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="py-24 text-center text-on-surface-variant text-sm">Loading products…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center rounded-xl border-2 border-dashed border-outline-variant/30">
            <Icon name="storefront" size={40} className="text-outline/30 mx-auto mb-3" />
            <p className="text-sm text-on-surface-variant">{search ? "No products match your search." : "No products yet."}</p>
            {!search && (
              <button onClick={() => setAddOpen(true)} className="mt-3 text-sm font-semibold text-primary hover:underline">
                + Add your first product
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => {
              const selling = p.is_for_sale !== false;
              return (
                <div key={p.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
                  <div className="relative bg-surface-container" style={{ aspectRatio: "1/1" }}>
                    <img src={p.img} alt={p.name} className={`w-full h-full object-contain ${selling ? "" : "grayscale opacity-60"}`} />
                    {!selling && (
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant uppercase tracking-wide">
                        <Icon name="visibility_off" size={10} /> Hidden
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant uppercase tracking-wide">
                        {p.category || "Other"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-semibold text-primary text-sm leading-tight" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{p.name}</h3>
                      <span className="shrink-0 font-bold text-primary text-sm font-mono">{peso(p.price ?? 0)}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-outline-variant/10">
                      <button
                        onClick={() => toggleActive(p)}
                        disabled={togglingId === p.id}
                        className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50 ${
                          selling
                            ? "bg-secondary-container text-on-secondary-container border-secondary/30"
                            : "bg-surface-container text-on-surface-variant border-outline-variant"
                        }`}
                      >
                        <Icon name={selling ? "storefront" : "visibility_off"} size={12} />
                        {selling ? "Selling" : "Not selling"}
                      </button>
                      <button
                        onClick={() => setEditTarget(p)}
                        className="h-8 px-3 rounded-lg border border-outline text-on-surface-variant text-xs font-semibold hover:bg-surface-container transition-colors flex items-center gap-1"
                      >
                        <Icon name="edit" size={12} /> Edit
                      </button>
                      <button
                        onClick={() => { setDeleteTarget(p); setDeleteError(""); }}
                        className="w-8 h-8 rounded-lg border border-outline text-on-surface-variant hover:text-error hover:border-error/40 hover:bg-error-container/20 transition-all flex items-center justify-center"
                        title="Delete product"
                      >
                        <Icon name="delete" size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {addOpen && (
        <ProductModal
          mode="add"
          initial={{ name: "", category: "", price: "", active: true, img: "" }}
          categories={categories}
          onDone={() => { setAddOpen(false); onChanged(); }}
          onClose={() => setAddOpen(false)}
        />
      )}

      {editTarget && (
        <ProductModal
          mode="edit"
          initial={{
            id: editTarget.id,
            name: editTarget.name,
            category: editTarget.category || "",
            price: editTarget.price ? String(editTarget.price) : "",
            active: editTarget.is_for_sale !== false,
            img: editTarget.img,
          }}
          categories={categories}
          onDone={() => { setEditTarget(null); onChanged(); }}
          onClose={() => setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(29,27,26,0.5)" }}
          onClick={() => { if (!deleting) setDeleteTarget(null); }}
        >
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-full max-w-sm shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center mb-4">
              <Icon name="delete" size={22} className="text-error" />
            </div>
            <h3 className="font-bold text-primary text-lg" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Delete product?</h3>
            <p className="text-sm text-on-surface-variant mt-1.5">
              <span className="font-semibold text-primary">{deleteTarget.name}</span> will be removed from the store. This can't be undone.
            </p>
            {deleteError && <p className="text-xs text-error mt-3 bg-error-container/40 rounded-lg px-3 py-2">{deleteError}</p>}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
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
    </div>
  );
}
