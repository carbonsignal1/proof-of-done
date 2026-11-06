"use client";
import { useEffect, useState } from "react";

/** Shrink a photo in the browser before upload (max 1280px, JPEG). */
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85));
  } catch {
    return file; // fall back to the original (e.g. HEIC the browser can't decode)
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoInput({ label, onChange }: { label: string; onChange: (blob: Blob | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <label className="drop">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const blob = await shrink(f);
          setPreview(URL.createObjectURL(blob));
          onChange(blob);
        }}
      />
      {preview ? <img src={preview} alt="Selected photo" /> : <span style={{ fontSize: 26 }}>📷</span>}
      <span>{preview ? "Tap to retake" : label}</span>
    </label>
  );
}
