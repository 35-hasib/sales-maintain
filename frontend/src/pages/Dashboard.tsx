import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatTaka, formatDate } from "../lib/format";
import type { Summary, LedgerEntry } from "../lib/types";
import { Card, CardTitle, Stat, StatusBadge, Button, ErrorText, Spinner } from "../components/ui";

type DashboardData = {
  floatHeld: string;
  totalDueFromBuyers: string;
  totalDueToSellers: string;
  totalTransactions: number;
  recentActivity: LedgerEntry[];
  unsettledTransactions: Summary[];
};

type BreakdownType = "held" | "buyers" | "sellers";

type BreakdownRow = {
  transaction_id: string;
  product_description: string | null;
  transaction_date: string;
  status: string;
  seller_name?: string | null;
  buyer_name?: string | null;
  dealer_id: string | null;
  dealer_name: string | null;
  amount: string;
};

const BREAKDOWN_META: Record<BreakdownType, { label: string; dealerLabel: string }> = {
  held: { label: "হাতে থাকা টাকা (আদায়কৃত)", dealerLabel: "আদায়কৃত (ক্রেতা থেকে)" },
  buyers: { label: "ক্রেতার নিকট প্রাপ্য", dealerLabel: "ক্রেতা" },
  sellers: { label: "বিক্রেতাকে প্রদেয়", dealerLabel: "বিক্রেতা" },
};

const ENTRY_LABEL: Record<string, string> = {
  collection: "আদায়",
  disbursement: "পরিশোধ",
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [breakdown, setBreakdown] = useState<{ type: BreakdownType; rows: BreakdownRow[]; loading: boolean; error: string } | null>(null);

  useEffect(() => {
    api.get<DashboardData>("/api/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  async function openBreakdown(type: BreakdownType) {
    setBreakdown({ type, rows: [], loading: true, error: "" });
    try {
      const body = await api.get<{ breakdown: BreakdownRow[] }>(`/api/dashboard/breakdown?type=${type}`);
      setBreakdown({ type, rows: body.breakdown, loading: false, error: "" });
    } catch (e: any) {
      setBreakdown({ type, rows: [], loading: false, error: e?.message || "লোড করা যায়নি" });
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <div className="flex justify-center py-10"><Spinner size={6} /></div>;

  const totalBreakdown = breakdown ? breakdown.rows.reduce((sum, r) => sum + Number(r.amount), 0) : 0;

  const groupedByDealer = new Map<string | null, { name: string; rows: BreakdownRow[]; total: number }>();
  for (const r of breakdown?.rows ?? []) {
    if (!groupedByDealer.has(r.dealer_id)) groupedByDealer.set(r.dealer_id, { name: r.dealer_name || "—", rows: [], total: 0 });
    const g = groupedByDealer.get(r.dealer_id)!;
    g.rows.push(r);
    g.total += Number(r.amount);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">হোম</h1>
        <Link to="/transactions/new">
          <Button>নতুন লেনদেন</Button>
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="হাতে আছে" value={formatTaka(data.floatHeld)} onClick={() => openBreakdown("held")} />
        <Stat label="পাওয়া যাবে" value={formatTaka(data.totalDueFromBuyers)} onClick={() => openBreakdown("buyers")} />
        <Stat label="দিতে হবে" value={formatTaka(data.totalDueToSellers)} onClick={() => openBreakdown("sellers")} />
      </div>

      {/* Open transactions */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>বাকি লেনদেন</CardTitle>
          <span className="text-xs text-slate-400">মোট {data.totalTransactions}টি</span>
        </div>
        {data.unsettledTransactions.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">কোনো বাকি লেনদেন নেই।</p>
        ) : (
          <ul className="divide-y divide-slate-100 mt-2">
            {data.unsettledTransactions.map((t) => (
              <li key={t.id}>
                <Link to={`/transactions/${t.id}`} className="flex items-center justify-between py-2 hover:bg-slate-50 -mx-2 px-2 rounded">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {t.product_description || "লেনদেন"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t.seller_name} → {t.buyer_name} · {formatDate(t.transaction_date)}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-sm font-semibold">{formatTaka(t.amount_due_to_seller)}</div>
                    <StatusBadge status={t.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Recent activity */}
      <Card>
        <CardTitle>সাম্প্রতিক কার্যক্রম</CardTitle>
        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">এখনো কোনো কার্যক্রম নেই।</p>
        ) : (
          <ul className="divide-y divide-slate-100 mt-2">
            {data.recentActivity.map((e) => (
              <li key={e.id} className="py-2">
                <Link to={`/transactions/${e.transaction_id}`} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                    e.entry_type === "collection" ? "bg-emerald-100" : e.entry_type === "disbursement" ? "bg-rose-100" : "bg-slate-200"
                  }`}>
                    {e.entry_type === "collection" ? "↓" : e.entry_type === "disbursement" ? "↑" : "↩"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {ENTRY_LABEL[e.entry_type] ?? e.entry_type}
                      <span className="text-slate-500 font-normal"> · {e.dealer_name || "—"}</span>
                    </div>
                    <div className="text-xs text-slate-400">{formatDate(e.occurred_at)}</div>
                  </div>
                  <div className={`text-sm font-semibold shrink-0 ${
                    e.entry_type === "collection" ? "text-emerald-600" : e.entry_type === "disbursement" ? "text-rose-600" : "text-slate-500"
                  }`}>
                    {e.amount.startsWith("-") ? "−" : "+"}{formatTaka(e.amount.replace(/^-/, ""))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Breakdown modal */}
      {breakdown && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40" onClick={() => setBreakdown(null)}>
          <div
            className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="text-lg font-bold">{BREAKDOWN_META[breakdown.type].label}</h2>
                <p className="text-xs text-slate-500">
                  {breakdown.type === "held"
                    ? `মোট জমা: ${formatTaka(totalBreakdown)} · ${groupedByDealer.size} জন ব্যবসায়ীর কাছ থেকে`
                    : breakdown.type === "buyers"
                      ? `ক্রেতাদের নিকট মোট প্রাপ্য: ${formatTaka(totalBreakdown)}`
                      : `বিক্রেতাদের মোট প্রদেয়: ${formatTaka(totalBreakdown)}`}
                </p>
              </div>
              <button type="button" aria-label="বন্ধ করুন" onClick={() => setBreakdown(null)} className="text-slate-500 text-2xl leading-none hover:text-slate-800">×</button>
            </div>

            {breakdown.loading ? (
              <div className="flex justify-center py-6"><Spinner size={5} /></div>
            ) : breakdown.error ? (
              <div className="py-3"><ErrorText message={breakdown.error} /></div>
            ) : breakdown.rows.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">কিছু পাওয়া যায়নি।</p>
            ) : (
              <div className="space-y-4 mt-3">
                {Array.from(groupedByDealer.entries()).map(([id, g]) => (
                  <div key={id ?? "none"}>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1">
                      <Link to={`/dealers/${id}`} className="font-semibold text-sm text-emerald-700 hover:underline">{g.name}</Link>
                      <span className="text-sm font-bold">{formatTaka(g.total)}</span>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {g.rows.map((r) => (
                        <li key={r.transaction_id}>
                          <Link to={`/transactions/${r.transaction_id}`} className="flex items-center justify-between py-2 gap-3 hover:bg-slate-50 -mx-2 px-2 rounded">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{r.product_description || "লেনদেন"}</div>
                              <div className="text-xs text-slate-500">
                                {r.seller_name} → {r.buyer_name} · {formatDate(r.transaction_date)}
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <div className="text-sm font-semibold">{formatTaka(r.amount)}</div>
                              <StatusBadge status={r.status} />
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
