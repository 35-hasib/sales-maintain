import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold text-slate-500 mb-1 uppercase tracking-wide">{children}</h2>;
}

export function Stat({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?: () => void }) {
  const styles = onClick
    ? "cursor-pointer hover:border-emerald-400 hover:shadow-md transition"
    : "";
  return (
    <Card className={styles}>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`w-full text-left ${onClick ? "" : "cursor-default"}`}
      >
        <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
          <span>{label}</span>
          {onClick && <span className="text-emerald-500 text-[10px] font-semibold uppercase tracking-wide">বিস্তারিত ↓</span>}
        </div>
        <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      </button>
    </Card>
  );
}

const statusColors: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  partially_collected: "bg-amber-100 text-amber-800",
  fully_collected: "bg-blue-100 text-blue-800",
  partially_disbursed: "bg-indigo-100 text-indigo-800",
  settled: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "বাকি",
    partially_collected: "আংশিক আদায়",
    fully_collected: "সম্পূর্ণ আদায়",
    partially_disbursed: "আংশিক পরিশোধ",
    settled: "সম্পন্ন",
    cancelled: "বাতিল",
  };
  const label = labels[status] ?? status;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || "bg-slate-100 text-slate-700"}`}>
      {label}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3">{children}</div>;
}

export function ErrorText({ message }: { message: string }) {
  if (!message) return null;
  return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{message}</div>;
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 mt-2">
      <span className="text-xs text-slate-500">
        মোট {total}টি · {page} / {totalPages}
      </span>
      <div className="flex gap-1">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          পূর্ববর্তী
        </Button>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          পরবর্তী
        </Button>
      </div>
    </div>
  );
}
