import { useEffect, useState } from "react";
import { thumbUrl } from "../lib/cloudinary";

// Display-only thumbnail gallery (no upload). Clicking a thumbnail opens a
// full-size lightbox with prev/next navigation across the gallery's photos.
export default function PhotoGallery({ photos, large }: { photos?: string[]; large?: boolean }) {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowRight") setActive((i) => (i === null ? i : (i + 1) % photos!.length));
      if (e.key === "ArrowLeft") setActive((i) => (i === null ? i : (i - 1 + photos!.length) % photos!.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, photos]);

  if (!photos || photos.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setActive(i)}
            className="p-0 border-0 bg-transparent cursor-zoom-in"
          >
            <img
              src={thumbUrl(url, large ? 192 : 128)}
              alt={`ছবি ${i + 1}`}
              className={`${large ? "w-24 h-24" : "w-16 h-16"} object-cover rounded-lg border border-slate-200 hover:opacity-90`}
            />
          </button>
        ))}
      </div>

      {active !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            aria-label="বন্ধ করুন"
            onClick={() => setActive(null)}
            className="absolute top-4 right-4 text-white text-3xl leading-none w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            ×
          </button>
          {photos.length > 1 && (
            <button
              type="button"
              aria-label="পূর্ববর্তী"
              onClick={(e) => {
                e.stopPropagation();
                setActive((i) => (i! - 1 + photos.length) % photos.length);
              }}
              className="absolute left-2 sm:left-4 text-white text-4xl px-3 py-2 rounded-lg hover:bg-white/10"
            >
              ‹
            </button>
          )}
          <button
            type="button"
              aria-label="জুম করুন"
            onClick={(e) => e.stopPropagation()}
            className="block"
          >
            <img
              src={photos[active]}
              alt={`ছবি ${active + 1}`}
              className="max-w-[92vw] max-h-[88vh] object-contain"
            />
          </button>
          {photos.length > 1 && (
            <button
              type="button"
              aria-label="পরবর্তী"
              onClick={(e) => {
                e.stopPropagation();
                setActive((i) => (i! + 1) % photos.length);
              }}
              className="absolute right-2 sm:right-4 text-white text-4xl px-3 py-2 rounded-lg hover:bg-white/10"
            >
              ›
            </button>
          )}
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
              {active + 1} / {photos.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
