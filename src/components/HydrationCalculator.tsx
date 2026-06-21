import React, { useState } from "react";

interface HydrationCalculatorProps {
  onBakeInitialize: (formula: {
    flourWeight: number; waterWeight: number; starterWeight: number; saltWeight: number;
    hydrationPct: number; wheatPct: number; ryePct: number; whitePct: number;
  }) => void;
}

const FONT_TITLE = { fontFamily: "'Hanken Grotesk', sans-serif" };
const FONT_BODY = { fontFamily: "'Work Sans', sans-serif" };
const FONT_MONO = { fontFamily: "'JetBrains Mono', monospace" };

function SliderRow({ id, label, value, min, max, step, unit, onChange, accent = "#26170c" }: {
  id: string; label: string; value: number; min: number; max: number; step: number;
  unit: string; onChange: (v: number) => void; accent?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="text-[#4f453f] font-semibold" style={FONT_BODY}>{label}</span>
        <span className="font-bold text-[#26170c] px-2.5 py-1 rounded-lg bg-[#f3ecea] text-sm" style={FONT_MONO}>{value} {unit}</span>
      </div>
      <input
        id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
        style={{ accentColor: accent, backgroundColor: "#e8e1df" }}
      />
    </div>
  );
}

export default function HydrationCalculator({ onBakeInitialize }: HydrationCalculatorProps) {
  const [flourWeight, setFlourWeight] = useState(500);
  const [waterWeight, setWaterWeight] = useState(360);
  const [starterWeight, setStarterWeight] = useState(100);
  const [saltWeight, setSaltWeight] = useState(10.5);
  const [factorStarterIn, setFactorStarterIn] = useState(true);
  const [starterHydration, setStarterHydration] = useState(100);
  const [whiteFlourPct, setWhiteFlourPct] = useState(80);
  const [wholeWheatPct, setWholeWheatPct] = useState(15);
  const [ryeFlourPct, setRyeFlourPct] = useState(5);

  const handleWhiteChange = (val: number) => {
    const v = Math.max(0, Math.min(100, val)); setWhiteFlourPct(v);
    const rem = 100 - v; const total = wholeWheatPct + ryeFlourPct || 1;
    setWholeWheatPct(Math.round((wholeWheatPct / total) * rem));
    setRyeFlourPct(100 - v - Math.round((wholeWheatPct / total) * rem));
  };
  const handleWWChange = (val: number) => {
    const v = Math.max(0, Math.min(100, val)); setWholeWheatPct(v);
    const rem = 100 - v; const total = whiteFlourPct + ryeFlourPct || 1;
    setWhiteFlourPct(Math.round((whiteFlourPct / total) * rem));
    setRyeFlourPct(100 - v - Math.round((whiteFlourPct / total) * rem));
  };
  const handleRyeChange = (val: number) => {
    const v = Math.max(0, Math.min(100, val)); setRyeFlourPct(v);
    const rem = 100 - v; const total = whiteFlourPct + wholeWheatPct || 1;
    setWhiteFlourPct(Math.round((whiteFlourPct / total) * rem));
    setWholeWheatPct(100 - v - Math.round((whiteFlourPct / total) * rem));
  };

  const totalFlourPct = whiteFlourPct + wholeWheatPct + ryeFlourPct;
  const starterHydMul = starterHydration / 100;
  const starterFlour = starterWeight / (1 + starterHydMul);
  const starterWater = starterWeight - starterFlour;
  const trueTotalFlour = flourWeight + (factorStarterIn ? starterFlour : 0);
  const trueTotalWater = waterWeight + (factorStarterIn ? starterWater : 0);
  const trueHydration = trueTotalFlour > 0 ? (trueTotalWater / trueTotalFlour) * 100 : 0;
  const nominalHydration = flourWeight > 0 ? (waterWeight / flourWeight) * 100 : 0;
  const saltBakerPct = flourWeight > 0 ? (saltWeight / flourWeight) * 100 : 0;
  const starterBakerPct = flourWeight > 0 ? (starterWeight / flourWeight) * 100 : 0;
  const totalDoughWeight = flourWeight + waterWeight + starterWeight + saltWeight;

  let feedback = {
    title: "Moderate Hydration (65%–72%)",
    bg: "#f9f2f0", border: "rgba(81,99,79,0.3)", icon: "local_fire_department", iconColor: "#51634f",
    desc: "Excellent crumb structural tension. Easy to score with complex patterns. Ideal for classic Pain de Campagne.",
  };
  if (trueHydration < 65) feedback = { title: "Low Hydration (< 65%)", bg: "#fbddca", border: "rgba(194,139,73,0.3)", icon: "grain", iconColor: "#c28b49", desc: "Dense, structural dough. Tight crumb, superb sandwich bread texture. Lower steam needed." };
  else if (trueHydration > 72 && trueHydration <= 80) feedback = { title: "High Hydration (72%–80%)", bg: "#fff8f5", border: "rgba(194,139,73,0.4)", icon: "water_drop", iconColor: "#c28b49", desc: "Open honeycomb crumb. Requires active Stretch & Folds for structural resistance." };
  else if (trueHydration > 80) feedback = { title: "Ultra-High Hydration (> 80%)", bg: "#ffdad6", border: "rgba(186,26,26,0.3)", icon: "waves", iconColor: "#ba1a1a", desc: "Semi-liquid matrix — ideal for Focaccia or Ciabatta. Handle with wet hands. High oven-spring spread." };

  return (
    <div id="calculator-screen" className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b" style={{ borderColor: "rgba(210,196,188,0.3)" }}>
        <div>
          <h2 className="text-3xl font-bold text-[#26170c] tracking-tight flex items-center gap-3" style={FONT_TITLE}>
            <span className="material-symbols-outlined text-[28px]" style={{ color: "#c28b49" }}>scale</span>
            Flour Physics & Hydration
          </h2>
          <p className="text-[#4f453f] text-sm mt-1" style={FONT_BODY}>
            Fine-tune ingredients with high-precision ratios factoring starter water and grain types.
          </p>
        </div>
        <button
          id="export-to-bake-btn"
          onClick={() => onBakeInitialize({ flourWeight, waterWeight, starterWeight, saltWeight, hydrationPct: Number(trueHydration.toFixed(1)), wheatPct: wholeWheatPct, ryePct: ryeFlourPct, whitePct: whiteFlourPct })}
          className="flex items-center gap-2 h-12 px-6 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 shrink-0"
          style={{ backgroundColor: "#26170c", fontFamily: "'Hanken Grotesk', sans-serif" }}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
          Start Active Bake
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sliders */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-6" style={{ borderColor: "rgba(38,23,12,0.1)" }}>
            <h3 className="font-bold text-[#26170c] text-lg flex items-center gap-2 pb-3 border-b" style={{ ...FONT_TITLE, borderColor: "rgba(210,196,188,0.3)" }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: "#c28b49" }}>science</span>
              Weight Formulas (g)
            </h3>
            <SliderRow id="input-flour-weight" label="Total Base Flour" value={flourWeight} min={100} max={3000} step={10} unit="g" onChange={setFlourWeight} />
            <SliderRow id="input-water-weight" label="Water Volume" value={waterWeight} min={50} max={2500} step={5} unit="g" onChange={setWaterWeight} />
            <SliderRow id="input-starter-weight" label="Sourdough Starter" value={starterWeight} min={0} max={1000} step={5} unit="g" onChange={setStarterWeight} />
            <SliderRow id="input-salt-weight" label="Maldon Salt" value={saltWeight} min={0} max={100} step={0.5} unit="g" onChange={setSaltWeight} accent="#81756e" />
          </div>

          <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-6" style={{ borderColor: "rgba(38,23,12,0.1)" }}>
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "rgba(210,196,188,0.3)" }}>
              <h3 className="font-bold text-[#26170c] text-lg flex items-center gap-2" style={FONT_TITLE}>
                <span className="material-symbols-outlined text-[20px]" style={{ color: "#c28b49" }}>grain</span>
                Grain Ratios (%)
              </h3>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-lg"
                style={{ ...FONT_MONO, backgroundColor: totalFlourPct === 100 ? "#d4e8ce" : "#ffdad6", color: totalFlourPct === 100 ? "#576955" : "#93000a" }}
              >
                {totalFlourPct}%
              </span>
            </div>
            {[
              { label: "Bread Flour T55 (White)", pct: whiteFlourPct, wt: (flourWeight * whiteFlourPct) / 100, onChange: handleWhiteChange, accent: "#26170c" },
              { label: "Stoneground Whole Wheat", pct: wholeWheatPct, wt: (flourWeight * wholeWheatPct) / 100, onChange: handleWWChange, accent: "#c28b49" },
              { label: "Dark Rye Flour", pct: ryeFlourPct, wt: (flourWeight * ryeFlourPct) / 100, onChange: handleRyeChange, accent: "#81756e" },
            ].map(({ label, pct, wt, onChange, accent }) => (
              <div key={label} className="space-y-2">
                <div className="flex justify-between text-xs" style={FONT_BODY}>
                  <span className="text-[#4f453f]">{label}</span>
                  <span className="font-bold text-[#26170c]" style={FONT_MONO}>{pct}% ({wt.toFixed(0)}g)</span>
                </div>
                <input type="range" min={0} max={100} value={pct} onChange={(e) => onChange(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer" style={{ accentColor: accent, backgroundColor: "#e8e1df" }} />
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Starter absorption */}
          <div className="bg-[#f9f2f0] border rounded-2xl p-6 shadow-sm space-y-4" style={{ borderColor: "rgba(210,196,188,0.4)" }}>
            <h4 className="text-xs font-bold text-[#26170c] uppercase tracking-wider" style={FONT_BODY}>Starter Absorption</h4>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                id="levain-water-factor-checkbox"
                type="checkbox" checked={factorStarterIn} onChange={(e) => setFactorStarterIn(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "#26170c" }}
              />
              <span className="text-sm font-semibold text-[#4f453f]" style={FONT_BODY}>Factor starter in chemistry</span>
            </label>
            {factorStarterIn && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs" style={FONT_BODY}>
                  <span className="text-[#4f453f]">Starter Hydration</span>
                  <span className="font-bold text-[#26170c]" style={FONT_MONO}>{starterHydration}%</span>
                </div>
                <input id="starter-hydration-slider" type="range" min={50} max={150} step={5} value={starterHydration}
                  onChange={(e) => setStarterHydration(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer" style={{ accentColor: "#26170c", backgroundColor: "#e8e1df" }} />
                <p className="text-[10px] text-[#81756e]" style={FONT_MONO}>
                  {starterFlour.toFixed(0)}g flour &bull; {starterWater.toFixed(0)}g water inside starter
                </p>
              </div>
            )}
          </div>

          {/* Yield profile */}
          <div className="rounded-2xl p-6 shadow-md space-y-5" style={{ backgroundColor: "#26170c" }}>
            <h3 className="font-bold text-[#dec1af] text-xs tracking-widest uppercase pb-3 border-b border-[#dec1af]/20" style={FONT_BODY}>
              Baker's Yield Profile
            </h3>
            <div className="text-center py-4 rounded-xl border" style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(222,193,175,0.2)" }}>
              <span className="text-[9px] text-[#ac9181] uppercase tracking-wider block mb-1 font-bold" style={FONT_MONO}>
                {factorStarterIn ? "TRUE HYDRATION" : "NOMINAL HYDRATION"}
              </span>
              <p className="text-5xl font-bold text-white" style={FONT_MONO}>
                {factorStarterIn ? trueHydration.toFixed(1) : nominalHydration.toFixed(1)}
                <span className="text-2xl">%</span>
              </p>
              {factorStarterIn && (
                <span className="text-[#dec1af]/60 text-[10px] mt-1 block" style={FONT_MONO}>
                  Nominal: {nominalHydration.toFixed(0)}% (excl. levain)
                </span>
              )}
            </div>
            <div className="space-y-3 text-xs" style={FONT_MONO}>
              {[
                { label: "Total batch weight", value: `${totalDoughWeight.toFixed(0)} g`, color: "white" },
                { label: "Salt proportion", value: `${saltBakerPct.toFixed(2)}%`, color: "#dec1af" },
                { label: "Levain ratio", value: `${starterBakerPct.toFixed(1)}%`, color: "#dec1af" },
                { label: "True active flour", value: `${trueTotalFlour.toFixed(0)} g`, color: "#f6efed" },
                { label: "True total water", value: `${trueTotalWater.toFixed(0)} g`, color: "#f6efed" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between border-b pb-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <span className="text-[#ac9181]">{label}</span>
                  <span className="font-bold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3.5 flex gap-2.5 text-[11px]" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(222,193,175,0.15)" }}>
              <span className="material-symbols-outlined text-[16px] text-[#dec1af] shrink-0">water_drop</span>
              <div style={FONT_BODY}>
                <span className="text-[#dec1af] font-bold block mb-0.5">Baker's Formula</span>
                <span className="text-[#ac9181]">
                  Flour (100%) &bull; Water ({factorStarterIn ? trueHydration.toFixed(0) : nominalHydration.toFixed(0)}%) &bull; Levain ({starterBakerPct.toFixed(0)}%) &bull; Salt ({saltBakerPct.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Hydration feedback */}
          <div className="rounded-2xl border p-5 space-y-2" style={{ backgroundColor: feedback.bg, borderColor: feedback.border }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]" style={{ color: feedback.iconColor }}>{feedback.icon}</span>
              <h4 className="font-bold text-sm text-[#26170c]" style={FONT_TITLE}>{feedback.title}</h4>
            </div>
            <p className="text-xs text-[#4f453f] leading-relaxed" style={FONT_BODY}>{feedback.desc}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
