import { useEffect, useState } from "react";

const cache = new Map<string, string>();

/**
 * Samples the average color of an image's border pixels so a letterboxed
 * (object-contain) image can sit on a background that blends with its edges.
 * Falls back to a warm cream if the image can't be read (CORS, load error).
 */
export function useEdgeColor(src: string | undefined, fallback = "#f4ece5"): string {
  const [color, setColor] = useState<string>(() => (src && cache.get(src)) || fallback);

  useEffect(() => {
    if (!src) { setColor(fallback); return; }
    const cached = cache.get(src);
    if (cached) { setColor(cached); return; }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const w = 32, h = 32;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);

        let r = 0, g = 0, b = 0, n = 0;
        const add = (x: number, y: number) => {
          const i = (y * w + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        };
        for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
        for (let y = 0; y < h; y++) { add(0, y); add(w - 1, y); }

        const c = `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
        cache.set(src, c);
        if (!cancelled) setColor(c);
      } catch {
        if (!cancelled) setColor(fallback);
      }
    };
    img.onerror = () => { if (!cancelled) setColor(fallback); };
    img.src = src;

    return () => { cancelled = true; };
  }, [src, fallback]);

  return color;
}
