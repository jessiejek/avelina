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
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  const locateMe = () => {
    if (!navigator.geolocation) { setLocateError("Geolocation not supported by your browser."); return; }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const { road, house_number, suburb, city, town, municipality, province, state, country } = data.address || {};
          const parts = [
            house_number && road ? `${house_number} ${road}` : road,
            suburb,
            city || town || municipality,
            province || state,
            country,
          ].filter(Boolean);
          setAddress(parts.join(", "));
        } catch {
          setLocateError("Could not fetch address. Paste coordinates manually.");
        }
        setLocating(false);
      },
      (err) => {
        setLocateError(err.code === 1 ? "Location access denied. Please allow it in your browser." : "Could not get location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#26170c]/60 uppercase tracking-wider">Address</label>
                <button
                  type="button"
                  onClick={locateMe}
                  disabled={locating}
                  className="flex items-center gap-1 text-xs font-semibold text-[#26170c] bg-[#26170c]/8 hover:bg-[#26170c]/15 px-3 py-1 rounded-full transition-all disabled:opacity-50"
                >
                  <Icon name={locating ? "progress_activity" : "my_location"} size={13} />
                  {locating ? "Locating…" : "Locate Me"}
                </button>
              </div>
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-[#26170c]/15 bg-white text-sm text-[#26170c] focus:outline-none focus:border-[#26170c]/40 resize-none"
                rows={3}
                placeholder="Your pickup / delivery address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              {locateError && <p className="text-xs text-red-500 mt-1">{locateError}</p>}
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
