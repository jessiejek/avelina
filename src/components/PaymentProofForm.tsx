import React, { useEffect, useState } from "react";
import Icon from "./Icon.tsx";
import { peso } from "../lib/money.ts";
import { GCASH_NAME, GCASH_NUMBER, submitPaymentProof, uploadPaymentProof } from "../lib/payment.ts";

/** "Banner" shown on checkout announcing the 50% GCash down payment. */
export function DownPaymentBanner({ compact }: { compact?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#26170c]/10 bg-gradient-to-br from-[#fff1e3] to-[#f6e2cf] p-4 pl-5 flex gap-3 items-start shadow-sm">
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#007dfe]" />
      <div className="shrink-0 w-10 h-10 rounded-full bg-[#007dfe] text-white flex items-center justify-center shadow">
        <Icon name="wallet" size={18} strokeWidth={2.25} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#007dfe]">GCash · 50% down</p>
        <p className={`font-bold text-[#26170c] leading-snug ${compact ? "text-sm" : "text-base"}`} style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
          A 50% down payment secures your order
        </p>
        <p className="text-xs text-[#26170c]/65 mt-0.5 leading-relaxed">Pay half via GCash after booking — settle the rest on pickup or delivery.</p>
      </div>
    </div>
  );
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] text-[#26170c]/50">{label}</p>
        <p className={`font-bold text-[#26170c] ${mono ? "font-mono text-lg" : ""}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          try { await navigator.clipboard.writeText(value.replace(/\s/g, mono ? "" : " ")); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
        }}
        className="shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-[#26170c]/15 text-xs font-semibold text-[#26170c] hover:bg-[#26170c]/5"
      >
        <Icon name={copied ? "check" : "content_copy"} size={13} /> {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

interface Props {
  userId: string;
  orderIds: string[];
  amount: number;
  balance?: number;
  /** Rejection reason from the bakery, if re-uploading. */
  note?: string | null;
  onSubmitted: () => void;
  onLater: () => void;
  laterLabel?: string;
}

/** GCash details + screenshot upload + reference → submit_payment_proof(). */
export default function PaymentProofForm({ userId, orderIds, amount, balance, note, onSubmitted, onLater, laterLabel = "I'll pay later" }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const submit = async () => {
    if (!file) { setError("Please attach your GCash screenshot."); return; }
    setBusy(true);
    setError("");
    try {
      const path = await uploadPaymentProof(userId, file);
      await submitPaymentProof(orderIds, path, ref);
      onSubmitted();
    } catch (e: any) {
      setError(e?.message || "Upload failed, please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {note && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800">
          <p className="font-bold">The bakery couldn't verify your last proof</p>
          <p className="mt-0.5">{note}</p>
        </div>
      )}
      <div className="bg-[#fff8f5] rounded-2xl border border-[#26170c]/8 p-4 text-center">
        <p className="text-xs uppercase tracking-wider text-[#26170c]/50 font-semibold">Send exactly</p>
        <p className="font-bold text-[#26170c] font-mono text-4xl my-1">{peso(amount)}</p>
        <p className="text-xs text-[#26170c]/55">
          50% down payment{orderIds.length > 1 ? ` for ${orderIds.length} orders` : ""}
          {balance != null ? ` · balance ${peso(balance)} on pickup/delivery` : ""}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#26170c]/8 p-4 space-y-3">
        <p className="text-xs font-bold text-[#0057b8] flex items-center gap-1.5"><Icon name="wallet" size={14} /> GCash</p>
        <CopyRow label="Number" value={GCASH_NUMBER} mono />
        <CopyRow label="Account name" value={GCASH_NAME} />
      </div>

      <div className="bg-white rounded-2xl border border-[#26170c]/8 p-4 space-y-3">
        <p className="text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider">Proof of payment</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (!f.type.startsWith("image/")) { setError("Please choose an image."); return; }
            setFile(f);
            setPreview(URL.createObjectURL(f));
            setError("");
          }}
        />
        {preview ? (
          <div className="flex gap-3 items-center">
            <img src={preview} alt="GCash screenshot" className="w-20 h-28 rounded-lg object-cover border border-[#26170c]/10" />
            <div className="text-xs space-y-2 min-w-0">
              <p className="font-semibold text-[#26170c] truncate">{file?.name}</p>
              <button type="button" onClick={() => inputRef.current?.click()} className="px-3 py-1.5 rounded-lg border border-[#26170c]/20 font-semibold text-[#26170c]">
                Change screenshot
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full h-24 rounded-xl border-2 border-dashed border-[#26170c]/20 text-sm font-semibold text-[#26170c]/70 flex flex-col items-center justify-center gap-1 hover:border-[#26170c]/40"
          >
            <Icon name="upload" size={20} /> Upload GCash screenshot
          </button>
        )}
        <div>
          <label className="block text-xs font-semibold text-[#26170c]/50 uppercase tracking-wider mb-1.5">GCash reference no.</label>
          <input
            className="w-full h-12 px-4 rounded-xl border border-[#26170c]/15 bg-[#fff8f5] text-sm text-[#26170c] font-mono focus:outline-none focus:border-[#26170c]/40"
            placeholder="e.g. 1029 384 756"
            inputMode="numeric"
            value={ref}
            maxLength={64}
            onChange={(e) => setRef(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="w-full py-4 rounded-xl bg-[#26170c] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
      >
        {busy ? "Uploading…" : "Submit proof"}
      </button>
      <button type="button" onClick={onLater} disabled={busy} className="w-full py-2 text-sm font-semibold text-[#26170c]/60">
        {laterLabel}
      </button>
      <p className="text-[11px] text-center text-[#26170c]/45">Your order is booked either way. The bakery confirms once the down payment is verified.</p>
    </div>
  );
}
