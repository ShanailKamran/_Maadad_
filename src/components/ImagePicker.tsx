"use client";

import { useRef, useState } from "react";

/**
 * File input that shrinks photos in the browser (max 1280px, JPEG ~0.75) before upload, which
 * keeps uploads small on slow connections and strips EXIF/GPS metadata (canvas re-encode).
 */
export function ImagePicker({ name, max = 3, label }: { name: string; max?: number; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState("");

  async function shrink(file: File): Promise<File> {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.75));
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, max);
    try {
      const out = await Promise.all(files.map(shrink));
      const dt = new DataTransfer();
      out.forEach((f) => dt.items.add(f));
      e.target.files = dt.files;
      setInfo(out.length ? `${out.length} photo(s) ready (${Math.round(out.reduce((a, f) => a + f.size, 0) / 1024)} KB).` : "");
    } catch {
      e.target.value = "";
      setInfo("Couldn't read that photo. Try a different one.");
    }
  }

  return (
    <div className="field">
      <label htmlFor={`${name}-input`}>{label}</label>
      <input id={`${name}-input`} ref={ref} type="file" name={name} accept="image/jpeg,image/png,image/webp" multiple={max > 1} onChange={onChange} />
      <p className="hint">Up to {max} photos. They are resized on your phone and kept private.</p>
      {info && <p className="hint" role="status">{info}</p>}
    </div>
  );
}
