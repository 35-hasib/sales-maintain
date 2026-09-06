import { useEffect, useRef, useState } from "react";
import { uploadToCloudinary } from "../lib/cloudinary";
import { Spinner } from "./ui";

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  multiple?: boolean;
  max?: number;
  disabled?: boolean;
};

// Accepts photos, uploads them to Cloudinary, and keeps the list of URLs.
// Existing URLs are shown as thumbnails (click to view in a lightbox) and can
// be removed.
export default function PhotoUpload({ value, onChange, folder, multiple = true, max, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? i : (i + 1) % value.length));
      if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? i : (i - 1 + value.length) % value.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, value.length]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setBusy(true);
    try {
      const list = Array.from(files);
      if (max) list.splice(max - value.length, Math.max(0, list.length - (max - value.length)));
      const uploads: string[] = [];
      for (const f of list) {
        const url = await uploadToCloudinary(f, folder);
        uploads.push(url);
      }
      onChange([...value, ...uploads]);
    } catch (e: any) {
      setError(e?.message || "আপলোড ব্যর্থ হয়েছে");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const atLimit = max ? value.length >= max : false;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={url} className="relative group">
            <button
              type="button"
              aria-label={`ছবি ${i + 1} দেখুন`}
              onClick={() => setLightbox(i)}
              className="p-0 border-0 bg-transparent cursor-zoom-in"
            >
              <img src={url} alt={`ছবি ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-slate-200 hover:opacity-90" />
            </button>
            {!disabled && (
              <button
                type="button"
                aria-label="ছবি সরান"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white text-xs leading-none flex items-center justify-center hover:bg-rose-700"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!disabled && !atLimit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 text-xs flex items-center justify-center hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-60"
          >
            {busy ? <Spinner size={4} /> : "+ ছবি যোগ করুন"}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}

      {lightbox !== null && value[lightbox] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="বন্ধ করুন"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-3xl leading-none w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            ×
          </button>
          {value.length > 1 && (
            <button
              type="button"
              aria-label="পূর্ববর্তী"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((i) => (i! - 1 + value.length) % value.length);
              }}
              className="absolute left-2 sm:left-4 text-white text-4xl px-3 py-2 rounded-lg hover:bg-white/10"
            >
              ‹
            </button>
          )}
          <img
            src={value[lightbox]}
            alt={`ছবি ${lightbox + 1}`}
            className="max-w-[92vw] max-h-[88vh] object-contain"
          />
          {value.length > 1 && (
            <button
              type="button"
              aria-label="পরবর্তী"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((i) => (i! + 1) % value.length);
              }}
              className="absolute right-2 sm:right-4 text-white text-4xl px-3 py-2 rounded-lg hover:bg-white/10"
            >
              ›
            </button>
          )}
          {value.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
              {lightbox + 1} / {value.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
