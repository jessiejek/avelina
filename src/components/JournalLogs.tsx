import React, { useState } from "react";
import { JournalEntry, RecipeType } from "../types";

interface JournalLogsProps {
  entries: JournalEntry[];
  onAddEntry: (entry: JournalEntry) => void;
}

const FONT_TITLE = { fontFamily: "'Hanken Grotesk', sans-serif" };
const FONT_BODY = { fontFamily: "'Work Sans', sans-serif" };
const FONT_MONO = { fontFamily: "'JetBrains Mono', monospace" };

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="material-symbols-outlined text-[16px]"
          style={{
            color: i < Math.floor(score) ? "#c28b49" : "#d2c4bc",
            fontVariationSettings: i < Math.floor(score) ? "'FILL' 1" : "'FILL' 0",
          }}
        >
          star
        </span>
      ))}
      <span className="text-xs text-[#4f453f] ml-1" style={FONT_MONO}>{score.toFixed(1)}</span>
    </div>
  );
}

const typeLabel: Record<string, string> = {
  sourdough: "Sourdough",
  croissant: "Croissant",
  focaccia: "Focaccia",
  baguette: "Baguette",
  cookies: "Cookies",
  tarts: "Tarts",
  macarons: "Macarons",
};

export default function JournalLogs({ entries, onAddEntry }: JournalLogsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [name, setName] = useState("");
  const [recipeType, setRecipeType] = useState<RecipeType>("sourdough");
  const [rating, setRating] = useState(5);
  const [hydrationPct, setHydrationPct] = useState(75);
  const [ambientTemp, setAmbientTemp] = useState(24.0);
  const [humidity, setHumidity] = useState(60);
  const [flourDetails, setFlourDetails] = useState("80% Organic T55 Flour, 20% Whole Wheat");
  const [fermentationTime, setFermentationTime] = useState("4 hours bulk, 16 hours cold proof");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    let finalImage = image;
    if (!finalImage) {
      if (recipeType === "croissant") finalImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuDMImQD9JvezDy2RKsdfeyT5etQRnBaZ5YPP4ShaRX_VA8c-UXHMSI89p-GAnvxq2d8WjjMP0sSkFB6dKe7UDuAp1w-7c3DCmE0jdhymq7F20trqfrWvo59hdSXwL4EjtVpqaI1lteoLcoMri5ylyU5TbvUq9NVRAKHawA1jJOt1VGhVNLJjaWb0S-L-nzjgXyfmT0ym-2yjFmbDmvSTLZr9NTmtui7wJHs6GI1jsq0hHxvQNdBJf2u54t7x8kIRCJ8a2XqkshRGN5E";
      else if (recipeType === "focaccia") finalImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuBWnoEmI6kXty3OPj97E7r16caaf9GCPCpJJ_g2ghRjhxOpTLeZMLeW5FRWSdgCybNNbEDdsoj9H3JGhaAtNKIBvF3dT4BOQPmhHgx8vaIPK7FPmpXOZzTi3WiVjsiRtfkxco0Dgjf8ynwkJoxrVxGt4Dhi7mDz4SFuVnFdinCs0W2GfutC9KvQkb3xnDUQZ2SiBeXflNEAS-KJbF86B_Zo5sSmOF9BS0xxDZVo_cLcOhXwlYrDwM-cxkjMIidqkO__ZR8Xq6hs7tAl";
      else finalImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuBDgc7Eo_mKPDx7RQkmK3E6Oeg55QQKBMRAT1pEHPGUta986kzcUL47FPPj-8cDc_WI6I_f2dtvxDAyYwcbPoDDht9sWmF4J1aJZytIK_oURhBgPwHm57llVjrVhEQGLdGgxFnklIJv8uHKahRkeHJ44wZXli3uxhZzJqTMnTf3tcR1LQUujai0kOGJ1RdMNdDu3T1cZQQDnbB9_mV9T3qa1CpFATf1UxhMiVp4raaczYYKzO3jRNzuWdcQ5X4V18E6mkisi6tuAfFe";
    }
    const newEntry: JournalEntry = {
      id: `journal-${Date.now()}`, name, recipeType,
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      hydrationPct, rating, image: finalImage, notes, ambientTemp, humidity, flourDetails, fermentationTime,
    };
    onAddEntry(newEntry);
    setShowAddForm(false);
    setSelectedEntry(newEntry);
    setName(""); setNotes(""); setImage("");
  };

  const inputClass = "w-full bg-white border border-[#d2c4bc]/60 rounded-lg px-3.5 py-2.5 text-sm text-[#1d1b1a] focus:outline-none focus:ring-2 focus:ring-[#26170c]/20";

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#d2c4bc]/30">
        <div>
          <h2 className="text-3xl font-bold text-[#26170c] tracking-tight" style={FONT_TITLE}>
            Bake Log
          </h2>
          <p className="text-[#4f453f] text-sm mt-1" style={FONT_BODY}>
            A precise sensory record of every bake — hydration, crumb, and flavor.
          </p>
        </div>
        <button
          id="toggle-add-journal-btn"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 h-12 px-6 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90 active:scale-95 shrink-0"
          style={{ backgroundColor: "#26170c", fontFamily: "'Hanken Grotesk', sans-serif" }}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
          Log New Bake
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <form
          id="add-entry-form"
          onSubmit={handleSubmit}
          className="bg-white border border-[#d2c4bc]/40 rounded-2xl p-6 shadow-sm space-y-5"
        >
          <div className="flex items-center justify-between border-b border-[#f3ecea] pb-4">
            <h3 className="font-bold text-[#26170c] text-lg flex items-center gap-2" style={FONT_TITLE}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: "#c28b49" }}>auto_awesome</span>
              New Journal Entry
            </h3>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-[#81756e] hover:text-[#26170c] text-sm font-semibold">Cancel</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Bread Title</label>
              <input id="entry-title-input" type="text" placeholder="e.g., Pain de Campagne" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} style={FONT_BODY} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Recipe Type</label>
              <select id="entry-type-select" value={recipeType} onChange={(e) => setRecipeType(e.target.value as RecipeType)} className={inputClass} style={FONT_BODY}>
                <option value="sourdough">Sourdough Loaf</option>
                <option value="croissant">Butter Croissant</option>
                <option value="focaccia">Italian Focaccia</option>
                <option value="baguette">French Baguette</option>
                <option value="cookies">Artisanal Cookies</option>
                <option value="tarts">Decadent Tarts</option>
                <option value="macarons">Colorful Macarons</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Rating (1–5)</label>
              <input id="entry-rating-input" type="number" min="1" max="5" step="0.1" value={rating} onChange={(e) => setRating(Number(e.target.value))} className={inputClass} style={FONT_MONO} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Hydration %</label>
              <input id="entry-hydration-input" type="number" value={hydrationPct} onChange={(e) => setHydrationPct(Number(e.target.value))} className={inputClass} style={FONT_MONO} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Temp (°C)</label>
              <input id="entry-temp-input" type="number" step="0.5" value={ambientTemp} onChange={(e) => setAmbientTemp(Number(e.target.value))} className={inputClass} style={FONT_MONO} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Humidity %</label>
              <input id="entry-humidity-input" type="number" value={humidity} onChange={(e) => setHumidity(Number(e.target.value))} className={inputClass} style={FONT_MONO} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Flour Composition</label>
              <input id="entry-flourcomposition-input" type="text" value={flourDetails} onChange={(e) => setFlourDetails(e.target.value)} placeholder="70% T55, 20% Whole Wheat, 10% Rye" className={inputClass} style={FONT_BODY} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Fermentation Timeline</label>
              <input id="entry-fermentation-input" type="text" value={fermentationTime} onChange={(e) => setFermentationTime(e.target.value)} placeholder="4h bulk, 16h retard" className={inputClass} style={FONT_BODY} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Photo (optional)</label>
              <div className="border-2 border-dashed border-[#d2c4bc] hover:border-[#26170c]/40 rounded-xl p-4 text-center cursor-pointer relative bg-[#f9f2f0] hover:bg-[#f3ecea] transition-colors">
                <input id="entry-image-file" type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                <span className="material-symbols-outlined text-[32px] text-[#81756e] block mb-1">upload</span>
                <span className="text-xs text-[#4f453f] font-semibold block" style={FONT_BODY}>{image ? "Photo loaded" : "Upload loaf photo"}</span>
                <span className="text-[10px] text-[#81756e] block mt-0.5" style={FONT_MONO}>PNG, JPG supported</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#4f453f] uppercase tracking-wider block" style={FONT_BODY}>Baker Notes</label>
              <textarea id="entry-notes-textarea" rows={4} placeholder="Rate crumb aeration, sour notes, chewiness..." value={notes} onChange={(e) => setNotes(e.target.value)} required className="w-full bg-white border border-[#d2c4bc]/60 rounded-xl p-3.5 text-sm text-[#1d1b1a] focus:outline-none focus:ring-2 focus:ring-[#26170c]/20 resize-none" style={FONT_BODY} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-[#f3ecea]">
            <button type="button" onClick={() => setShowAddForm(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#4f453f] bg-[#f3ecea] hover:bg-[#eee7e4] transition-colors" style={FONT_BODY}>Cancel</button>
            <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: "#26170c", fontFamily: "'Hanken Grotesk', sans-serif" }}>Log Recipe</button>
          </div>
        </form>
      )}

      {/* Journal grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {entries.map((entry) => (
          <div
            id={`journal-entry-card-${entry.id}`}
            key={entry.id}
            onClick={() => setSelectedEntry(entry)}
            className="group bg-white rounded-2xl border overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col"
            style={{ borderColor: "rgba(38,23,12,0.1)" }}
          >
            <div className="relative h-48 overflow-hidden bg-[#f3ecea]">
              <img src={entry.image} alt={entry.name} referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute top-3 left-3">
                <span className="px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider" style={{ backgroundColor: "#d4e8ce", color: "#576955", fontFamily: "'Work Sans', sans-serif" }}>
                  {typeLabel[entry.recipeType] || entry.recipeType}
                </span>
              </div>
              {entry.hydrationPct > 0 && (
                <div className="absolute bottom-3 right-3">
                  <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg" style={{ backgroundColor: "#fbddca", color: "#26170c", fontFamily: "'JetBrains Mono', monospace" }}>
                    {entry.hydrationPct}%
                  </span>
                </div>
              )}
            </div>

            <div className="p-5 flex-1 flex flex-col space-y-3">
              <div>
                <h4 className="font-bold text-[#26170c] text-base leading-snug" style={FONT_TITLE}>{entry.name}</h4>
                <div className="mt-1.5"><StarRating score={entry.rating} /></div>
                <p className="text-[#4f453f] text-xs mt-2 leading-relaxed line-clamp-3" style={FONT_BODY}>{entry.notes}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-[#81756e] pt-3 border-t mt-auto" style={{ borderColor: "rgba(210,196,188,0.4)" }}>
                <div className="flex items-center gap-1.5" style={FONT_MONO}>
                  <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                  {entry.date}
                </div>
                <span className="flex items-center gap-0.5 font-semibold text-[#26170c]" style={FONT_BODY}>
                  View
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-[#26170c]/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div
            id="entry-detail-modal"
            className="bg-[#fff8f5] w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col relative"
            style={{ border: "1px solid rgba(38,23,12,0.15)" }}
          >
            <button onClick={() => setSelectedEntry(null)} className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-[#26170c]/80 hover:bg-[#26170c] text-white shadow transition-colors">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="relative h-64">
              <img src={selectedEntry.image} alt={selectedEntry.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#26170c]/70 to-transparent" />
              <div className="absolute bottom-5 left-6">
                <span className="px-3 py-1 text-[10px] font-bold rounded-full uppercase" style={{ backgroundColor: "#d4e8ce", color: "#576955", fontFamily: "'Work Sans', sans-serif" }}>
                  {typeLabel[selectedEntry.recipeType] || selectedEntry.recipeType}
                </span>
                <h3 className="text-2xl font-bold text-white mt-2 drop-shadow" style={FONT_TITLE}>{selectedEntry.name}</h3>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b" style={{ borderColor: "rgba(210,196,188,0.4)" }}>
                <StarRating score={selectedEntry.rating} />
                <div className="flex items-center gap-1.5 text-xs text-[#81756e]" style={FONT_MONO}>
                  <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                  {selectedEntry.date}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Hydration", value: selectedEntry.hydrationPct > 0 ? `${selectedEntry.hydrationPct}%` : "Laminated" },
                  { label: "Temp", value: `${selectedEntry.ambientTemp}°C` },
                  { label: "Humidity", value: `${selectedEntry.humidity}%` },
                  { label: "Rating", value: `${selectedEntry.rating}/5` },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-xl p-4 border" style={{ borderColor: "rgba(210,196,188,0.4)" }}>
                    <span className="text-[10px] font-semibold text-[#81756e] uppercase tracking-wider block" style={FONT_BODY}>{stat.label}</span>
                    <p className="font-bold text-[#26170c] text-lg mt-0.5" style={FONT_MONO}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {[
                { title: "Flour Composition", content: selectedEntry.flourDetails },
                { title: "Fermentation Profile", content: selectedEntry.fermentationTime },
                { title: "Baker Notes", content: selectedEntry.notes },
              ].map((block) => (
                <div key={block.title} className="bg-white p-5 rounded-xl border" style={{ borderColor: "rgba(210,196,188,0.4)" }}>
                  <h5 className="text-xs font-bold text-[#26170c] uppercase tracking-wider pb-2 mb-2 border-b" style={{ ...FONT_BODY, borderColor: "rgba(210,196,188,0.4)" }}>{block.title}</h5>
                  <p className="text-[#4f453f] text-sm leading-relaxed whitespace-pre-wrap" style={FONT_BODY}>{block.content}</p>
                </div>
              ))}

              <div className="flex justify-end pt-2 border-t" style={{ borderColor: "rgba(210,196,188,0.4)" }}>
                <button onClick={() => setSelectedEntry(null)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: "#26170c", fontFamily: "'Hanken Grotesk', sans-serif" }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
