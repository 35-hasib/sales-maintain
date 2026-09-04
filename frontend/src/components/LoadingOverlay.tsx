import { useEffect, useState } from "react";
import { subscribeLoading } from "../lib/api";

export default function LoadingOverlay() {
  const [pending, setPending] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeLoading(setPending), []);

  const show = pending > 0;

  useEffect(() => {
    let timer: number | undefined;
    if (show) {
      timer = window.setTimeout(() => setVisible(true), 150);
    } else {
      setVisible(false);
    }
    return () => clearTimeout(timer);
  }, [show]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm"
      aria-live="polite"
      role="status"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-xl">
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <span className="text-sm font-medium text-slate-600">লোড হচ্ছে…</span>
      </div>
    </div>
  );
}