import { supabase, compressToLimit, validateImageFile } from "./supabase.ts";

// GCash account that receives the 50% down payment.
export const GCASH_NUMBER = "0976 065 5395";
export const GCASH_NAME = "Joenoel A Berro";
export const PROOF_BUCKET = "payment-proofs";

export type PaymentStatus = "unpaid" | "submitted" | "verified" | "rejected";

/** 50% down payment, rounded UP to the peso (₱281 → ₱141). Mirrors the DB trigger. */
export const downPayment = (total: number) => Math.ceil((Number(total) || 0) / 2);

export const paymentLabel = (s: PaymentStatus) =>
  s === "verified" ? "Verified" : s === "submitted" ? "Proof sent" : s === "rejected" ? "Rejected" : "Unpaid";

/** Compress + upload a GCash screenshot into payment-proofs/<uid>/…; returns the storage path. */
export async function uploadPaymentProof(userId: string, file: File): Promise<string> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const blob = await compressToLimit(file);
  const ext = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, blob, { upsert: false, contentType: blob.type || file.type });
  if (error) throw error;
  return path;
}

export async function submitPaymentProof(orderIds: string[], path: string, ref: string) {
  const { error } = await supabase.rpc("submit_payment_proof", {
    p_order_ids: orderIds,
    p_path: path,
    p_ref: ref.trim() || null,
  });
  if (error) throw error;
}

/** Short-lived link for admins to view a private proof. */
export async function proofUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(path, 300);
  return error ? null : data?.signedUrl ?? null;
}
