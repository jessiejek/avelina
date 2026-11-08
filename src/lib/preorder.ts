import { useEffect, useState } from "react";
import { supabase } from "./supabase.ts";
import type { CartItem } from "../screens/CartPage.tsx";

export const MAX_PREORDER_DATES = 5;

/** Today's date in the bakery's timezone, as YYYY-MM-DD. */
export function todayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** "2026-11-14" → "Sat, Nov 14" */
export function fmtDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-PH", opts);
}

/** ["2026-11-12","2026-11-14","2026-12-01","2026-12-05"] → "Nov 12, 14, Dec 1…" */
export function fmtDateList(dates: string[], max = 3): string {
  let prevMonth = "";
  const parts = dates.slice(0, max).map((d) => {
    const dt = new Date(d + "T00:00:00");
    const m = dt.toLocaleDateString("en-PH", { month: "short" });
    const day = String(dt.getDate());
    const label = m === prevMonth ? day : `${m} ${day}`;
    prevMonth = m;
    return label;
  });
  return parts.join(", ") + (dates.length > max ? "…" : "");
}

export type PreorderMap = Record<string, string[]>;

/** recipe_id → sorted dates. futureOnly drops dates before today (Manila). */
export async function fetchPreorderDates(futureOnly = true): Promise<PreorderMap> {
  let q = supabase.from("recipe_preorder_dates").select("recipe_id, date").order("date");
  if (futureOnly) q = q.gte("date", todayManila());
  const { data, error } = await q;
  // Table missing (migration not run yet) → behave as "no pre-orders".
  if (error || !data) return {};
  const map: PreorderMap = {};
  for (const row of data as { recipe_id: string; date: string }[]) {
    (map[row.recipe_id] ||= []).push(row.date);
  }
  return map;
}

/** Live map of upcoming pre-order dates per product. */
export function usePreorderDates(futureOnly = true): [PreorderMap, () => void] {
  const [map, setMap] = useState<PreorderMap>({});
  const reload = () => { fetchPreorderDates(futureOnly).then(setMap); };
  useEffect(() => {
    reload();
    const ch = supabase
      .channel(`rt-preorder-dates-${futureOnly ? "future" : "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "recipe_preorder_dates" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [futureOnly]);
  return [map, reload];
}

// ── bag grouping ──

export interface CartGroup {
  /** "now" or the YYYY-MM-DD pre-order date */
  key: string;
  preorderDate: string | null;
  lines: { item: CartItem; index: number }[];
  subtotal: number;
  count: number;
}

export const groupKey = (item: CartItem) => item.preorderDate || "now";

/** "Available now" first, then one group per pre-order date (earliest first). */
export function groupCart(cart: CartItem[]): CartGroup[] {
  const map = new Map<string, CartGroup>();
  cart.forEach((item, index) => {
    const key = groupKey(item);
    let g = map.get(key);
    if (!g) { g = { key, preorderDate: item.preorderDate || null, lines: [], subtotal: 0, count: 0 }; map.set(key, g); }
    g.lines.push({ item, index });
    g.subtotal += (item.recipe.price ?? 0) * item.qty;
    g.count += item.qty;
  });
  return [...map.values()].sort((a, b) =>
    a.preorderDate === null ? -1 : b.preorderDate === null ? 1 : a.preorderDate.localeCompare(b.preorderDate)
  );
}

export const groupTitle = (g: { preorderDate: string | null }) =>
  g.preorderDate ? `Pre-order · ${fmtDate(g.preorderDate)}` : "Available now";
