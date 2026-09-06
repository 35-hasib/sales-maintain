import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { formatTaka } from "../lib/format";
import type { Dealer, Summary } from "../lib/types";
import { Card, CardTitle, StatusBadge, Spinner } from "../components/ui";

type Detail = {
  dealer: Dealer;
  asSeller: Summary[];
  asBuyer: Summary[];
  summary: { owedByThem: string; owedToThem: string; net: string };
};

export default function DealerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Detail>(`/api/dealers/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <div className="flex justify-center py-10"><Spinner size={6} /></div>;

  const rows = (list: Summary[]) => (
    <tbody className="divide-y divide-slate-100">
      {list.map((t) => (
        <tr
          key={t.id}
          onClick={() => navigate(`/transactions/${t.id}`)}
          className="text-sm cursor-pointer hover:bg-slate-50 transition"
        >
          <td className="py-2 pr-2 font-medium text-emerald-700">
            {t.product_description || "—"}
          </td>
          <td className="py-2 pr-2">{data.dealer.name === t.seller_name ? t.buyer_name : t.seller_name}</td>
          <td className="py-2 pr-2 text-right">{formatTaka(t.total_amount)}</td>
          <td className="py-2 pr-2 text-right">{formatTaka(t.total_collected)}</td>
          <td className="py-2 pr-2 text-right">{formatTaka(t.total_disbursed)}</td>
          <td className="py-2 pr-2 text-right font-semibold">{formatTaka(t.officer_held_balance)}</td>
          <td className="py-2"><StatusBadge status={t.status} /></td>
        </tr>
      ))}
    </tbody>
  );

  // Mobile card list variant of the table above.
  const cards = (list: Summary[]) => (
    <ul className="divide-y divide-slate-100 md:hidden">
      {list.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => navigate(`/transactions/${t.id}`)}
            className="w-full text-left py-3 pr-2 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-emerald-700 truncate">{t.product_description || "—"}</div>
                <div className="text-xs text-slate-500">
                  {data.dealer.name === t.seller_name ? t.buyer_name : t.seller_name}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  পরিমাণ {formatTaka(t.total_amount)} · আদায় {formatTaka(t.total_collected)}
                  <br />পরিশোধ {formatTaka(t.total_disbursed)} · জমা <span className="font-semibold text-slate-600">{formatTaka(t.officer_held_balance)}</span>
                </div>
              </div>
              <StatusBadge status={t.status} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-5">
      <div>
        <Link to="/dealers" className="text-sm text-emerald-700">← ব্যবসায়ী</Link>
        <h1 className="text-xl font-bold mt-1">{data.dealer.name}</h1>
        <p className="text-sm text-slate-500">
          {data.dealer.phone || "ফোন নেই"} {data.dealer.address ? `· ${data.dealer.address}` : ""}
        </p>
        {data.dealer.notes && <p className="text-sm text-slate-500 mt-1">{data.dealer.notes}</p>}
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardTitle>তাদেরকে প্রদেয়</CardTitle><div className="text-xl font-bold text-emerald-600">{formatTaka(data.summary.owedToThem)}</div></Card>
        <Card><CardTitle>তাদের নিকট প্রাপ্য</CardTitle><div className="text-xl font-bold text-rose-600">{formatTaka(data.summary.owedByThem)}</div></Card>
        <Card><CardTitle>নিট অবস্থান</CardTitle><div className="text-xl font-bold">{formatTaka(data.summary.net)}</div></Card>
      </div>

      {/* As seller */}
      <Card>
        <CardTitle>বিক্রেতা হিসেবে ({data.asSeller.length})</CardTitle>
        {data.asSeller.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">বিক্রেতা হিসেবে কোনো লেনদেন নেই।</p>
        ) : (
          <>
            {cards(data.asSeller)}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="text-left text-xs text-slate-500 border-b">
                  <tr>
                    <th className="py-2 pr-2">পণ্য</th><th className="py-2 pr-2">ক্রেতা</th>
                    <th className="py-2 pr-2 text-right">পরিমাণ</th><th className="py-2 pr-2 text-right">আদায়</th>
                    <th className="py-2 pr-2 text-right">পরিশোধ</th><th className="py-2 pr-2 text-right">জমা</th>
                    <th className="py-2">অবস্থা</th>
                  </tr>
                </thead>
                {rows(data.asSeller)}
              </table>
            </div>
          </>
        )}
      </Card>

      {/* As buyer */}
      <Card>
        <CardTitle>ক্রেতা হিসেবে ({data.asBuyer.length})</CardTitle>
        {data.asBuyer.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">ক্রেতা হিসেবে কোনো লেনদেন নেই।</p>
        ) : (
          <>
            {cards(data.asBuyer)}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="text-left text-xs text-slate-500 border-b">
                  <tr>
                    <th className="py-2 pr-2">পণ্য</th><th className="py-2 pr-2">বিক্রেতা</th>
                    <th className="py-2 pr-2 text-right">পরিমাণ</th><th className="py-2 pr-2 text-right">আদায়</th>
                    <th className="py-2 pr-2 text-right">পরিশোধ</th><th className="py-2 pr-2 text-right">জমা</th>
                    <th className="py-2">অবস্থা</th>
                  </tr>
                </thead>
                {rows(data.asBuyer)}
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
