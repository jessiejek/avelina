import React, { useState, useEffect } from "react";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type Category = { id: string; name: string };

export default function SettingsPage() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [catError, setCatError] = useState("");

  useEffect(() => {
    supabase.from("bake_available_dates").select("date").then(({ data }) => {
      if (data) setAvailableDates(new Set(data.map((d: any) => d.date)));
      setLoading(false);
    });

    supabase.from("recipe_categories").select("id, name").order("created_at").then(({ data }) => {
      if (data) setCategories(data as Category[]);
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

  const copySQL = (key: string, sql: string) => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setCatError("Category already exists.");
      return;
    }
    setSavingCat(true);
    setCatError("");
    const { data, error } = await supabase.from("recipe_categories").insert({ name }).select("id, name").single();
    setSavingCat(false);
    if (error) { setCatError(error.message); return; }
    setCategories((prev) => [...prev, data as Category]);
    setNewCatName("");
  };

  const deleteCategory = async (id: string) => {
    await supabase.from("recipe_categories").delete().eq("id", id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
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

        {/* Upcoming available dates — right below the calendar */}
        {availableDates.size > 0 && (() => {
          const upcoming = [...availableDates].filter((d) => d >= todayStr).sort();
          if (upcoming.length === 0) return null;
          return (
            <div className="mt-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5">
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Upcoming Baking Days</h3>
              <div className="flex flex-wrap gap-2">
                {upcoming.slice(0, 8).map((d) => {
                  const label = new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", weekday: "short" });
                  return (
                    <span key={d} className="text-xs font-semibold bg-secondary-container text-on-secondary-container px-3 py-1.5 rounded-full">
                      {label}
                    </span>
                  );
                })}
                {upcoming.length > 8 && (
                  <span className="text-xs text-on-surface-variant self-center">+{upcoming.length - 8} more</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Recipe Categories */}
        <div className="mt-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden">
          <div className="px-6 py-5 border-b border-outline-variant/10 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-tertiary-container flex items-center justify-center shrink-0">
              <Icon name="category" size={20} className="text-on-tertiary-container" />
            </div>
            <div>
              <h2 className="font-bold text-primary text-base" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Recipe Categories</h2>
              <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                These appear as filter pills on the menu and in the recipe builder dropdown.
              </p>
            </div>
          </div>
          <div className="p-5 space-y-2">
            {categories.length === 0 && (
              <p className="text-sm text-on-surface-variant text-center py-3">No categories yet.</p>
            )}
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between gap-3 px-4 h-11 rounded-xl bg-surface-container">
                <span className="text-sm font-semibold text-primary">{cat.name}</span>
                <button
                  onClick={() => deleteCategory(cat.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error transition-all"
                >
                  <Icon name="delete" size={15} />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-2 border-t border-outline-variant/10 mt-2">
              <input
                className="flex-1 h-10 px-3 rounded-xl border border-outline-variant/40 bg-surface-container text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/40"
                placeholder="New category name…"
                value={newCatName}
                onChange={(e) => { setNewCatName(e.target.value); setCatError(""); }}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
              />
              <button
                onClick={addCategory}
                disabled={savingCat || !newCatName.trim()}
                className="h-10 px-4 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
              >
                {savingCat ? "…" : "Add"}
              </button>
            </div>
            {catError && <p className="text-xs text-error font-semibold">{catError}</p>}
          </div>
        </div>

        {/* Database Setup — collapsed by default */}
        {(() => {
          const migrations = [
            {
              key: "users_rls",
              label: "Users Table — Row Level Security",
              sql: `-- Run this if customers keep getting redirected to profile setup on every refresh.
-- It grants each user read/write access to their own row only.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own row" ON users;

CREATE POLICY "Users manage own row"
  ON users FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);`,
            },
            {
              key: "bake_available_dates",
              label: "Baking Availability Dates",
              sql: `CREATE TABLE IF NOT EXISTS bake_available_dates (
  date text PRIMARY KEY
);

ALTER TABLE bake_available_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read available dates"
  ON bake_available_dates FOR SELECT USING (true);

CREATE POLICY "Admins manage available dates"
  ON bake_available_dates FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE bake_available_dates;`,
            },
            {
              key: "recipe_categories",
              label: "Recipe Categories",
              sql: `CREATE TABLE IF NOT EXISTS recipe_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

INSERT INTO recipe_categories (name) VALUES
  ('Sourdough'), ('Viennoiserie'), ('Cakes'),
  ('Pastry'), ('Bread'), ('Other')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE recipe_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read categories"
  ON recipe_categories FOR SELECT USING (true);

CREATE POLICY "Admins manage categories"
  ON recipe_categories FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  ));`,
            },
          ];

          return (
            <div className="mt-4">
              <button
                onClick={() => setShowDevTools((v) => !v)}
                className="flex items-center gap-2 text-xs text-on-surface-variant/40 hover:text-on-surface-variant/70 transition-colors mx-auto"
              >
                <Icon name={showDevTools ? "expand_less" : "expand_more"} size={14} />
                Developer Tools
              </button>

              {showDevTools && (
                <div className="mt-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden">
                  <div className="px-6 py-4 border-b border-outline-variant/10">
                    <h2 className="font-bold text-primary text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Database Setup</h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Run once in <span className="font-semibold">Supabase → SQL Editor</span> when setting up a new environment.
                    </p>
                  </div>
                  <div className="p-4 space-y-3">
                    {migrations.map((m) => (
                      <div key={m.key} className="rounded-xl border border-outline-variant/30 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-surface-container border-b border-outline-variant/20">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{m.label}</span>
                          <button
                            onClick={() => copySQL(m.key, m.sql)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:opacity-70 transition-opacity"
                          >
                            <Icon name={copiedKey === m.key ? "check" : "content_copy"} size={12} />
                            {copiedKey === m.key ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <pre className="text-[10px] font-mono text-on-surface-variant/70 px-3 py-2.5 overflow-x-auto leading-relaxed bg-surface-container/20">
                          {m.sql}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
