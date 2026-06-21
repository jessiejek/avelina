import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";

interface Props {
  onLogin: (user: { name: string; email: string }) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    if (tab === "register") {
      if (!name.trim()) { setError("Please enter your full name."); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
      if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    }
    setLoading(true);
    try {
      if (tab === "register") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() } },
        });
        if (err) throw err;
        // If email confirmation is on, user won't have a session yet
        if (data.session) {
          onLogin({ name: name.trim(), email });
        } else {
          setSuccess("Account created! Check your email to confirm, then sign in.");
          setTab("signin");
          setPassword("");
          setConfirmPassword("");
        }
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

  const switchTab = (t: "signin" | "register") => {
    setTab(t);
    setError("");
    setSuccess("");
  };

  return (
    <div className="min-h-screen bg-[#fff8f5] flex flex-col" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <header className="px-6 h-16 flex items-center border-b border-[#26170c]/10">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#26170c] font-bold text-lg" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
          <Icon name="arrow_back" size={18} /> Avelina's
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Logo / title */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#26170c] flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-xl" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>A</span>
            </div>
            <h1 className="font-bold text-[#26170c]" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 26 }}>
              {tab === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-[#26170c]/50 mt-1">
              {tab === "signin" ? "Sign in to place your pre-order" : "Join to start ordering from Avelina's"}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-[#26170c]/6 rounded-xl p-1 mb-6">
            <button
              onClick={() => switchTab("signin")}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-all ${tab === "signin" ? "bg-white text-[#26170c] shadow-sm" : "text-[#26170c]/50 hover:text-[#26170c]"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchTab("register")}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-all ${tab === "register" ? "bg-white text-[#26170c] shadow-sm" : "text-[#26170c]/50 hover:text-[#26170c]"}`}
            >
              Register
            </button>
          </div>

          {/* Social login */}
          <div className="space-y-2.5 mb-5">
            <button
              onClick={() => handleSocialLogin("google")}
              disabled={loading}
              className="w-full h-11 rounded-xl border border-[#26170c]/15 bg-white text-[#26170c] text-sm font-semibold flex items-center justify-center gap-2.5 hover:border-[#26170c]/30 transition-all disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {loading ? "Redirecting…" : `${tab === "register" ? "Sign up" : "Sign in"} with Google`}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[#26170c]/10" />
            <span className="text-xs text-[#26170c]/40 font-medium">or with email</span>
            <div className="flex-1 h-px bg-[#26170c]/10" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {tab === "register" && (
              <div>
                <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  autoFocus
                  className="w-full h-11 px-4 rounded-xl border border-[#26170c]/15 bg-white text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40 transition-colors"
                  placeholder="e.g. Maria Santos"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">Email</label>
              <input
                type="email"
                autoFocus={tab === "signin"}
                className="w-full h-11 px-4 rounded-xl border border-[#26170c]/15 bg-white text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40 transition-colors"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password"
                className="w-full h-11 px-4 rounded-xl border border-[#26170c]/15 bg-white text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40 transition-colors"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {tab === "register" && (
              <div>
                <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  className="w-full h-11 px-4 rounded-xl border border-[#26170c]/15 bg-white text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40 transition-colors"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <Icon name="error" size={13} /> {error}
              </p>
            )}
            {success && (
              <p className="text-xs text-green-600 flex items-center gap-1.5 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                <Icon name="check_circle" size={13} /> {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-[#26170c] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-1"
            >
              {loading ? "Please wait…" : tab === "register" ? "Create Account" : "Sign In"}
            </button>
          </form>

          {tab === "signin" && (
            <p className="text-center text-xs text-[#26170c]/40 mt-4">
              New here?{" "}
              <button onClick={() => switchTab("register")} className="font-semibold text-[#26170c] underline">
                Create an account
              </button>
            </p>
          )}
          {tab === "register" && (
            <p className="text-center text-xs text-[#26170c]/40 mt-4">
              Already have an account?{" "}
              <button onClick={() => switchTab("signin")} className="font-semibold text-[#26170c] underline">
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
