import React from "react";
import { useEdgeColor } from "../lib/useEdgeColor.ts";

interface Props {
  src: string;
  alt: string;
  /** CSS aspect-ratio for the frame, e.g. "1/1" (default), "4/3" */
  aspectRatio?: string;
  /** extra classes on the wrapper */
  className?: string;
  /** extra classes on the <img> */
  imgClassName?: string;
  /** overlays (badges, etc.) rendered inside the frame */
  children?: React.ReactNode;
}

/**
 * Shows the whole image (object-contain) inside a fixed-ratio frame whose
 * background is sampled from the image's own edge pixels, so the letterbox
 * gaps blend into the photo instead of showing a hard bar.
 */
export default function EdgeFillImage({
  src,
  alt,
  aspectRatio = "1/1",
  className = "",
  imgClassName = "",
  children,
}: Props) {
  const bg = useEdgeColor(src);
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio, backgroundColor: bg }}>
      <img src={src} alt={alt} className={`relative w-full h-full object-contain ${imgClassName}`} />
      {children}
    </div>
  );
}
