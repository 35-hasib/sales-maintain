import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatTaka, formatDate } from "../lib/format";
import type { Dealer, Summary } from "../lib/types";
import { Card, StatusBadge, Button, Input, Select, Pagination } from "../components/ui";

const statuses = [
  "pending",
  "partially_collected",
  "fully_collected",
  "partially_disbursed",
  "settled",
];

const STATUS_LABEL: Record<string, string> = {
  pending: "বাকি",
  partially_collected: "আংশিক আদায়",
  fully_collected: "সম্পূর্ণ আদায়",
  partially_disbursed: "আংশিক পরিশোধ",
  settled: "সম্পন্ন",
};

function TuneIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  );
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Summary[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [error, setError] = useState("");
  const [filterDealer, setFilterDealer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  async function load(p = page) {
    const params = new URLSearchParams();
    if (filterDealer) params.set("dealerId", filterDealer);
    if (filterStatus) params.set("status", filterStatus);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("limit", String(pageSize));
    params.set("offset", String((p - 1) * pageSize));
    const q = params.toString();
    try {
      const d = await api.get<{ transactions: Summary[]; total: number }>(`/api/transactions${q ? `?${q}` : ""}`);
      setTransactions(d.transactions);
      if (typeof d.total === "number") setTotal(d.total);
    } catch (e: any) {
      setError(e.message);
    }
  }

  const activeFilterCount = [filterDealer, filterStatus, dateFrom, dateTo].filter(Boolean).length;

  function clearFilters() {
    setFilterDealer(""); setFilterStatus(""); setDateFrom(""); setDateTo(""); setPage(1);
  }

  useEffect(() => {
    api.get<{ dealers: Dealer[] }>(`/api/dealers?pageSize=1000`).then((d) => setDealers(d.dealers)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterDealer, filterStatus, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">লেনদেন</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border transition ${
              showFilters || activeFilterCount > 0
                ? "bg-emerald-700 text-white border-emerald-700"
                : "bg-white text-emerald-700 border-slate-300"
            }`}
          >
            <TuneIcon className="w-[18px] h-[18px]" />
            ফিল্টার{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          <Link to="/transactions/new">
            <Button>যোগ করুন</Button>
          </Link>
        </div>
      </div>

      {showFilters && (
        <Card className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Select value={filterDealer} onChange={(e) => { setFilterDealer(e.target.value); setPage(1); }}>
              <option value="">সব ব্যবসায়ী</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
            <Select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
              <option value="">সব অবস্থা</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
              ))}
            </Select>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">শুরুর তারিখ</span>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">শেষ তারিখ</span>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            </div>
            <div className="flex items-end">
              <Button variant="secondary" onClick={clearFilters}>মুছুন</Button>
            </div>
          </div>
        </Card>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="space-y-2">
        {transactions.length === 0 ? (
          <Card><p className="text-sm text-slate-500 text-center py-4">কোনো লেনদেন পাওয়া যায়নি।</p></Card>
        ) : (
          transactions.map((t) => (
            <Card key={t.id} className="hover:bg-slate-50 transition">
              <div className="flex items-center gap-3">
                <Link to={`/transactions/${t.id}`} className="min-w-0 flex-1">
                  <div>
                    <div className="font-semibold text-sm truncate">
                      {t.product_description || "লেনদেন"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t.seller_name} → {t.buyer_name} · {formatDate(t.transaction_date)}
                    </div>
                  </div>
                </Link>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="text-sm font-bold">{formatTaka(t.total_amount)}</div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  );
}
