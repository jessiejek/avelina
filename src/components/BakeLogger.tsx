import React, { useState, useEffect } from "react";
import { ActiveBake, BakeStep } from "../types";

interface BakeLoggerProps {
  activeBakes: ActiveBake[];
  setActiveBakes: React.Dispatch<React.SetStateAction<ActiveBake[]>>;
  onBakeComplete: (bake: ActiveBake) => void;
}

const FONT_TITLE = { fontFamily: "'Hanken Grotesk', sans-serif" };
const FONT_BODY = { fontFamily: "'Work Sans', sans-serif" };
const FONT_MONO = { fontFamily: "'JetBrains Mono', monospace" };

export default function BakeLogger({ activeBakes, setActiveBakes, onBakeComplete }: BakeLoggerProps) {
  const [selectedBakeId, setSelectedBakeId] = useState("");
  const [showNewBakeForm, setShowNewBakeForm] = useState(false);
  const [newBakeName, setNewBakeName] = useState("Rustic Multi-Grain Batard");
  const [newRecipeType, setNewRecipeType] = useState<"sourdough" | "croissant" | "focaccia" | "baguette">("sourdough");
  const [newFlour, setNewFlour] = useState(500);
  const [newWater, setNewWater] = useState(365);
  const [newStarter, setNewStarter] = useState(100);
  const [newSalt, setNewSalt] = useState(10);
  const [newTemp, setNewTemp] = useState(24.5);
  const [newHum, setNewHum] = useState(60);

  useEffect(() => {
    if (activeBakes.length > 0 && !selectedBakeId) setSelectedBakeId(activeBakes[0].id);
  }, [activeBakes, selectedBakeId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBakes((prev) =>
        prev.map((bake) => {
          if (bake.isPaused) return bake;
          const updatedSteps = [...bake.steps];
          const activeStep = updatedSteps[bake.currentStepIdx];
          if (activeStep && !activeStep.completed && activeStep.remainingSeconds > 0) {
            updatedSteps[bake.currentStepIdx] = { ...activeStep, remainingSeconds: activeStep.remainingSeconds - 1 };
            return { ...bake, steps: updatedSteps };
          }
          return bake;
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [setActiveBakes]);

  const currentBake = activeBakes.find((b) => b.id === selectedBakeId);

  const handleTogglePause = (id: string) => setActiveBakes((prev) => prev.map((b) => b.id === id ? { ...b, isPaused: !b.isPaused } : b));

  const handleResetTimer = (bakeId: string, stepIdx: number) => {
    setActiveBakes((prev) => prev.map((b) => {
      if (b.id !== bakeId) return b;
      const steps = [...b.steps];
      if (steps[stepIdx]) steps[stepIdx] = { ...steps[stepIdx], remainingSeconds: steps[stepIdx].durationMinutes * 60 };
      return { ...b, steps };
    }));
  };

  const handleCompleteStep = (bakeId: string, stepIdx: number) => {
    setActiveBakes((prev) => prev.map((b) => {
      if (b.id !== bakeId) return b;
      const steps = [...b.steps];
      if (steps[stepIdx]) steps[stepIdx] = { ...steps[stepIdx], completed: true, remainingSeconds: 0 };
      const nextIdx = stepIdx + 1;
      if (nextIdx >= steps.length) { setTimeout(() => onBakeComplete(b), 100); return b; }
      return { ...b, steps, currentStepIdx: nextIdx, isPaused: true };
    }));
  };

  const handleDiscardBake = (id: string) => {
    setActiveBakes((prev) => {
      const filtered = prev.filter((b) => b.id !== id);
      setSelectedBakeId(filtered.length > 0 ? filtered[0].id : "");
      return filtered;
    });
  };

  const handleCreateBake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBakeName) return;
    let steps: BakeStep[] = [];
    let imgUrl = "";
    if (newRecipeType === "sourdough") {
      imgUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuCesM9qIveW7fLoy5suqUPLFI2NS4UqAlVe5bKNIrflyh08SDfDjs1EdVP5OnVZ4K09nNWtpLxZHDTLLip8qumPl5WpQODiudmEYgJq1U5RRk6kbLyKrFa1UqaUckwY78P3lwVF0QfFzmcbMo-ezSMAqfU1La-Q01L_5LdVhJ31v5WVLyXevG0AUAUR7Dyoz6lHy77cIelig6hoJShID-M6G009kqd9m-c0egqwVz37LS6kArg4kBTycdcHgYGV2F6mvXLIvEFpXgMv";
      steps = [
        { name: "Autolyse Rest", durationMinutes: 45, completed: false, startedAt: null, remainingSeconds: 45 * 60, instruction: "Rest flour and water to align gluten fibers." },
        { name: "Salt & Levain Mix", durationMinutes: 15, completed: false, startedAt: null, remainingSeconds: 15 * 60, instruction: "Squeeze dough evenly to absorb salt and levain." },
        { name: "Stretch & Fold I", durationMinutes: 30, completed: false, startedAt: null, remainingSeconds: 30 * 60, instruction: "Pull four edges high to build cohesive strength." },
        { name: "Stretch & Fold II", durationMinutes: 30, completed: false, startedAt: null, remainingSeconds: 30 * 60, instruction: "Build tension without breaking dough structure." },
        { name: "Bulk Fermentation", durationMinutes: 180, completed: false, startedAt: null, remainingSeconds: 180 * 60, instruction: "Ferment undisturbed. Check for tiny air pockets." },
        { name: "Preshaping", durationMinutes: 15, completed: false, startedAt: null, remainingSeconds: 15 * 60, instruction: "Round with wet bench scrapers before final shape." },
        { name: "Final Shape & Basket", durationMinutes: 20, completed: false, startedAt: null, remainingSeconds: 20 * 60, instruction: "Dust banetton with rice flour and load shaped loaf." },
        { name: "Oven Convection Bake", durationMinutes: 45, completed: false, startedAt: null, remainingSeconds: 45 * 60, instruction: "Bake in dutch oven at 245°C. Lid off at 25 minutes." },
      ];
    } else if (newRecipeType === "croissant") {
      imgUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuDMImQD9JvezDy2RKsdfeyT5etQRnBaZ5YPP4ShaRX_VA8c-UXHMSI89p-GAnvxq2d8WjjMP0sSkFB6dKe7UDuAp1w-7c3DCmE0jdhymq7F20trqfrWvo59hdSXwL4EjtVpqaI1lteoLcoMri5ylyU5TbvUq9NVRAKHawA1jJOt1VGhVNLJjaWb0S-L-nzjgXyfmT0ym-2yjFmbDmvSTLZr9NTmtui7wJHs6GI1jsq0hHxvQNdBJf2u54t7x8kIRCJ8a2XqkshRGN5E";
      steps = [
        { name: "Détrempe Mixing", durationMinutes: 20, completed: false, startedAt: null, remainingSeconds: 20 * 60, instruction: "Mix on low speed without overdeveloping gluten." },
        { name: "Butter Block Shape", durationMinutes: 15, completed: false, startedAt: null, remainingSeconds: 15 * 60, instruction: "Fold cold butter in parchment into a flat square." },
        { name: "First Lamination Fold", durationMinutes: 40, completed: false, startedAt: null, remainingSeconds: 40 * 60, instruction: "Fold dough envelope enclosing butter sheet." },
        { name: "Cold Retard Rest", durationMinutes: 60, completed: false, startedAt: null, remainingSeconds: 60 * 60, instruction: "Cool stack at 3°C to stabilize lamination." },
        { name: "Final Shape & Proof", durationMinutes: 120, completed: false, startedAt: null, remainingSeconds: 120 * 60, instruction: "Cut triangles, roll croissants, proof at 26°C." },
      ];
    } else {
      imgUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuBWnoEmI6kXty3OPj97E7r16caaf9GCPCpJJ_g2ghRjhxOpTLeZMLeW5FRWSdgCybNNbEDdsoj9H3JGhaAtNKIBvF3dT4BOQPmhHgx8vaIPK7FPmpXOZzTi3WiVjsiRtfkxco0Dgjf8ynwkJoxrVxGt4Dhi7mDz4SFuVnFdinCs0W2GfutC9KvQkb3xnDUQZ2SiBeXflNEAS-KJbF86B_Zo5sSmOF9BS0xxDZVo_cLcOhXwlYrDwM-cxkjMIidqkO__ZR8Xq6hs7tAl";
      steps = [
        { name: "Poolish Preparation", durationMinutes: 120, completed: false, startedAt: null, remainingSeconds: 120 * 60, instruction: "Mix flour and water with instant dry yeast." },
        { name: "Dough Autolyse", durationMinutes: 30, completed: false, startedAt: null, remainingSeconds: 30 * 60, instruction: "Mix main flour and water, leave poolish aside." },
        { name: "Dimple & Fold", durationMinutes: 40, completed: false, startedAt: null, remainingSeconds: 40 * 60, instruction: "Drizzle olive oil and dimple dough surface." },
        { name: "Bake with Toppings", durationMinutes: 25, completed: false, startedAt: null, remainingSeconds: 25 * 60, instruction: "Top with tomatoes, sea salt, and bake at 230°C." },
      ];
    }
    const initHydration = ((newWater + newStarter * 0.5) / (newFlour + newStarter * 0.5)) * 100;
    const newBake: ActiveBake = {
      id: `bake-${Date.now()}`, name: newBakeName, recipeType: newRecipeType,
      startedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      flourWeight: newFlour, waterWeight: newWater, starterWeight: newStarter, saltWeight: newSalt,
      totalPureFlour: newFlour + newStarter * 0.5, totalPureWater: newWater + newStarter * 0.5,
      hydrationPct: Number(initHydration.toFixed(1)), currentStepIdx: 0,
      image: imgUrl, steps, temperatureDough: newTemp, humidity: newHum,
      notes: "Initialized in Artisanal Bakelog.", isPaused: true,
    };
    setActiveBakes((prev) => [newBake, ...prev]);
    setSelectedBakeId(newBake.id);
    setShowNewBakeForm(false);
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? `${h}h ` : ""}${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const inputClass = "w-full bg-white border border-[#d2c4bc]/60 rounded-lg px-3.5 py-2.5 text-sm text-[#1d1b1a] focus:outline-none focus:ring-2 focus:ring-[#26170c]/20";

  return (
    <div id="bake-logger-container" className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b" style={{ borderColor: "rgba(210,196,188,0.3)" }}>
        <div>
          <h2 className="text-3xl font-bold text-[#26170c] tracking-tight flex items-center gap-3" style={FONT_TITLE}>
            <span className="material-symbols-outlined text-[28px]" style={{ color: "#c28b49" }}>timer</span>
            Active Production
          </h2>
          <p className="text-[#4f453f] text-sm mt-1" style={FONT_BODY}>
            Oversee fermentation steps with precision countdown clocks.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {activeBakes.length > 0 && (
            <select
              id="active-bake-selector"
              value={selectedBakeId}
              onChange={(e) => setSelectedBakeId(e.target.value)}
              className="bg-white border border-[#d2c4bc]/60 rounded-xl px-3 py-2.5 text-sm text-[#1d1b1a] focus:outline-none"
              style={FONT_BODY}
            >
              {activeBakes.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.hydrationPct}%)</option>
              ))}
            </select>
          )}
          <button
            id="start-new-batch-logger-btn"
            onClick={() => setShowNewBakeForm(!showNewBakeForm)}
            className="flex items-center gap-2 h-12 px-5 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#26170c", fontFamily: "'Hanken Grotesk', sans-serif" }}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Batch
          </button>
        </div>
      </div>

      {/* New batch form */}
      {showNewBakeForm && (
        <form id="new-bake-form" onSubmit={handleCreateBake} className="bg-white border border-[#d2c4bc]/40 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#f3ecea] pb-4">
            <h3 className="font-bold text-[#26170c] text-lg flex items-center gap-2" style={FONT_TITLE}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: "#c28b49" }}>tune</span>
              New Batch Logger
            </h3>
            <button type="button" onClick={() => setShowNewBakeForm(false)} className="text-[#81756e] hover:text-[#26170c] text-sm font-semibold" style={FONT_BODY}>Close</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Batch Name</label>
              <input id="form-bake-name" value={newBakeName} onChange={(e) => setNewBakeName(e.target.value)} required className={inputClass} style={FONT_BODY} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Recipe Type</label>
              <select id="form-recipe-type" value={newRecipeType} onChange={(e) => setNewRecipeType(e.target.value as any)} className={inputClass} style={FONT_BODY}>
                <option value="sourdough">Sourdough</option>
                <option value="croissant">Croissant</option>
                <option value="focaccia">Focaccia</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Base Flour (g)</label>
              <input id="form-flour" type="number" value={newFlour} onChange={(e) => setNewFlour(Number(e.target.value))} className={inputClass} style={FONT_MONO} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Water (g)</label>
              <input id="form-water" type="number" value={newWater} onChange={(e) => setNewWater(Number(e.target.value))} className={inputClass} style={FONT_MONO} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Starter (g)</label>
              <input id="form-starter" type="number" value={newStarter} onChange={(e) => setNewStarter(Number(e.target.value))} className={inputClass} style={FONT_MONO} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Salt (g)</label>
              <input id="form-salt" type="number" step="0.1" value={newSalt} onChange={(e) => setNewSalt(Number(e.target.value))} className={inputClass} style={FONT_MONO} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Dough Temp (°C)</label>
              <input id="form-temp" type="number" step="0.1" value={newTemp} onChange={(e) => setNewTemp(Number(e.target.value))} className={inputClass} style={FONT_MONO} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-[#f3ecea]">
            <button type="button" onClick={() => setShowNewBakeForm(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#4f453f] bg-[#f3ecea] hover:bg-[#eee7e4] transition-colors" style={FONT_BODY}>Cancel</button>
            <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: "#26170c", fontFamily: "'Hanken Grotesk', sans-serif" }}>
              Commit & Start
            </button>
          </div>
        </form>
      )}

      {currentBake ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Timer + Steps */}
          <div className="lg:col-span-2 space-y-5">
            {(() => {
              const activeStep = currentBake.steps[currentBake.currentStepIdx];
              return (
                <div id="master-time-clock-box" className="bg-white rounded-2xl border p-8 shadow-sm flex flex-col md:flex-row gap-6 items-center" style={{ borderColor: "rgba(38,23,12,0.1)" }}>
                  {/* Clock circle */}
                  <div className="w-44 h-44 rounded-full border-4 flex flex-col items-center justify-center shrink-0 relative" style={{ borderColor: "rgba(194,139,73,0.3)" }}>
                    <div className="absolute inset-2 rounded-full border-2 border-dashed" style={{ borderColor: "rgba(194,139,73,0.15)" }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#81756e] block" style={FONT_MONO}>REMAINING</span>
                    <p className="text-2xl font-bold text-[#26170c] mt-1" style={FONT_MONO}>
                      {activeStep ? formatTime(activeStep.remainingSeconds) : "Done"}
                    </p>
                    <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full mt-2" style={{ backgroundColor: "#fbddca", color: "#26170c", fontFamily: "'JetBrains Mono', monospace" }}>
                      STEP {currentBake.currentStepIdx + 1}/{currentBake.steps.length}
                    </span>
                  </div>
                  {/* Controls */}
                  <div className="flex-1 space-y-4 text-center md:text-left">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#c28b49] block" style={FONT_MONO}>ACTIVE STEP</span>
                      <h3 className="text-2xl font-bold text-[#26170c] mt-0.5" style={FONT_TITLE}>
                        {activeStep ? activeStep.name : "Sequence Complete"}
                      </h3>
                      <p className="text-[#4f453f] text-sm mt-1 leading-relaxed" style={FONT_BODY}>
                        {activeStep ? activeStep.instruction : "All steps finished — ready to log to journal."}
                      </p>
                    </div>
                    {activeStep && (
                      <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                        <button
                          id="play-pause-timer-btn"
                          onClick={() => handleTogglePause(currentBake.id)}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
                          style={currentBake.isPaused
                            ? { backgroundColor: "#26170c", color: "white", fontFamily: "'Hanken Grotesk', sans-serif" }
                            : { backgroundColor: "#f3ecea", color: "#26170c", fontFamily: "'Hanken Grotesk', sans-serif" }
                          }
                        >
                          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {currentBake.isPaused ? "play_arrow" : "pause"}
                          </span>
                          {currentBake.isPaused ? "Resume" : "Pause"}
                        </button>
                        <button
                          id="reset-step-timer-btn"
                          onClick={() => handleResetTimer(currentBake.id, currentBake.currentStepIdx)}
                          className="p-2.5 rounded-xl border hover:bg-[#f3ecea] transition-colors text-[#4f453f]"
                          style={{ borderColor: "rgba(210,196,188,0.6)" }}
                          title="Reset Timer"
                        >
                          <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                        </button>
                        <button
                          id="complete-active-step-btn"
                          onClick={() => handleCompleteStep(currentBake.id, currentBake.currentStepIdx)}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90"
                          style={{ backgroundColor: "#51634f", fontFamily: "'Hanken Grotesk', sans-serif" }}
                        >
                          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          Complete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Step pipeline */}
            <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-3" style={{ borderColor: "rgba(38,23,12,0.1)" }}>
              <h4 className="text-xs font-bold text-[#26170c] uppercase tracking-wider pb-2 border-b" style={{ ...FONT_BODY, borderColor: "rgba(210,196,188,0.4)" }}>
                Production Steps
              </h4>
              <div className="space-y-2">
                {currentBake.steps.map((step, idx) => {
                  const isCurrent = idx === currentBake.currentStepIdx;
                  const isPassed = idx < currentBake.currentStepIdx;
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border flex items-center justify-between text-sm transition-colors"
                      style={{
                        backgroundColor: isCurrent ? "#fff8f5" : isPassed ? "#f9f2f0" : "white",
                        borderColor: isCurrent ? "rgba(194,139,73,0.4)" : "rgba(210,196,188,0.3)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{
                            backgroundColor: isCurrent ? "#26170c" : isPassed ? "#d4e8ce" : "#f3ecea",
                            color: isCurrent ? "white" : isPassed ? "#576955" : "#4f453f",
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {isPassed
                            ? <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                            : idx + 1
                          }
                        </div>
                        <div>
                          <span
                            className="text-sm font-semibold"
                            style={{ ...FONT_BODY, color: isCurrent ? "#26170c" : isPassed ? "#81756e" : "#4f453f", textDecoration: isPassed ? "line-through" : "none" }}
                          >
                            {step.name}
                          </span>
                          <span className="hidden md:inline text-xs text-[#81756e] ml-2" style={FONT_BODY}>&bull; {step.instruction}</span>
                        </div>
                      </div>
                      <span className="text-xs text-[#81756e] shrink-0" style={FONT_MONO}>
                        {isPassed ? "Done" : `${step.durationMinutes}m`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Parameters + Notes */}
          <div className="space-y-5">
            <div className="bg-[#f9f2f0] rounded-2xl border p-6 shadow-sm space-y-4" style={{ borderColor: "rgba(210,196,188,0.4)" }}>
              <h3 className="text-xs font-bold text-[#26170c] uppercase tracking-wider" style={FONT_BODY}>Physics Parameters</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border p-3.5" style={{ borderColor: "rgba(210,196,188,0.4)" }}>
                  <span className="text-[9px] font-bold text-[#81756e] uppercase tracking-wider block" style={FONT_BODY}>Dough Temp</span>
                  <p className="font-bold text-[#26170c] text-base mt-1" style={FONT_MONO}>{currentBake.temperatureDough}°C</p>
                </div>
                <div className="bg-white rounded-xl border p-3.5" style={{ borderColor: "rgba(210,196,188,0.4)" }}>
                  <span className="text-[9px] font-bold text-[#81756e] uppercase tracking-wider block" style={FONT_BODY}>Humidity</span>
                  <p className="font-bold text-[#26170c] text-base mt-1" style={FONT_MONO}>{currentBake.humidity}%</p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t text-xs text-[#4f453f]" style={{ borderColor: "rgba(210,196,188,0.4)" }}>
                {[
                  ["Base Flour", `${currentBake.flourWeight} g`],
                  ["Water", `${currentBake.waterWeight} g`],
                  ["Starter", `${currentBake.starterWeight} g`],
                  ["Salt", `${currentBake.saltWeight} g`],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center" style={FONT_BODY}>
                    <span>{label}</span>
                    <span className="font-bold text-[#26170c]" style={FONT_MONO}>{val}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-1 border-t font-bold text-[#26170c]" style={{ borderColor: "rgba(210,196,188,0.4)", ...FONT_BODY }}>
                  <span>Hydration</span>
                  <span style={{ ...FONT_MONO, color: "#c28b49" }}>{currentBake.hydrationPct}%</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDiscardBake(currentBake.id)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors text-[#81756e] hover:text-[#ba1a1a] hover:border-[#ba1a1a]/30"
                style={{ borderColor: "rgba(210,196,188,0.5)", ...FONT_BODY }}
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Discard Batch
              </button>
            </div>

            <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-3" style={{ borderColor: "rgba(38,23,12,0.1)" }}>
              <h4 className="text-xs font-bold text-[#26170c] uppercase tracking-wider" style={FONT_BODY}>Batch Notes</h4>
              <textarea
                id="active-bake-notes"
                value={currentBake.notes}
                onChange={(e) => {
                  const v = e.target.value;
                  setActiveBakes((prev) => prev.map((b) => b.id === currentBake.id ? { ...b, notes: v } : b));
                }}
                placeholder="Log crust results, elasticity observations..."
                className="w-full h-32 p-3 bg-[#f9f2f0] border border-[#d2c4bc]/40 rounded-xl text-xs text-[#1d1b1a] focus:outline-none focus:ring-1 focus:ring-[#26170c]/20 resize-none"
                style={FONT_BODY}
              />
              <p className="text-[10px] text-[#81756e] flex items-center gap-1" style={FONT_MONO}>
                <span className="material-symbols-outlined text-[12px]">edit_note</span>
                Auto-saves locally
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div id="no-bakes-state" className="text-center py-20 bg-white border rounded-2xl max-w-lg mx-auto" style={{ borderColor: "rgba(210,196,188,0.4)" }}>
          <span className="material-symbols-outlined text-[64px] text-[#d2c4bc] block mb-4">timer</span>
          <h3 className="text-lg font-bold text-[#26170c]" style={FONT_TITLE}>No active batch running</h3>
          <p className="text-[#4f453f] text-sm mt-2 leading-relaxed px-8" style={FONT_BODY}>
            Configure your formula in <strong>Formulas</strong> and click "Start active bake" — or create a new batch below.
          </p>
          <button
            id="empty-state-new-batch-btn"
            onClick={() => setShowNewBakeForm(true)}
            className="mt-6 flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#26170c", fontFamily: "'Hanken Grotesk', sans-serif" }}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Blank Logger
          </button>
        </div>
      )}
    </div>
  );
}
