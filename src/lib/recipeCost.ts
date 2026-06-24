import { Ingredient } from "../data/inventory.ts";

export function normalizeQty(qty: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return qty;
  if ((fromUnit === "g" || fromUnit === "ml") && toUnit === "kg") return qty / 1000;
  if (fromUnit === "kg" && (toUnit === "g" || toUnit === "ml")) return qty * 1000;
  return qty;
}

export interface CostRow {
  ingredientId: string;
  qty: string;
  unit: string;
}

/** Returns total batch cost by summing qty × ingredient cost_per_unit for each row. */
export function computeBatchCost(rows: CostRow[], inventory: Ingredient[]): number {
  return rows.reduce((sum, row) => {
    if (!row.ingredientId) return sum;
    const inv = inventory.find((i) => i.id === row.ingredientId);
    if (!inv) return sum;
    const consumed = normalizeQty(parseFloat(row.qty) || 0, row.unit, inv.unit);
    return sum + consumed * (inv.costPerUnit ?? 0);
  }, 0);
}
