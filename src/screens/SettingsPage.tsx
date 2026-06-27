import React, { useState, useEffect } from "react";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function SettingsPage() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("bake_available_dates").select("date").then(({ data }) => {
      if (data) setAvailableDates(new Set(data.map((d: any) => d.date)));
      setLoading(false);
    });
  }, []);

  const toggleDate = async (dateStr: string) => {
    if (toggling) return;
    setToggling(dateStr);
    if (availableDates.has(dateStr)) {
      await supabase.from("bake_available_dates").delete().eq("date", dateStr);
      setAvailableDates((prev) => { const next = new Set(prev); next.delete(dateStr); return next; });
    } else {
      await supabase.from("bake_available_dates").insert({ date: dateStr });
      setAvailableDates((prev) => new Set([...prev, dateStr]));
    }
    setToggling(null);
  };

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
  const thisMonthCount = [...availableDates].filter((d) => d.startsWith(monthPrefix)).length;

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 28 }}>Settings</h1>
          <p className="text-sm text-on-surface-variant mt-1">Manage bakery availability and preferences.</p>
        </div>

        {/* Availability card */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden">
          <div className="px-6 py-5 border-b border-outline-variant/10 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center shrink-0">
              <Icon name="calendar_month" size={20} className="text-on-secondary-container" />
            </div>
            <div>
              <h2 className="font-bold text-primary text-base" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Baking Availability</h2>
              <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                Tap days you'll be baking. Customers will only be able to choose these dates for pickup.
              </p>
            </div>
          </div>

          <div className="p-5">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={prevMonth}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <Icon name="chevron_left" size={20} />
              </button>
              <span className="font-bold text-primary text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                {monthLabel}
              </span>
              <button
                onClick={nextMonth}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <Icon name="chevron_right" size={20} />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {DOW.map((d) => (
                <div key={d} className="text-center text-[10px] font-bold text-on-surface-variant uppercase tracking-wider py-1.5">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            {loading ? (
              <div className="h-44 flex items-center justify-center">
                <span className="text-sm text-on-surface-variant">Loading…</span>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isAvailable = availableDates.has(dateStr);
                  const isPast = dateStr < todayStr;
                  const isToday = dateStr === todayStr;
                  const isBusy = toggling === dateStr;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => !isPast && toggleDate(dateStr)}
                      disabled={isPast || !!toggling}
                      className={[
                        "aspect-square rounded-xl flex items-center justify-center text-sm font-semibold transition-all select-none",
                        isPast
                          ? "text-on-surface-variant/25 cursor-default"
                          : isAvailable
                            ? "bg-primary text-on-primary hover:opacity-75 active:scale-90 cursor-pointer"
                            : "text-on-surface hover:bg-surface-container active:scale-90 cursor-pointer",
                        isToday && !isAvailable ? "ring-2 ring-primary/50" : "",
                        isBusy ? "opacity-40" : "",
                      ].join(" ")}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend + summary */}
            <div className="mt-5 pt-4 border-t border-outline-variant/10 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-on-surface-variant">
                {thisMonthCount === 0
                  ? "No baking days set for this month"
                  : `${thisMonthCount} baking day${thisMonthCount !== 1 ? "s" : ""} this month`}
              </p>
              <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-primary inline-block" />
                  Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-surface-container border border-outline-variant/30 inline-block" />
                  Not set
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming available dates list */}
        {availableDates.size > 0 && (() => {
          const upcoming = [...availableDates]
            .filter((d) => d >= todayStr)
            .sort()
            .slice(0, 8);
          if (upcoming.length === 0) return null;
          return (
            <div className="mt-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5">
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Upcoming Baking Days</h3>
              <div className="flex flex-wrap gap-2">
                {upcoming.map((d) => {
                  const label = new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", weekday: "short" });
                  return (
                    <span key={d} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-secondary-container text-on-secondary-container px-3 py-1.5 rounded-full">
                      <Icon name="event_available" size={12} />
                      {label}
                    </span>
                  );
                })}
                {[...availableDates].filter((d) => d >= todayStr).length > 8 && (
                  <span className="text-xs text-on-surface-variant self-center">+{[...availableDates].filter((d) => d >= todayStr).length - 8} more</span>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
