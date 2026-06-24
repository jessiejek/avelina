import React, { useRef, useState } from "react";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";

export interface BakeEntry {
  id: string;
  recipe_id: string;
  product: string;
  img: string;
  batchId: string;
  baker: string;
  time: string;
  startedAt?: string;
  qty: string;
  actualQty?: number | null;
  status: "completed" | "in_progress" | "failed";
  order_id?: string | null;
}

interface Props {
  entries: BakeEntry[];
  onUpdateEntry?: (id: string, status: BakeEntry["status"]) => void;
}

type DateFilter = "today" | "week" | "month" | "all";

const statusStyle = (s: string) => {
  if (s === "completed") return "bg-secondary-container text-on-secondary-container";
  if (s === "in_progress") return "bg-tertiary-fixed text-on-tertiary-fixed-variant";
  return "bg-error-container text-on-error-container";
};
const statusLabel = (s: string) => {
  if (s === "completed") return "Completed";
  if (s === "in_progress") return "In Progress";
  return "Failed";
};

function startOf(period: DateFilter): Date | null {
  const d = new Date();
  if (period === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (period === "week") { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d; }
  if (period === "month") { d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
  return null;
}

const DATE_PILLS: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week",  label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all",   label: "All Time" },
];

export default function BakeLog({ entries, onUpdateEntry }: Props) {
  const [localEntries, setLocalEntries] = useState<BakeEntry[]>(entries);
  const [pendingComplete, setPendingComplete] = useState<{ id: string; actualQty: string } | null>(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const actualQtyRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => { setLocalEntries(entries); }, [entries]);

  const updateStatus = async (id: string, status: BakeEntry["status"], actualQty?: number) => {
    setLocalEntries((prev) => prev.map((e) => e.id === id ? { ...e, status } : e));
    const dbUpdate: Record<string, any> = { status };
    if (actualQty !== undefined) dbUpdate.actual_qty = actualQty;
    await supabase.from("bake_entries").update(dbUpdate).eq("id", id);
    onUpdateEntry?.(id, status);
  };

  const handleDoneClick = (row: BakeEntry) => {
    setPendingComplete({ id: row.id, actualQty: row.qty });
    setTimeout(() => actualQtyRef.current?.select(), 50);
  };

  const confirmComplete = async () => {
    if (!pendingComplete) return;
    const actualQtyNum = parseFloat(pendingComplete.actualQty) || undefined;
    await updateStatus(pendingComplete.id, "completed", actualQtyNum);
    setPendingComplete(null);
  };

  // Filter
  const since = startOf(dateFilter);
  const filtered = localEntries.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.product.toLowerCase().includes(q) || (e.batchId || "").toLowerCase().includes(q) || (e.baker || "").toLowerCase().includes(q);
    const matchDate = !since || !e.startedAt || new Date(e.startedAt) >= since;
    return matchSearch && matchDate;
  });

  const completed = filtered.filter(e => e.status === "completed").length;
  const inProgress = filtered.filter(e => e.status === "in_progress").length;
  const failed = filtered.filter(e => e.status === "failed").length;
  const statCards = [
    { icon: "check_circle", label: "Completed", value: completed, unit: "bakes", color: "text-secondary" },
    { icon: "oven_gen",     label: "In Progress", value: inProgress, unit: "baking", color: "text-on-tertiary-fixed-variant" },
    { icon: "error",        label: "Failed",    value: failed,     unit: "bakes", color: "text-error" },
    { icon: "history_edu",  label: "Total",     value: filtered.length, unit: "bakes", color: "text-primary" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <h1 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Bake Log</h1>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex bg-surface-container rounded-full px-3 py-1.5 items-center gap-2 border border-outline-variant/20">
            <Icon name="search" size={16} className="text-outline" />
            <input
              className="bg-transparent border-none focus:outline-none text-sm w-44 placeholder:text-on-surface-variant/60"
              placeholder="Search product, batch, baker…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[11px] font-bold text-on-primary">AV</span>
          </div>
        </div>
      </header>

      <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-5">
        {/* Date filter pills */}
        <div className="flex gap-2 flex-wrap">
          {DATE_PILLS.map((p) => (
            <button
              key={p.key}
              onClick={() => setDateFilter(p.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${dateFilter === p.key ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <div key={s.label} className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon name={s.icon} size={16} className={s.color} />
                <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">{s.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`${s.color} font-bold font-mono`} style={{ fontSize: 32, lineHeight: 1 }}>{s.value}</span>
                <span className="text-on-surface-variant text-xs ml-1">{s.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 18 }}>Production History</h3>
        </div>

        <div className="overflow-x-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/20">
                {["Product", "Batch ID", "Baker", "Date & Time", "Planned", "Actual Yield", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-surface-container/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-surface-container">
                        {row.img && <img src={row.img} alt={row.product} className="w-full h-full object-cover" />}
                      </div>
                      <span className="font-semibold text-primary text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{row.product}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-on-surface-variant font-mono">{row.batchId}</td>
                  <td className="px-5 py-4 text-sm text-on-surface-variant">{row.baker || <span className="text-on-surface-variant/40">—</span>}</td>
                  <td className="px-5 py-4 text-xs text-on-surface-variant">
                    {row.startedAt ? (
                      <div>
                        <p className="font-semibold text-primary">
                          {new Date(row.startedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        <p className="text-on-surface-variant/70">{row.time}</p>
                      </div>
                    ) : row.time}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-primary font-mono">{row.qty}</td>
                  <td className="px-5 py-4 text-sm font-mono">
                    {row.actualQty != null ? (
                      <span className={row.actualQty >= parseFloat(row.qty) ? "text-secondary font-bold" : "text-error font-bold"}>
                        {row.actualQty}
                      </span>
                    ) : (
                      <span className="text-on-surface-variant/40">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusStyle(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {row.status === "in_progress" && pendingComplete?.id === row.id ? (
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1 border border-outline-variant/40 rounded-lg overflow-hidden h-7">
                          <span className="text-[10px] text-on-surface-variant px-2 whitespace-nowrap">Actual qty:</span>
                          <input
                            ref={actualQtyRef}
                            type="text"
                            inputMode="decimal"
                            className="w-16 h-full px-1 text-sm font-mono font-bold text-primary focus:outline-none bg-surface-bright border-l border-outline-variant/40"
                            value={pendingComplete.actualQty}
                            onChange={(e) => setPendingComplete((p) => p ? { ...p, actualQty: e.target.value } : null)}
                            onKeyDown={(e) => { if (e.key === "Enter") confirmComplete(); if (e.key === "Escape") setPendingComplete(null); }}
                          />
                        </div>
                        <button onClick={confirmComplete} className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-secondary-container text-on-secondary-container text-[11px] font-bold hover:opacity-80 transition-all">
                          <Icon name="check_circle" size={12} /> Save
                        </button>
                        <button onClick={() => setPendingComplete(null)} className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-surface-container text-on-surface-variant text-[11px] font-bold hover:opacity-80 transition-all">
                          <Icon name="close" size={12} />
                        </button>
                      </div>
                    ) : row.status === "in_progress" ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleDoneClick(row)} className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-secondary-container text-on-secondary-container text-[11px] font-bold hover:opacity-80 transition-all">
                          <Icon name="check_circle" size={12} /> Done
                        </button>
                        <button onClick={() => updateStatus(row.id, "failed")} className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-error-container text-on-error-container text-[11px] font-bold hover:opacity-80 transition-all">
                          <Icon name="error" size={12} /> Fail
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-on-surface-variant/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Icon name="history_edu" size={32} className="text-outline/30 mx-auto mb-3" />
                    <p className="text-sm text-on-surface-variant">{search ? "No bakes match your search." : "No bakes logged yet."}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
