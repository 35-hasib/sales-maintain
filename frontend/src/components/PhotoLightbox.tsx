import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  imageClassName?: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const DOUBLE_TAP_DELAY = 300;

// Full-screen lightbox with navigation plus scroll/pinch zoom and drag pan.
// Works on both mouse (wheel + drag) and touch (pinch + drag + double tap).
export default function PhotoLightbox({ images, index, onClose, onIndexChange, imageClassName = "" }: Props) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchState = useRef<{ dist: number; scale: number; offset: { x: number; y: number }; cx: number; cy: number } | null>(null);
  const lastTap = useRef(0);
  const zoomed = scale > 1;

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    reset();
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [index, reset]);

  useEffect(() => {
    if (!zoomed) {
      setOffset({ x: 0, y: 0 });
    }
  }, [zoomed]);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange((index + 1) % images.length);
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
      if (e.key === "+" || e.key === "=") zoomInAtCenter();
      if (e.key === "-") zoomOutAtCenter();
      if (e.key === "0") reset();
    },
    [onClose, onIndexChange, index, images.length, reset]
  );

  function zoomInAtCenter() {
    setScale((s) => Math.min(MAX_SCALE, s * 1.5));
    setOffset({ x: 0, y: 0 });
  }
  function zoomOutAtCenter() {
    setScale((s) => {
      const ns = Math.max(MIN_SCALE, s / 1.5);
      if (ns === 1) setOffset((o) => (o.x === 0 && o.y === 0 ? o : { x: 0, y: 0 }));
      return ns;
    });
  }

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  // Wheel zoom, anchored at the cursor.
  function handleWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && images.length > 0) {
      // treat wheel as zoom
    }
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const delta = e.deltaY < 0 ? 1.25 : 0.8;
    setScale((s) => {
      const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * delta));
      if (ns === s) return s;
      // Adjust pan so the point under cursor stays fixed.
      const k = ns / s;
      setOffset((o) => ({
        x: px - (px - o.x) * k,
        y: py - (py - o.y) * k,
      }));
      return ns;
    });
  }

  function dist(p: { x: number; y: number }[]) {
    const [a, b] = p;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const p = Array.from(pointers.current.values());
      pinchState.current = {
        dist: dist(p),
        scale,
        offset: { ...offset },
        cx: (p[0].x + p[1].x) / 2,
        cy: (p[0].y + p[1].y) / 2,
      };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;

    if (pointers.current.size === 1) {
      const start = pointers.current.get(e.pointerId)!;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (zoomed) {
        setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
      }
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }

    if (pointers.current.size === 2 && pinchState.current) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = Array.from(pointers.current.values());
      const pd = dist(p);
      const ps = pinchState.current;
      const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, ps.scale * (pd / ps.dist)));
      const curCx = (p[0].x + p[1].x) / 2;
      const curCy = (p[0].y + p[1].y) / 2;
      const k = ns / ps.scale;
      setScale(ns);
      setOffset({
        x: curCx - (curCx * k - ps.offset.x * k + (ps.cx - curCx)),
        y: curCy - (curCy * k - ps.offset.y * k + (ps.cy - curCy)),
      });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchState.current = null;

    const now = Date.now();
    if (pointers.current.size === 0) {
      // Double tap / double click toggles zoom.
      if (now - lastTap.current < DOUBLE_TAP_DELAY) {
        if (scale > 1) {
          reset();
        } else {
          setScale(2);
          setOffset({ x: 0, y: 0 });
        }
      }
      lastTap.current = now;
    }
  }

  const zoomRatio = Math.round(scale * 100);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center overflow-hidden" style={{ touchAction: "none" }}>
      <div
        className="absolute inset-0 flex items-center justify-center cursor-default"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={handleWheel}
      >
        <img
          src={images[index]}
          alt={`ছবি ${index + 1}`}
          className={`max-w-[92vw] max-h-[88vh] object-contain select-none ${imageClassName}`}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: pointers.current.size === 0 ? "transform 0.08s ease-out" : "none",
            cursor: zoomed ? "grab" : "zoom-in",
          }}
          draggable={false}
        />
      </div>

      {/* Close */}
      <button
        type="button"
        aria-label="বন্ধ করুন"
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-3xl leading-none w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 z-10"
      >
        ×
      </button>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-1 text-white z-10">
        <button type="button" aria-label="ছোট করুন" onClick={zoomOutAtCenter} className="w-9 h-9 text-xl rounded-full hover:bg-white/10">−</button>
        <button type="button" aria-label="জুম রিসেট করুন" onClick={reset} className="px-2 text-xs tabular-nums hover:bg-white/10 rounded-full h-9 min-w-[52px]">{zoomRatio}%</button>
        <button type="button" aria-label="বড় করুন" onClick={zoomInAtCenter} className="w-9 h-9 text-xl rounded-full hover:bg-white/10">+</button>
      </div>

      {/* Prev / Next */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="পূর্ববর্তী"
            onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white text-4xl px-3 py-2 rounded-lg hover:bg-white/10 z-10"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="পরবর্তী"
            onClick={() => onIndexChange((index + 1) % images.length)}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white text-4xl px-3 py-2 rounded-lg hover:bg-white/10 z-10"
          >
            ›
          </button>
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-white/80 text-sm z-10">
            {index + 1} / {images.length}
          </div>
        </>
      )}

      <div className="absolute top-4 left-4 text-white/60 text-xs z-10 select-none">
        {zoomed ? "টেনে সরান · স্ক্রল/পিঞ্চ করে জুম করুন" : "স্ক্রল/পিঞ্চ করে জুম করুন · ডাবল ট্যাপ করে জুম করুন"}
      </div>
    </div>
  );
}
