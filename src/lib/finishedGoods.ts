/**
 * Finished goods helpers — the "shelf stock" layer between baking and fulfillment.
 *
 * Required DB table (run once in Supabase SQL editor):
 *
 *   CREATE TABLE IF NOT EXISTS finished_goods (
 *     id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     recipe_id   uuid REFERENCES recipes(id) ON DELETE CASCADE,
 *     quantity    numeric NOT NULL DEFAULT 0,
 *     cost_per_unit numeric NOT NULL DEFAULT 0,
 *     unit        text NOT NULL DEFAULT 'units',
 *     baked_at    timestamptz DEFAULT now(),
 *     updated_at  timestamptz DEFAULT now()
 *   );
 *   CREATE UNIQUE INDEX IF NOT EXISTS finished_goods_recipe_id_idx
 *     ON finished_goods (recipe_id);
 */

import { supabase } from "./supabase.ts";

export interface FinishedGoodsInfo {
  quantity: number;
  baked_at: string | null;
  cost_per_unit: number;
}

/** Returns full shelf info for a recipe (quantity, bake date, cost). */
export async function getFinishedGoodsInfo(recipeId: string): Promise<FinishedGoodsInfo> {
  const { data } = await supabase
    .from("finished_goods")
    .select("quantity, baked_at, cost_per_unit")
    .eq("recipe_id", recipeId)
    .maybeSingle();
  return {
    quantity: data?.quantity ?? 0,
    baked_at: data?.baked_at ?? null,
    cost_per_unit: data?.cost_per_unit ?? 0,
  };
}

/** Returns how many units of a recipe are currently on the finished-goods shelf. */
export async function getFinishedGoodsStock(recipeId: string): Promise<number> {
  const { data } = await supabase
    .from("finished_goods")
    .select("quantity")
    .eq("recipe_id", recipeId)
    .maybeSingle();
  return data?.quantity ?? 0;
}

/**
 * Adds `qty` finished units to the shelf for `recipeId`.
 * Uses weighted-average cost if a row already exists.
 * Always updates baked_at to now() — newest addition sets the freshness timestamp.
 * Use this for FRESH bakes only. For returning cancelled stock use returnToFinishedGoods.
 */
export async function addFinishedGoods(
  recipeId: string,
  qty: number,
  costPerUnit: number,
  unit: string,
): Promise<void> {
  if (qty <= 0) return;

  const { data: existing } = await supabase
    .from("finished_goods")
    .select("id, quantity, cost_per_unit")
    .eq("recipe_id", recipeId)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const oldQty = existing.quantity as number;
    const newQty = oldQty + qty;
    const newCost =
      newQty > 0
        ? (oldQty * (existing.cost_per_unit as number) + qty * costPerUnit) / newQty
        : costPerUnit;
    await supabase
      .from("finished_goods")
      .update({ quantity: newQty, cost_per_unit: newCost, updated_at: now, baked_at: now })
      .eq("id", existing.id);
  } else {
    await supabase.from("finished_goods").insert({
      recipe_id: recipeId,
      quantity: qty,
      cost_per_unit: costPerUnit,
      unit,
      updated_at: now,
      baked_at: now,
    });
  }
}

/**
 * Returns previously-baked units back to the shelf (e.g. order cancellation).
 * Increments quantity and blends cost, but NEVER overwrites baked_at — stock
 * age is preserved as-was. Use addFinishedGoods for fresh bakes instead.
 *
 * @param originalBakedAt  ISO timestamp of the original bake. Used only when
 *   the shelf row has no stock yet (quantity === 0 or row missing), so the
 *   returned units carry the correct age rather than appearing freshly made.
 */
export async function returnToFinishedGoods(
  recipeId: string,
  qty: number,
  costPerUnit: number,
  unit: string,
  originalBakedAt?: string | null,
): Promise<void> {
  if (qty <= 0) return;

  const { data: existing } = await supabase
    .from("finished_goods")
    .select("id, quantity, cost_per_unit, baked_at")
    .eq("recipe_id", recipeId)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const oldQty = existing.quantity as number;
    const newQty = oldQty + qty;
    const newCost =
      newQty > 0
        ? (oldQty * (existing.cost_per_unit as number) + qty * costPerUnit) / newQty
        : costPerUnit;

    const updatePayload: Record<string, any> = {
      quantity: newQty,
      cost_per_unit: newCost,
      updated_at: now,
      // baked_at is intentionally omitted when shelf already has stock — preserve existing age.
    };

    if (oldQty === 0) {
      // Shelf was empty: restore the original bake timestamp so age is not lost.
      updatePayload.baked_at = originalBakedAt ?? (existing.baked_at as string | null) ?? now;
    }

    await supabase.from("finished_goods").update(updatePayload).eq("id", existing.id);
  } else {
    // No row — create one, using the original bake timestamp to preserve age.
    await supabase.from("finished_goods").insert({
      recipe_id: recipeId,
      quantity: qty,
      cost_per_unit: costPerUnit,
      unit,
      updated_at: now,
      baked_at: originalBakedAt ?? now,
    });
  }
}

/**
 * Removes up to `qty` units from the finished-goods shelf.
 * Returns both the actual amount consumed and the unfilled shortfall.
 */
export async function consumeFinishedGoods(
  recipeId: string,
  qty: number,
): Promise<{ consumed: number; shortfall: number }> {
  if (qty <= 0) return { consumed: 0, shortfall: 0 };

  const { data: existing } = await supabase
    .from("finished_goods")
    .select("id, quantity")
    .eq("recipe_id", recipeId)
    .maybeSingle();

  if (!existing || (existing.quantity as number) <= 0) {
    return { consumed: 0, shortfall: qty };
  }

  const actualConsumed = Math.min(qty, existing.quantity as number);
  const newQty = (existing.quantity as number) - actualConsumed;

  await supabase
    .from("finished_goods")
    .update({ quantity: newQty, updated_at: new Date().toISOString() })
    .eq("id", existing.id);

  return { consumed: actualConsumed, shortfall: qty - actualConsumed };
}
