import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";

interface Props {
  onLogin: (user: { name: string; email: string }) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "email">("choose");
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in all fields."); return; }
    if (isRegister && !name) { setError("Please enter your name."); return; }
    setLoading(true);
    setError("");
    try {
      if (isRegister) {
        const { error: err } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
        if (err) throw err;
        onLogin({ name: name || email.split("@")[0], email });
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onLogin({ name: data.user?.user_metadata?.name || email.split("@")[0], email });
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "facebook") => {
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (err) { setError(err.message); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#fff8f5] flex flex-col" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      {/* Nav */}
      <header className="px-6 h-16 flex items-center justify-between border-b border-[#26170c]/10">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#26170c] font-bold text-lg" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
          <Icon name="arrow_back" size={18} /> Avelina's
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="font-bold text-[#26170c] mb-2" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 28 }}>
              {mode === "email" ? (isRegister ? "Create account" : "Sign in") : "Welcome"}
            </h1>
            <p className="text-sm text-[#26170c]/60">
              {mode === "email" ? "Use your email to continue" : "Sign in to place your pre-order"}
            </p>
          </div>

          {mode === "choose" && (
            <div className="space-y-3">
              <button
                onClick={() => setMode("email")}
                className="w-full h-12 rounded-xl bg-[#26170c] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              >
                <Icon name="mail" size={16} /> Continue with Email
              </button>
              <button
                onClick={() => handleSocialLogin("google")}
                disabled={loading}
                className="w-full h-12 rounded-xl border border-[#26170c]/15 text-[#26170c] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white transition-all disabled:opacity-50"
              >
                <Icon name="g_translate" size={16} /> {loading ? "Redirecting…" : "Continue with Google"}
              </button>
              <button
                onClick={() => handleSocialLogin("facebook")}
                disabled={loading}
                className="w-full h-12 rounded-xl border border-[#26170c]/15 text-[#26170c] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white transition-all disabled:opacity-50"
              >
                <Icon name="facebook" size={16} /> Continue with Facebook
              </button>
            </div>
          )}

          {mode === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-[#26170c]/60 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    className="w-full h-12 px-4 rounded-xl border border-[#26170c]/15 bg-white text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40"
                    placeholder="Avelina Santos"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#26170c]/60 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  className="w-full h-12 px-4 rounded-xl border border-[#26170c]/15 bg-white text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#26170c]/60 uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  className="w-full h-12 px-4 rounded-xl border border-[#26170c]/15 bg-white text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-[#26170c] text-white text-sm font-bold hover:opacity-90 transition-all mt-2"
              >
                {loading ? "Please wait…" : isRegister ? "Create Account" : "Sign In"}
              </button>
              <p className="text-center text-xs text-[#26170c]/50 pt-1">
                {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                <button type="button" onClick={() => setIsRegister(!isRegister)} className="font-semibold text-[#26170c] underline">
                  {isRegister ? "Sign in" : "Sign up"}
                </button>
              </p>
              <button type="button" onClick={() => setMode("choose")} className="w-full text-xs text-[#26170c]/40 hover:text-[#26170c]/60 transition-colors pt-1">
                ← Other sign in options
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
