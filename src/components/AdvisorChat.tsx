import React, { useState, useRef, useEffect } from "react";
import { ChatMessage } from "../types";

interface AdvisorChatProps {
  currentFormulasContext: {
    flourWeight: number; waterWeight: number; starterWeight: number;
    saltWeight: number; hydrationPct: number; recipeType: string;
  };
}

const FONT_TITLE = { fontFamily: "'Hanken Grotesk', sans-serif" };
const FONT_BODY = { fontFamily: "'Work Sans', sans-serif" };
const FONT_MONO = { fontFamily: "'JetBrains Mono', monospace" };

const SUGGESTED_PROMPTS = [
  { text: "My bread dough is sticky & spreads too wide", icon: "grain" },
  { text: "How can I fix tight underproofed gummy crumb?", icon: "water_drop" },
  { text: "Julian's master advice for perfect scored ears", icon: "local_fire_department" },
];

export default function AdvisorChat({ currentFormulasContext }: AdvisorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: "init", sender: "assistant",
    text: "Bonjour, mon ami! I am Julian, your master baking consultant. Place your flour ratios, scoring photos, or crumb structures before me. Have you run into issues with under-proofing, shaping stickiness, or low oven spring? Let us diagnose and bake with absolute precision!",
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }]);
  const [inputValue, setInputValue] = useState("");
  const [attachedImage, setAttachedImage] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const handleSendMessage = async (customPrompt?: string) => {
    const prompt = customPrompt || inputValue;
    if (!prompt.trim() && !attachedImage) return;
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`, sender: "user", text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      image: attachedImage || undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue(""); setAttachedImage(""); setLoading(true);
    try {
      const res = await fetch("/api/gemini/diagnose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context: { ...currentFormulasContext, timestamp: new Date().toLocaleTimeString() }, image: userMsg.image }),
      });
      const data = await res.json();
      if (res.ok && data.response) {
        setMessages((prev) => [...prev, { id: `ast-${Date.now()}`, sender: "assistant", text: data.response, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      } else throw new Error(data.error || "Let's review our flour elements again.");
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`, sender: "assistant",
        text: `Ah, there was a minor temperature spike in the digital ovens!\n\nError: ${err?.message || "Connection refused"}\n\nPlease ensure your GEMINI_API_KEY is configured in the Secrets panel.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    } finally { setLoading(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const r = new FileReader(); r.onloadend = () => setAttachedImage(r.result as string); r.readAsDataURL(file); }
  };

  const clearHistory = () => setMessages([{
    id: "init", sender: "assistant",
    text: "Bonjour! Let us begin our sensory diagnosis again. Bring your water volumes, autolyse times, or crumb screenshots.",
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }]);

  return (
    <div
      id="advisor-assistant-screen"
      className="max-w-4xl mx-auto flex flex-col overflow-hidden shadow-sm rounded-2xl border"
      style={{ height: "calc(100vh - 130px)", borderColor: "rgba(38,23,12,0.1)", backgroundColor: "#fff8f5" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ backgroundColor: "#26170c", borderColor: "rgba(222,193,175,0.15)" }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCtc_UaixfCeUfz7q-g-E2U7ue-5DUoAJ4_Awhbcne1Q9gqtchX-DNHyKA_78DKpO4MQVzsGKgAWqIHGVnBxmghnEpD09aNRan9CnB0O2nYnluwMgE1zkNst8H6xU-qC8_SUBycg-_1T8HDgSax6NRSiGl7EpBwY3DoKjZUjQsKIkUewjQi1oeNPBE_dhZFu0FWi8lAHemG3mlXcn5sTkNyau0DkPRb96uym9FSc7LCVoWkm7kRKOlTPmyPjdMMTrQxb5izdTO2LJwz"
              alt="Julian" referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-full object-cover border-2" style={{ borderColor: "#dec1af" }}
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#51634f] border-2 rounded-full" style={{ borderColor: "#26170c" }} />
          </div>
          <div>
            <h3 className="font-bold text-[#fbddca] text-sm" style={FONT_TITLE}>Chef Julian Pierre</h3>
            <p className="text-[10px] text-[#ac9181] flex items-center gap-1 mt-0.5" style={FONT_MONO}>
              <span className="material-symbols-outlined text-[12px]" style={{ color: "#dec1af" }}>auto_awesome</span>
              Sourdough & Lamination Specialist &bull; ACTIVE
            </p>
          </div>
        </div>
        <button
          id="clear-chat-btn"
          onClick={clearHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-colors text-[#ac9181] hover:text-[#fbddca]"
          style={{ borderColor: "rgba(222,193,175,0.2)", ...FONT_BODY }}
        >
          <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>

      {/* Context banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b text-xs text-[#4f453f] shrink-0" style={{ backgroundColor: "#f9f2f0", borderColor: "rgba(210,196,188,0.4)" }}>
        <div className="flex items-center gap-2" style={FONT_BODY}>
          <span className="material-symbols-outlined text-[14px]" style={{ color: "#c28b49" }}>edit_note</span>
          Active formula:
          <span className="font-bold px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: "#fbddca", color: "#26170c", fontFamily: "'JetBrains Mono', monospace" }}>
            Flour: {currentFormulasContext.flourWeight}g &bull; Hydration: {currentFormulasContext.hydrationPct}%
          </span>
        </div>
        <span className="text-[10px] text-[#81756e] uppercase" style={FONT_MONO}>Baker's Lab</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5" style={{ backgroundColor: "#fff8f5" }}>
        {messages.map((msg) => (
          <div key={msg.id} id={`chat-msg-${msg.id}`} className={`flex gap-3 max-w-[85%] ${msg.sender === "user" ? "ml-auto flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden border ${msg.sender === "user" ? "border-[#26170c]" : "border-[#d2c4bc]"}`}
              style={{ backgroundColor: msg.sender === "user" ? "#26170c" : "white" }}>
              {msg.sender === "user"
                ? <span className="material-symbols-outlined text-[16px] text-white">person</span>
                : <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCtc_UaixfCeUfz7q-g-E2U7ue-5DUoAJ4_Awhbcne1Q9gqtchX-DNHyKA_78DKpO4MQVzsGKgAWqIHGVnBxmghnEpD09aNRan9CnB0O2nYnluwMgE1zkNst8H6xU-qC8_SUBycg-_1T8HDgSax6NRSiGl7EpBwY3DoKjZUjQsKIkUewjQi1oeNPBE_dhZFu0FWi8lAHemG3mlXcn5sTkNyau0DkPRb96uym9FSc7LCVoWkm7kRKOlTPmyPjdMMTrQxb5izdTO2LJwz" alt="Julian" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              }
            </div>
            <div className="space-y-1">
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${msg.sender === "user" ? "rounded-tr-none" : "rounded-tl-none"}`}
                style={msg.sender === "user"
                  ? { backgroundColor: "#26170c", color: "#fbddca", ...FONT_BODY }
                  : { backgroundColor: "white", color: "#1d1b1a", border: "1px solid rgba(210,196,188,0.4)", ...FONT_BODY }
                }
              >
                {msg.text}
                {msg.image && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-[#d2c4bc]/40 max-h-48 w-fit">
                    <img src={msg.image} alt="attached" className="max-h-48 max-w-full object-contain" />
                  </div>
                )}
              </div>
              <span className={`block text-[9px] text-[#81756e] uppercase ${msg.sender === "user" ? "text-right" : ""}`} style={FONT_MONO}>{msg.timestamp}</span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 items-center max-w-[80%]">
            <div className="w-8 h-8 rounded-full border border-[#d2c4bc] overflow-hidden shrink-0">
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCtc_UaixfCeUfz7q-g-E2U7ue-5DUoAJ4_Awhbcne1Q9gqtchX-DNHyKA_78DKpO4MQVzsGKgAWqIHGVnBxmghnEpD09aNRan9CnB0O2nYnluwMgE1zkNst8H6xU-qC8_SUBycg-_1T8HDgSax6NRSiGl7EpBwY3DoKjZUjQsKIkUewjQi1oeNPBE_dhZFu0FWi8lAHemG3mlXcn5sTkNyau0DkPRb96uym9FSc7LCVoWkm7kRKOlTPmyPjdMMTrQxb5izdTO2LJwz" alt="Julian" referrerPolicy="no-referrer" className="w-full h-full object-cover animate-pulse" />
            </div>
            <div className="bg-white border border-[#d2c4bc]/40 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2.5 shadow-sm">
              <span className="flex gap-1">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: "#c28b49", animationDelay: `${delay}s` }} />
                ))}
              </span>
              <span className="text-xs text-[#4f453f]" style={FONT_BODY}>Julian is diagnosing your formula...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested prompts */}
      {messages.length === 1 && (
        <div className="p-4 px-5 border-t flex flex-wrap gap-2 items-center shrink-0" style={{ backgroundColor: "#f9f2f0", borderColor: "rgba(210,196,188,0.4)" }}>
          <span className="text-[10px] font-bold text-[#81756e] uppercase tracking-widest flex items-center gap-1 mr-2" style={FONT_BODY}>
            <span className="material-symbols-outlined text-[14px]">help</span>
            Try asking:
          </span>
          {SUGGESTED_PROMPTS.map((tip, i) => (
            <button
              key={i}
              id={`preset-prompt-btn-${i}`}
              onClick={() => handleSendMessage(tip.text)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors hover:bg-[#fbddca] hover:border-[#c28b49]/40"
              style={{ backgroundColor: "white", borderColor: "rgba(210,196,188,0.6)", color: "#4f453f", ...FONT_BODY }}
            >
              <span className="material-symbols-outlined text-[14px]" style={{ color: "#c28b49" }}>{tip.icon}</span>
              {tip.text}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t bg-white shrink-0 space-y-3" style={{ borderColor: "rgba(210,196,188,0.4)" }}>
        {attachedImage && (
          <div className="relative inline-block w-16 h-16 rounded-xl overflow-hidden border border-[#d2c4bc]/40 shadow-sm group">
            <img src={attachedImage} alt="pending" className="w-full h-full object-cover" />
            <button onClick={() => setAttachedImage("")} className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-[#ba1a1a] text-white rounded-full">
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          </div>
        )}
        <div className="flex gap-2.5 items-center">
          <input id="invisible-file-picker" type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <button
            id="advisor-attachment-trigger-btn"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 flex items-center justify-center rounded-xl border transition-colors text-[#81756e] hover:bg-[#f3ecea] hover:text-[#26170c] shrink-0"
            style={{ borderColor: "rgba(210,196,188,0.6)" }}
            title="Attach photo"
          >
            <span className="material-symbols-outlined text-[20px]">photo_camera</span>
          </button>
          <input
            id="advisor-text-input"
            type="text"
            placeholder="Type values, crumb queries, or autolyse doubts..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={loading}
            className="flex-1 bg-[#f9f2f0] border border-[#d2c4bc]/60 rounded-xl px-4 py-3 text-sm text-[#1d1b1a] focus:outline-none focus:ring-2 focus:ring-[#26170c]/20"
            style={FONT_BODY}
          />
          <button
            id="advisor-send-msg-btn"
            type="button"
            onClick={() => handleSendMessage()}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50 shrink-0"
            style={{ backgroundColor: "#26170c", fontFamily: "'Hanken Grotesk', sans-serif" }}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
