// Centralized peso formatting so every screen shows money the same way.
export function peso(n: number | null | undefined): string {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  return "₱" + v.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
