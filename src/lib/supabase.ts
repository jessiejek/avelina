import { createClient } from "@supabase/supabase-js";

const url  = import.meta.env.VITE_SUPABASE_URL  as string;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
}

export const supabase = createClient(url, key);

const MAX_IMG_BYTES = 3 * 1024 * 1024; // 3 MB

export function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMG_BYTES) return "Image must be under 3 MB.";
  if (!file.type.startsWith("image/")) return "File must be an image.";
  return null;
}

export async function uploadImage(bucket: string, file: File): Promise<string> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
