import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.ts";
import Icon from "./Icon.tsx";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Module-level cache — all pickers on the page share one fetch
let _cache: Set<string> | null = null;
let _promise: Promise<Set<string>> | null = null;

function fetchAvailableDates(): Promise<Set<string>> {
  if (_cache) return Promise.resolve(_cache);
  if (!_promise) {
    _promise = supabase
      .from("bake_available_dates")
      .select("date")
      .then(({ data }) => {
        _cache = new Set((data || []).map((d: any) => d.date));
        return _cache;
      });
  }
  return _promise;
}

interface Props {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
}

export default function AvailableDatePicker({ value, onChange, placeholder = "Select pickup date" }: Props) {
  const todayStr = new Date().toISOString().split("T")[0];

  const [open, setOpen] = useState(false);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAvailableDates().then((dates) => {
      setAvailableDates(dates);
      setLoading(false);
      // Jump to the earliest upcoming available month
      const future = [...dates].filter((d) => d >= todayStr).sort();
      if (future.length > 0) {
        const [y, m] = future[0].split("-").map(Number);
        setViewYear(y);
        setViewMonth(m - 1);
      }
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDow = firstDay.getDay();
  const monthLabel = firstDay.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;

  const displayValue = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : "";

  const hasFutureDates = [...availableDates].some((d) => d >= todayStr);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !loading && hasFutureDates && setOpen((v) => !v)}
        className={`w-full h-10 px-3 rounded-lg border text-sm text-left flex items-center justify-between gap-2 transition-all focus:outline-none
          ${value
            ? "border-[#26170c]/30 bg-[#fff8f5] text-[#26170c] font-semibold"
            : "border-[#26170c]/15 bg-[#fff8f5] text-[#26170c]/40"}
          ${hasFutureDates && !loading ? "hover:border-[#26170c]/40 cursor-pointer" : "cursor-default opacity-60"}
        `}
      >
        <span className="truncate">{loading ? "Loading…" : (displayValue || placeholder)}</span>
        <Icon name={loading ? "progress_activity" : "calendar_month"} size={16} className="text-[#26170c]/40 shrink-0" />
      </button>

      {/* No dates warning */}
      {!loading && !hasFutureDates && (
        <p className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
          <Icon name="warning" size={12} />
          No pickup dates available yet — check back soon.
        </p>
      )}

      {/* Popup calendar */}
      {open && (
        <div className="absolute z-50 left-0 mt-1.5 bg-white rounded-2xl border border-[#26170c]/10 shadow-2xl p-4" style={{ width: 280 }}>
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#26170c]/50 hover:bg-[#26170c]/8 transition-colors">
              <Icon name="chevron_left" size={18} />
            </button>
            <span className="text-sm font-bold text-[#26170c]" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
              {monthLabel}
            </span>
            <button type="button" onClick={nextMonth} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#26170c]/50 hover:bg-[#26170c]/8 transition-colors">
              <Icon name="chevron_right" size={18} />
            </button>
          </div>

          {/* DOW headers */}
          <div className="grid grid-cols-7 mb-1">
            {DOW.map((d) => (
              <div key={d} className="text-center text-[9px] font-bold text-[#26170c]/35 uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isAvailable = availableDates.has(dateStr);
              const isPast = dateStr < todayStr;
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;
              const clickable = isAvailable && !isPast;

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={!clickable}
                  onClick={() => { onChange(dateStr); setOpen(false); }}
                  className={[
                    "aspect-square rounded-lg flex items-center justify-center text-xs font-semibold transition-all select-none",
                    isSelected
                      ? "bg-[#26170c] text-white"
                      : clickable
                        ? "bg-[#26170c]/10 text-[#26170c] hover:bg-[#26170c]/20 active:scale-90 cursor-pointer"
                        : "text-[#26170c]/18 cursor-default",
                    isToday && !isSelected ? "ring-1 ring-[#26170c]/40" : "",
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* No available days this month */}
          {![...availableDates].some((d) => d.startsWith(monthPrefix) && d >= todayStr) && (
            <p className="text-center text-[11px] text-[#26170c]/35 mt-3 pb-1">No baking days this month</p>
          )}

          {/* Legend */}
          <div className="mt-3 pt-3 border-t border-[#26170c]/8 flex items-center gap-3 text-[10px] text-[#26170c]/50">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#26170c]/10 inline-block border border-[#26170c]/10" /> Available</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#26170c] inline-block" /> Selected</span>
          </div>
        </div>
      )}
    </div>
  );
}
