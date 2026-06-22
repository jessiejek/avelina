import React, { useState } from "react";
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
  qty: string;
  status: "completed" | "in_progress" | "failed";
}

interface Props {
  entries: BakeEntry[];
  onUpdateEntry?: (id: string, status: BakeEntry["status"]) => void;
}

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

export default function BakeLog({ entries, onUpdateEntry }: Props) {
  const [localEntries, setLocalEntries] = useState<BakeEntry[]>(entries);

  // Sync when parent pushes new entries
  React.useEffect(() => { setLocalEntries(entries); }, [entries]);

  const updateStatus = async (id: string, status: BakeEntry["status"]) => {
    setLocalEntries((prev) => prev.map((e) => e.id === id ? { ...e, status } : e));
    await supabase.from("bake_entries").update({ status }).eq("id", id);
    onUpdateEntry?.(id, status);
  };

  const completed = localEntries.filter(e => e.status === "completed").length;
  const inProgress = localEntries.filter(e => e.status === "in_progress").length;
  const failed = localEntries.filter(e => e.status === "failed").length;
  const stats = [
    { icon: "check_circle", label: "Completed", value: completed, unit: "bakes", color: "text-secondary" },
    { icon: "oven_gen", label: "In Progress", value: inProgress, unit: "baking", color: "text-on-tertiary-fixed-variant" },
    { icon: "error", label: "Failed", value: failed, unit: "bakes", color: "text-error" },
    { icon: "history_edu", label: "Total Logged", value: localEntries.length, unit: "bakes", color: "text-primary" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 w-full bg-surface-bright border-b border-outline-variant/20">
        <h1 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 22 }}>Bake Log</h1>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex bg-surface-container rounded-full px-3 py-1.5 items-center gap-2 border border-outline-variant/20">
            <Icon name="search" size={16} className="text-outline" />
            <input className="bg-transparent border-none focus:outline-none text-sm w-44 placeholder:text-on-surface-variant/60" placeholder="Search batches..." />
          </div>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors">
            <Icon name="notifications" size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[11px] font-bold text-on-primary">AV</span>
          </div>
        </div>
      </header>

      <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
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
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-outline-variant/30 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
              <Icon name="filter_list" size={14} /> Filter
            </button>
            <button className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-outline-variant/30 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
              <Icon name="download" size={14} /> Export
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/20">
                {["Product", "Batch ID", "Baker", "Time", "Quantity", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {localEntries.map((row) => (
                <tr key={row.id} className="hover:bg-surface-container/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-surface-container">
                        <img src={row.img} alt={row.product} className="w-full h-full object-cover" />
                      </div>
                      <span className="font-semibold text-primary text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{row.product}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-on-surface-variant font-mono">{row.batchId}</td>
                  <td className="px-5 py-4 text-sm text-on-surface-variant">{row.baker}</td>
                  <td className="px-5 py-4 text-sm text-on-surface-variant font-mono">{row.time}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-primary font-mono">{row.qty}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusStyle(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {row.status === "in_progress" ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateStatus(row.id, "completed")}
                          className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-secondary-container text-on-secondary-container text-[11px] font-bold hover:opacity-80 transition-all"
                        >
                          <Icon name="check_circle" size={12} /> Done
                        </button>
                        <button
                          onClick={() => updateStatus(row.id, "failed")}
                          className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-error-container text-on-error-container text-[11px] font-bold hover:opacity-80 transition-all"
                        >
                          <Icon name="error" size={12} /> Fail
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-on-surface-variant/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {localEntries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Icon name="history_edu" size={32} className="text-outline/30 mx-auto mb-3" />
                    <p className="text-sm text-on-surface-variant">No bakes logged yet.</p>
                    <p className="text-xs text-on-surface-variant/60 mt-1">Use <span className="font-semibold">+ New Production</span> to start a bake.</p>
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
