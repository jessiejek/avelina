import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { Recipe } from "../data/recipes.ts";
import { Ingredient } from "../data/inventory.ts";
import { BakeEntry } from "./BakeLog.tsx";
import { supabase } from "../lib/supabase.ts";
import { peso } from "../lib/money.ts";
import { getFinishedGoodsInfo, addFinishedGoods, consumeFinishedGoods } from "../lib/finishedGoods.ts";
import { normalizeQty, computeBatchCost } from "../lib/recipeCost.ts";

interface Props {
  onBack: () => void;
  onLogBake: (entry: BakeEntry) => void;
  recipe: Recipe;
  inventory: Ingredient[];
  orderId?: string | null;
  orderQty?: number;
}

interface BakeResult {
  successfulBatches: number;
  totalConsumed: number;
  cumulativeFulfilled: number;
  orderQty: number;
  stopReason: string | null;
}

const INV_ICON: Record<string, string> = {
  wheat: "grain", sparkles: "auto_awesome", flask: "science",
  droplets: "water_drop", leaf: "compost", egg: "egg",
};

function fmtQty(value: number, unit: string): string {
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)} ${unit}`;
}

function parseYieldUnit(yieldStr: string): string {
  const parts = yieldStr.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : "units";
}

export default function BakeConfirmation({ onBack, onLogBake, recipe, inventory, orderId, orderQty }: Props) {
  const navigate = useNavigate();
  const [baker, setBaker] = useState("");
  const [baking, setBaking] = useState(false);
  const [fgInfo, setFgInfo] = useState<{ quantity: number; baked_at: string | null; cost_per_unit: number } | null>(null);
  const [batchesToBake, setBatchesToBake] = useState(1);
  const [showExcessConfirm, setShowExcessConfirm] = useState(false);
  const [bakeResult, setBakeResult] = useState<BakeResult | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("users").select("name").eq("id", user.id).single();
      setBaker(data?.name || user.user_metadata?.name || user.email?.split("@")[0] || "");
    });
  }, []);

  useEffect(() => {
    getFinishedGoodsInfo(recipe.id).then(setFgInfo);
  }, [recipe.id]);

  const bakerInitials = baker
    ? baker.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "—";

  const yieldNum = parseFloat(recipe.yield) || 0;
  const yieldUnit = parseYieldUnit(recipe.yield);
  const batchCost = computeBatchCost(recipe.ingredients, inventory);
  const unitCost = yieldNum > 0 ? batchCost / yieldNum : 0;
  const unitPrice = recipe.price ?? 0;
  const unitMargin = unitPrice - unitCost;

  // Fix B: shelf life / expiry check
  const fgQuantity = fgInfo?.quantity ?? 0;
  const isStockExpired = (() => {
    if (!recipe.finished_shelf_life_days || !fgInfo?.baked_at || fgQuantity <= 0) return false;
    const daysSince = (Date.now() - new Date(fgInfo.baked_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > recipe.finished_shelf_life_days;
  })();
  const effectiveFgAvailable = isStockExpired ? 0 : fgQuantity;

  // Fix A: multi-batch planning math
  const remainingNeeded = orderQty != null ? Math.max(0, orderQty - effectiveFgAvailable) : 0;
  const recommendedBatches =
    orderQty != null
      ? remainingNeeded > 0 && yieldNum > 0 ? Math.ceil(remainingNeeded / yieldNum) : 0
      : 1;

  const canFulfillFromStock =
    orderId != null && orderQty != null && orderQty > 0 && effectiveFgAvailable >= orderQty;

  useEffect(() => {
    if (recommendedBatches >= 1) setBatchesToBake(recommendedBatches);
  }, [recommendedBatches]);

  const willProduce = batchesToBake * yieldNum;
  const totalAvailableAfterBake = effectiveFgAvailable + willProduce;
  const excessAfterOrder = orderQty != null ? totalAvailableAfterBake - orderQty : 0;
  const hasExcess = excessAfterOrder > 0;
  const batchShortfall = orderQty != null ? Math.max(0, orderQty - totalAvailableAfterBake) : 0;

  // Scaled ingredient checklist (qty × batchesToBake)
  const scaledReconciliation = recipe.ingredients.map((ri) => {
    const inv = inventory.find((i) => i.id === ri.ingredientId);
    const reqRaw = (parseFloat(ri.qty) || 0) * batchesToBake;
    const displayUnit = inv?.unit ?? ri.unit;
    const required = normalizeQty(reqRaw, ri.unit, displayUnit);
    const available = inv?.quantity ?? 0;
    const isShort = required > available;
    const isLow = !isShort && (inv?.status === "low" || inv?.status === "critical");
    return {
      name: ri.name,
      icon: inv ? (INV_ICON[inv.icon] ?? "inventory_2") : "inventory_2",
      required: fmtQty(required, displayUnit),
      available: fmtQty(available, displayUnit),
      status: isShort ? "short" : isLow ? "low" : "ready",
    };
  });
  const hasShortage = scaledReconciliation.some((r) => r.status !== "ready");

  const handleBakeClick = () => {
    if (hasExcess) {
      setShowExcessConfirm(true);
    } else {
      executeBakes();
    }
  };

  const executeBakes = async () => {
    setShowExcessConfirm(false);
    if (baking) return;
    setBaking(true);

    let successfulBatches = 0;
    let totalConsumed = 0;
    let stopReason: string | null = null;

    // Local inventory snapshot, updated after each batch to catch deductions
    let inventorySnapshot = inventory.map((i) => ({ ...i }));

    for (let batchNum = 0; batchNum < batchesToBake; batchNum++) {
      // Re-fetch from DB for batch 2+ so we see previous batch deductions
      if (batchNum > 0) {
        const ids = recipe.ingredients.map((ri) => ri.ingredientId).filter(Boolean);
        if (ids.length > 0) {
          const { data: fresh } = await supabase
            .from("ingredients")
            .select("id, quantity, cost_per_unit, unit, status, low_threshold")
            .in("id", ids);
          if (fresh) {
            inventorySnapshot = inventorySnapshot.map((inv) => {
              const f = fresh.find((x) => x.id === inv.id);
              return f ? { ...inv, quantity: f.quantity, costPerUnit: f.cost_per_unit } : inv;
            });
          }
        }
      }

      // Check sufficiency for this specific batch
      let canProceed = true;
      let shortIngredient = "";
      for (const ri of recipe.ingredients) {
        const inv = inventorySnapshot.find((i) => i.id === ri.ingredientId);
        if (!inv) { canProceed = false; shortIngredient = ri.name; break; }
        const needed = normalizeQty(parseFloat(ri.qty) || 0, ri.unit, inv.unit);
        if (needed > (inv.quantity ?? 0)) {
          canProceed = false;
          shortIngredient = inv.name;
          break;
        }
      }
      if (!canProceed) {
        stopReason = `Stopped at batch ${batchNum + 1} of ${batchesToBake} — insufficient ${shortIngredient}`;
        break;
      }

      const thisBatchCost = computeBatchCost(
        recipe.ingredients.map((ri) => ({ ingredientId: ri.ingredientId, qty: ri.qty, unit: ri.unit })),
        inventorySnapshot,
      );
      const thisUnitCost = yieldNum > 0 ? thisBatchCost / yieldNum : unitCost;
      const now = new Date();
      const thisBatchId = `#SKU-${now.getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}-B${batchNum + 1}`;

      const entryId = `bake-${Date.now()}-${batchNum}`;
      const { error: insertErr } = await supabase.from("bake_entries").insert({
        id: entryId,
        recipe_id: recipe.id,
        batch_id: thisBatchId,
        baker: baker || "Unknown",
        started_at: now.toISOString(),
        qty: recipe.yield,
        status: "in_progress",
        img: recipe.img,
        order_id: orderId ?? null,
        cost: thisBatchCost,
      });
      if (insertErr) { stopReason = insertErr.message; break; }

      // Deduct ingredients
      for (const ri of recipe.ingredients) {
        const inv = inventorySnapshot.find((i) => i.id === ri.ingredientId);
        if (!inv) continue;
        const consumed = normalizeQty(parseFloat(ri.qty) || 0, ri.unit, inv.unit);
        if (consumed <= 0) continue;
        const newQty = Math.max(0, (inv.quantity ?? 0) - consumed);
        const threshold = inv.lowThreshold ?? 5;
        await supabase.from("ingredients").update({
          quantity: newQty,
          status: newQty <= 0 ? "critical" : newQty < threshold ? "low" : "optimal",
        }).eq("id", inv.id);
        await supabase.from("inventory_adjustments").insert({
          ingredient_id: inv.id,
          delta: -consumed,
          unit: inv.unit,
          reason: "Production",
          notes: `Bake ${thisBatchId} · ${recipe.name}`,
          adjusted_by: baker || "Unknown",
        });
        inventorySnapshot = inventorySnapshot.map((i) =>
          i.id === inv.id ? { ...i, quantity: newQty } : i
        );
      }

      // Add yield to finished goods shelf
      await addFinishedGoods(recipe.id, yieldNum, thisUnitCost, yieldUnit);

      // Consume portion needed for the order (up to what's still unfulfilled)
      const remaining = (orderQty ?? 0) - totalConsumed;
      if (orderId && orderQty != null && remaining > 0) {
        const toConsume = Math.min(yieldNum, remaining);
        const { consumed } = await consumeFinishedGoods(recipe.id, toConsume);
        totalConsumed += consumed;
      }

      // Real-time subscription in App.tsx picks up the DB insert — no need to call onLogBake here.
      successfulBatches++;
    }

    // Persist fulfilled_qty accumulation on order; keep in "baking" status
    let cumulativeFulfilled = totalConsumed;
    if (orderId && orderQty != null) {
      const { data: orderData } = await supabase
        .from("orders")
        .select("fulfilled_qty")
        .eq("id", orderId)
        .maybeSingle();
      const prevFulfilled = orderData?.fulfilled_qty ?? 0;
      cumulativeFulfilled = prevFulfilled + totalConsumed;
      await supabase.from("orders").update({
        status: "baking",
        fulfilled_qty: cumulativeFulfilled,
      }).eq("id", orderId);
    }

    setBaking(false);
    setBakeResult({ successfulBatches, totalConsumed, cumulativeFulfilled, orderQty: orderQty ?? 0, stopReason });
  };

  const handleFulfillFromStock = async () => {
    if (baking || !orderId || !orderQty) return;
    setBaking(true);
    const { consumed } = await consumeFinishedGoods(recipe.id, orderQty);
    await supabase.from("orders").update({ status: "ready", fulfilled_qty: consumed }).eq("id", orderId);
    setBaking(false);
    onBack();
  };

  // ── Post-bake result card ───────────────────────────────────────────────────
  if (bakeResult) {
    const { successfulBatches, cumulativeFulfilled, stopReason } = bakeResult;
    const isFullyFulfilled = orderQty == null || cumulativeFulfilled >= orderQty;
    const shortfall = orderQty != null ? Math.max(0, orderQty - cumulativeFulfilled) : 0;
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
        <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
          <span className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>
            Bake Session Complete
          </span>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[11px] font-bold text-on-primary">{bakerInitials}</span>
          </div>
        </header>
        <div className="p-6 max-w-2xl mx-auto w-full space-y-4 mt-4">
          <div className={`p-6 rounded-2xl border ${isFullyFulfilled ? "bg-secondary-container border-secondary/20" : "bg-tertiary-fixed border-on-tertiary-container/20"}`}>
            <div className="flex items-center gap-3 mb-4">
              <Icon
                name={isFullyFulfilled ? "check_circle" : "info"}
                size={28}
                className={isFullyFulfilled ? "text-on-secondary-container" : "text-on-tertiary-fixed-variant"}
              />
              <h2 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>
                {successfulBatches} batch{successfulBatches !== 1 ? "es" : ""} baked
              </h2>
            </div>
            <div className="space-y-2 text-sm">
              {orderQty != null && (
                <>
                  <p className="text-on-surface-variant">
                    Order fulfilled:{" "}
                    <span className="font-bold text-primary font-mono">{cumulativeFulfilled}</span>
                    {" "}of{" "}
                    <span className="font-bold text-primary font-mono">{orderQty}</span>
                    {" "}{yieldUnit}
                    {cumulativeFulfilled < orderQty && (
                      <> — <span className="font-bold text-error">still short {shortfall} {yieldUnit}</span></>
                    )}
                  </p>
                  {shortfall > 0 && (
                    <p className="text-on-surface-variant text-xs mt-1">
                      The order stays in <span className="font-semibold">Baking</span> status. Use "Start Baking" again to complete it, or adjust the order quantity.
                    </p>
                  )}
                  {isFullyFulfilled && (
                    <p className="text-on-secondary-container/80 text-xs mt-1">
                      Mark the batch done in Bake Log to advance the order to Ready for Pickup.
                    </p>
                  )}
                </>
              )}
              {stopReason && (
                <p className="text-xs text-error bg-error-container/40 rounded-lg px-3 py-2 mt-2">{stopReason}</p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 h-12 px-6 border border-outline text-primary rounded-lg font-semibold text-sm hover:bg-surface-container transition-colors"
            >
              Back to Orders
            </button>
            <button
              onClick={() => navigate("/admin/bakelog")}
              className="flex-1 h-12 px-6 bg-primary text-on-primary rounded-lg font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="history_edu" size={16} /> View Bake Log
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main bake confirmation UI ────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <nav className="flex items-center gap-1 text-sm text-on-surface-variant">
          <button onClick={onBack} className="hover:text-primary transition-colors px-2 py-1 flex items-center gap-1">
            <Icon name="arrow_back" size={14} /> New Production
          </button>
          <Icon name="chevron_right" size={14} className="text-outline-variant" />
          <span className="text-primary font-semibold px-2 py-1" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
            Confirm & Start Bake
          </span>
        </nav>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
            <Icon name="notifications" size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center" title={baker}>
            <span className="text-[11px] font-bold text-on-primary">{bakerInitials}</span>
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-12 max-w-7xl mx-auto w-full space-y-6">

        {/* Fix B: Expiry banner */}
        {isStockExpired && fgQuantity > 0 && (
          <div className="bg-error-container/60 text-on-error-container p-4 rounded-xl flex items-center gap-4 border border-error/20">
            <Icon name="warning" size={24} className="shrink-0" />
            <div>
              <h4 className="font-semibold" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                Shelf Stock Expired — Won't Be Used
              </h4>
              <p className="text-sm mt-0.5 opacity-80">
                {fgQuantity} {yieldUnit} on shelf but past the {recipe.finished_shelf_life_days}-day shelf life
                (baked {new Date(fgInfo!.baked_at!).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}). A fresh bake is required.
              </p>
            </div>
          </div>
        )}

        {/* Fulfill-from-stock banner */}
        {canFulfillFromStock && (
          <div className="bg-secondary-container text-on-secondary-container p-4 rounded-xl flex items-center gap-4 border border-secondary/20">
            <Icon name="check_circle" size={24} className="shrink-0" />
            <div>
              <h4 className="font-semibold" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                Stock Available — No Bake Needed
              </h4>
              <p className="text-sm mt-0.5 opacity-80">
                {fgQuantity} {yieldUnit} of {recipe.name} already on the shelf. Order needs {orderQty} {yieldUnit}.
              </p>
            </div>
          </div>
        )}

        {/* Recipe summary */}
        <section className="flex flex-col md:flex-row gap-4 items-start bg-surface-container-lowest p-4 lg:p-6 rounded-xl border border-outline-variant/10">
          <div className="w-full md:w-64 rounded-xl overflow-hidden shadow-sm shrink-0" style={{ aspectRatio: "4/3" }}>
            <img src={recipe.img} alt={recipe.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <span className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-[10px] font-bold uppercase tracking-wider">
                {recipe.category}
              </span>
              <h2 className="text-primary mt-3 font-bold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 32, lineHeight: "40px", letterSpacing: "-0.02em" }}>
                {recipe.name}
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-outline-variant/10">
              {[
                { label: "Total Time", value: recipe.time || "—" },
                { label: "Batch Yield", value: recipe.yield || "—" },
                { label: "Difficulty", value: recipe.difficulty ? recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1) : "—" },
              ].map((m) => (
                <div key={m.label}>
                  <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">{m.label}</p>
                  <p className="font-bold text-primary text-sm font-mono">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Fix A: Batch plan — only when a bake is needed */}
        {!canFulfillFromStock && (
          <>
            {/* Preview */}
            <section className="space-y-4">
              <h3 className="text-primary font-semibold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Batch Plan</h3>

              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 space-y-3">
                {orderQty != null ? (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Order Needs</p>
                      <p className="font-bold text-primary font-mono text-2xl">{orderQty}</p>
                      <p className="text-[10px] text-on-surface-variant">{yieldUnit}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">On Shelf</p>
                      <p className="font-bold text-primary font-mono text-2xl">{effectiveFgAvailable}</p>
                      <p className="text-[10px] text-on-surface-variant">{yieldUnit}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Still Needed</p>
                      <p className={`font-bold font-mono text-2xl ${remainingNeeded > 0 ? "text-error" : "text-secondary"}`}>{remainingNeeded}</p>
                      <p className="text-[10px] text-on-surface-variant">{yieldUnit}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">Free production — no order linked. Choose how many batches to bake.</p>
                )}
                {orderQty != null && recommendedBatches > 0 && (
                  <p className="text-xs text-on-surface-variant border-t border-outline-variant/10 pt-3">
                    Recommended:{" "}
                    <span className="font-bold text-primary">{recommendedBatches} batch{recommendedBatches !== 1 ? "es" : ""}</span>
                    {" "}({recommendedBatches * yieldNum} {yieldUnit} produced
                    {recommendedBatches * yieldNum > remainingNeeded && `, ${recommendedBatches * yieldNum - remainingNeeded} surplus`})
                  </p>
                )}
              </div>

              {/* Batch count selector */}
              <div className="flex items-center gap-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-primary">Batches to bake now</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Produces <span className="font-bold text-primary font-mono">{willProduce}</span> {yieldUnit}
                    {batchCost > 0 && <> · <span className="font-bold text-primary font-mono">{peso(batchesToBake * batchCost)}</span> total cost</>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setBatchesToBake(Math.max(1, batchesToBake - 1))}
                    className="w-10 h-10 rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high font-bold text-xl flex items-center justify-center transition-colors"
                  >−</button>
                  <span className="w-10 text-center font-bold text-primary font-mono text-2xl">{batchesToBake}</span>
                  <button
                    onClick={() => setBatchesToBake(batchesToBake + 1)}
                    className="w-10 h-10 rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high font-bold text-xl flex items-center justify-center transition-colors"
                  >+</button>
                </div>
              </div>

              {/* Outcome callout */}
              {orderQty != null && (
                <div className={`p-4 rounded-xl border text-sm ${batchShortfall > 0 ? "bg-tertiary-fixed border-on-tertiary-container/20" : "bg-secondary-container/50 border-secondary/20"}`}>
                  {batchShortfall > 0 ? (
                    <p className="text-on-surface-variant">
                      <Icon name="info" size={14} className="inline mr-1 text-on-tertiary-fixed-variant" />
                      Partial bake — order will be{" "}
                      <span className="font-bold text-error">{batchShortfall} {yieldUnit} short</span>{" "}
                      after this session. You can bake again later to complete it.
                    </p>
                  ) : (
                    <p className="text-on-surface-variant">
                      <Icon name="check_circle" size={14} className="inline mr-1 text-secondary" />
                      Fully covers the order
                      {excessAfterOrder > 0 && (
                        <> with{" "}
                          <span className="font-bold text-primary">{excessAfterOrder} {yieldUnit}</span>{" "}
                          surplus going to shelf
                        </>
                      )}.
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Scaled ingredient checklist */}
            <section className="space-y-4">
              <h3 className="text-primary font-semibold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>
                Ingredients for {batchesToBake} Batch{batchesToBake !== 1 ? "es" : ""}
              </h3>
              {hasShortage && (
                <div className="bg-error-container text-on-error-container p-3 rounded-xl flex items-center gap-3 border border-error/20">
                  <Icon name="warning" size={20} className="shrink-0" />
                  <p className="text-sm">
                    Some ingredients are insufficient for {batchesToBake} batch{batchesToBake !== 1 ? "es" : ""}. Reduce batch count or restock first.
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant/20">
                      <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Ingredient</th>
                      <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest text-right">Required</th>
                      <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest text-right">Available</th>
                      <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-widest text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {scaledReconciliation.map((row) => {
                      const isOk = row.status === "ready";
                      const isLow = row.status === "low";
                      return (
                        <tr key={row.name} className={row.status === "short" ? "bg-error-container/10" : ""}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isOk ? "bg-surface-container text-primary" : "bg-error-container/30 text-error"}`}>
                                <Icon name={row.icon} size={15} />
                              </div>
                              <p className="font-semibold text-primary text-sm">{row.name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-sm font-bold font-mono ${!isOk ? "text-error" : "text-primary"}`}>{row.required}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-mono text-on-surface-variant">{row.available}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isOk ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded-full text-[10px] font-bold uppercase tracking-wide">
                                <Icon name="check_circle" size={10} /> Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-error-container text-on-error-container rounded-full text-[10px] font-bold uppercase tracking-wide">
                                <Icon name="error" size={10} /> {isLow ? "Low" : "Short"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Cost & Margin */}
            <section className="space-y-4">
              <h3 className="text-primary font-semibold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Cost & Margin</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4">
                  <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                    Batch Cost{batchesToBake > 1 ? ` ×${batchesToBake}` : ""}
                  </p>
                  <p className="font-bold text-primary text-lg font-mono">{peso(batchCost * batchesToBake)}</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">for {willProduce} {yieldUnit}</p>
                </div>
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4">
                  <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Cost / Unit</p>
                  <p className="font-bold text-primary text-lg font-mono">{peso(unitCost)}</p>
                </div>
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4">
                  <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Sells At / Unit</p>
                  <p className="font-bold text-primary text-lg font-mono">{unitPrice ? peso(unitPrice) : "—"}</p>
                </div>
                <div className={`rounded-xl border p-4 ${unitMargin >= 0 ? "bg-secondary-container border-secondary/20" : "bg-error-container border-error/20"}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${unitMargin >= 0 ? "text-on-secondary-container" : "text-on-error-container"}`}>
                    Margin / Unit
                  </p>
                  <p className={`font-bold text-lg font-mono ${unitMargin >= 0 ? "text-on-secondary-container" : "text-on-error-container"}`}>
                    {unitPrice ? peso(unitMargin) : "—"}
                  </p>
                  {unitPrice > 0 && unitCost > 0 && (
                    <p className={`text-[10px] mt-0.5 ${unitMargin >= 0 ? "text-on-secondary-container/70" : "text-on-error-container/70"}`}>
                      {Math.round((unitMargin / unitPrice) * 100)}% margin
                    </p>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {/* Footer */}
        <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface-container-low p-4 lg:p-6 rounded-xl border border-outline-variant/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-surface-bright bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
              {bakerInitials}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Baker</p>
              <p className="text-sm font-semibold text-primary">{baker || "Loading…"}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onBack}
              disabled={baking}
              className="flex-1 sm:flex-none h-12 px-6 border border-outline text-primary rounded-lg font-semibold text-sm hover:bg-surface-container transition-colors disabled:opacity-40"
            >
              Back
            </button>
            {canFulfillFromStock ? (
              <button
                onClick={handleFulfillFromStock}
                disabled={baking}
                className="flex-1 sm:flex-none h-12 px-6 bg-secondary text-on-secondary rounded-lg font-bold text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Icon name="check_circle" size={16} />
                {baking ? "Fulfilling…" : "Fulfill from Stock"}
              </button>
            ) : (
              <button
                onClick={handleBakeClick}
                disabled={baking}
                className="flex-1 sm:flex-none h-12 px-6 bg-primary text-on-primary rounded-lg font-bold text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Icon name="oven_gen" size={16} />
                {baking
                  ? "Baking…"
                  : `Initiate Bake${batchesToBake > 1 ? ` (${batchesToBake}×)` : ""}`}
              </button>
            )}
          </div>
        </footer>
      </div>

      {/* Fix A: Excess confirmation modal */}
      {showExcessConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(29,27,26,0.5)" }}
          onClick={() => setShowExcessConfirm(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-full max-w-sm shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-tertiary-fixed flex items-center justify-center mb-4">
              <Icon name="info" size={22} className="text-on-tertiary-fixed-variant" />
            </div>
            <h3 className="font-bold text-primary text-lg" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
              Confirm Surplus Bake
            </h3>
            <p className="text-sm text-on-surface-variant mt-2">
              Baking{" "}
              <span className="font-bold text-primary">{batchesToBake} batch{batchesToBake !== 1 ? "es" : ""}</span>{" "}
              will produce{" "}
              <span className="font-bold text-primary font-mono">{willProduce} {yieldUnit}</span>.
              {orderQty != null && (
                <>
                  {" "}This order still needs{" "}
                  <span className="font-bold text-primary font-mono">{remainingNeeded}</span> —{" "}
                  <span className="font-bold text-primary font-mono">{excessAfterOrder} {yieldUnit}</span>{" "}
                  will go to shelf as surplus.
                </>
              )}
            </p>
            <p className="text-xs text-on-surface-variant mt-3">Proceed with the bake?</p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowExcessConfirm(false)}
                className="px-5 h-10 rounded-lg border border-outline text-primary text-sm font-semibold hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeBakes}
                className="px-5 h-10 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 active:scale-95 transition-all"
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
