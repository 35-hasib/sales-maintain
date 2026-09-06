import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getToken } from "../lib/api";
import { formatTaka, formatDate } from "../lib/format";
import type { Dealer, LedgerEntry } from "../lib/types";
import { Card, Input, Select, Button, Pagination, Spinner } from "../components/ui";

const ENTRY_LABEL: Record<string, string> = {
  collection: "আদায়",
  disbursement: "পরিশোধ",
};

function TuneIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  );
}

function DownloadIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

export default function Ledger() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [dealerId, setDealerId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 10;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  function buildParams(withFilters: boolean) {
    const params = new URLSearchParams();
    if (withFilters) {
      if (dealerId) params.set("dealerId", dealerId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));
    } else {
      params.set("all", "1");
    }
    return params;
  }

  async function load() {
    const params = buildParams(true);
    const q = params.toString();
    try {
      const d = await api.get<{ entries: LedgerEntry[]; total: number }>(`/api/ledger${q ? `?${q}` : ""}`);
      setEntries(d.entries);
      setTotal(d.total);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function exportCsv(filtered: boolean) {
    setExporting(true);
    const q = buildParams(filtered).toString();
    const token = getToken();
    fetch(`${import.meta.env.VITE_API_BASE || ""}/api/ledger/export${q ? `?${q}` : ""}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ledger.csv";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError("CSV ডাউনলোড ব্যর্থ হয়েছে"))
      .finally(() => setExporting(false));
  }

  const activeFilterCount = [dealerId, dateFrom, dateTo].filter(Boolean).length;

  function clearFilters() {
    setDealerId(""); setDateFrom(""); setDateTo(""); setPage(1);
  }

  useEffect(() => {
    api.get<{ dealers: Dealer[] }>(`/api/dealers?pageSize=1000`).then((d) => setDealers(d.dealers)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, dealerId, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">খাতা</h1>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="secondary" disabled={exporting} onClick={() => exportCsv(activeFilterCount === 0)}>
            {exporting ? (
              <span className="inline-flex items-center gap-2"><Spinner size={3} />সব এক্সপোর্ট</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><DownloadIcon />{activeFilterCount > 0 ? "ফিল্টার এক্সপোর্ট" : "সব এক্সপোর্ট"}</span>
            )}
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={dealerId} onChange={(e) => { setDealerId(e.target.value); setPage(1); }}>
              <option value="">সব ব্যবসায়ী</option>
              {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
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
        {entries.length === 0 ? (
          <Card><p className="text-sm text-slate-500 text-center py-4">কোনো এন্ট্রি নেই।</p></Card>
        ) : (
          entries.map((e) => (
            <Link key={e.id} to={`/transactions/${e.transaction_id}`}>
              <Card className="hover:bg-slate-50 transition py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 ${
                    e.entry_type === "collection" ? "bg-emerald-100" : e.entry_type === "disbursement" ? "bg-rose-100" : "bg-slate-200"
                  }`}>
                    {e.entry_type === "collection" ? "↓" : e.entry_type === "disbursement" ? "↑" : "↩"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {ENTRY_LABEL[e.entry_type] ?? e.entry_type}
                      <span className="text-slate-500 font-normal"> · {e.dealer_name || "—"}</span>
                    </div>
                    <div className="text-xs text-slate-400">{formatDate(e.occurred_at)} · {e.officer_name}</div>
                  </div>
                  <div className={`text-sm font-semibold shrink-0 ${
                    e.entry_type === "collection" ? "text-emerald-600" : e.entry_type === "disbursement" ? "text-rose-600" : "text-slate-500"
                  }`}>
                    {e.amount.startsWith("-") ? "−" : "+"}{formatTaka(e.amount.replace(/^-/, ""))}
                  </div>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  );
}
