import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Summary[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [error, setError] = useState("");
  const [filterDealer, setFilterDealer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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

  const confirmDelete = (t: Summary) => {
    if (window.confirm(`"${t.product_description || "লেনদেন"}" লেনদেনটি মুছে ফেলবেন?`)) {
      window.alert("ব্যাকএন্ডে ডিলিট এন্ডপয়েন্ট এখনো যুক্ত হয়নি।");
    }
  };

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
        <Link to="/transactions/new">
          <Button>+ নতুন</Button>
        </Link>
      </div>

      {/* Filters */}
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
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          <Button variant="secondary" onClick={() => { setFilterDealer(""); setFilterStatus(""); setDateFrom(""); setDateTo(""); setPage(1); }}>মুছুন</Button>
        </div>
      </Card>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="space-y-2">
        {transactions.length === 0 ? (
          <Card><p className="text-sm text-slate-500 text-center py-4">কোনো লেনদেন পাওয়া যায়নি।</p></Card>
        ) : (
          transactions.map((t) => (
            <Card key={t.id} className="hover:bg-slate-50 transition">
              <div className="flex items-center justify-between gap-3">
                <Link to={`/transactions/${t.id}`} className="min-w-0 flex-1 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {t.product_description || "লেনদেন"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t.seller_name} → {t.buyer_name} · {formatDate(t.transaction_date)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold">{formatTaka(t.total_amount)}</div>
                    <StatusBadge status={t.status} />
                  </div>
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="সম্পাদনা"
                    aria-label="সম্পাদনা"
                    onClick={() => navigate(`/transactions/${t.id}`)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title="মুছুন"
                    aria-label="মুছুন"
                    onClick={() => confirmDelete(t)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
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
