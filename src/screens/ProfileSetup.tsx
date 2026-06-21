import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon.tsx";
import { supabase } from "../lib/supabase.ts";

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
}

interface Props {
  user: { name: string; email: string };
  onSave: (profile: UserProfile) => void;
}

export default function ProfileSetup({ user, onSave }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !address) { setError("Please fill in all fields."); return; }
    setLoading(true);
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Not authenticated."); setLoading(false); return; }
    // Check if row exists first so we never overwrite the role column
    const { data: existing } = await supabase.from("users").select("id").eq("id", session.user.id).single();
    const { error: dbErr } = existing
      ? await supabase.from("users").update({ name, phone, address }).eq("id", session.user.id)
      : await supabase.from("users").insert({ id: session.user.id, name, phone, address });
    if (dbErr) { setError(dbErr.message); setLoading(false); return; }
    setLoading(false);
    onSave({ name, email: user.email, phone, address });
  };

  return (
    <div className="min-h-screen bg-[#fff8f5] flex flex-col" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <header className="px-6 h-16 flex items-center border-b border-[#26170c]/10">
        <span className="font-bold text-[#26170c] text-lg" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>Avelina's</span>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[#26170c] flex items-center justify-center mx-auto mb-4">
              <Icon name="account_circle" size={32} className="text-[#fff8f5]" />
            </div>
            <h1 className="font-bold text-[#26170c] mb-1" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 26 }}>
              Almost there!
            </h1>
            <p className="text-sm text-[#26170c]/60">We just need a few details. You only do this once.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#26170c]/60 uppercase tracking-wider mb-1.5">Full Name</label>
              <input
                className="w-full h-12 px-4 rounded-xl border border-[#26170c]/15 bg-white text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#26170c]/60 uppercase tracking-wider mb-1.5">Phone Number</label>
              <input
                type="tel"
                className="w-full h-12 px-4 rounded-xl border border-[#26170c]/15 bg-white text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40"
                placeholder="+63 912 345 6789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#26170c]/60 uppercase tracking-wider mb-1.5">Address</label>
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-[#26170c]/15 bg-white text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40 resize-none"
                rows={3}
                placeholder="Your pickup / delivery address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              className="w-full h-12 rounded-xl bg-[#26170c] text-white text-sm font-bold hover:opacity-90 transition-all"
            >
              {loading ? "Saving…" : "Save & Continue →"}
            </button>
            <button type="button" onClick={() => navigate("/")} className="w-full text-xs text-[#26170c]/40 hover:text-[#26170c]/60 transition-colors">
              Skip for now
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
