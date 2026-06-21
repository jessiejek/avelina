import { createClient } from "@supabase/supabase-js";

const url  = import.meta.env.VITE_SUPABASE_URL  as string;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
}

export const supabase = createClient(url, key);

const MAX_IMG_BYTES = 3 * 1024 * 1024; // 3 MB

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "File must be an image.";
  return null;
}

async function compressToLimit(file: File): Promise<Blob> {
  if (file.size <= MAX_IMG_BYTES) return file;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      // Scale down dimensions proportionally if very large
      let { width, height } = img;
      const MAX_DIM = 2048;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      // Binary search for the right quality
      let lo = 0.1, hi = 0.92, best: Blob | null = null;
      const tryQuality = (q: number) =>
        new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", q));
      (async () => {
        for (let i = 0; i < 8; i++) {
          const mid = (lo + hi) / 2;
          const blob = await tryQuality(mid);
          if (blob.size <= MAX_IMG_BYTES) { best = blob; lo = mid; }
          else hi = mid;
        }
        resolve(best ?? await tryQuality(0.1));
      })();
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function uploadImage(bucket: string, file: File): Promise<string> {
  const validErr = validateImageFile(file);
  if (validErr) throw new Error(validErr);
  const blob = await compressToLimit(file);
  const ext = blob.type === "image/jpeg" ? "jpg" : file.name.split(".").pop() ?? "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { upsert: false, contentType: blob.type });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
