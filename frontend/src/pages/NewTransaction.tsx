import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Dealer } from "../lib/types";
import { Button, Input, Textarea, Field, ErrorText, Select } from "../components/ui";
import PhotoUpload from "../components/PhotoUpload";

export default function NewTransaction() {
  const navigate = useNavigate();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    sellerDealerId: "",
    buyerDealerId: "",
    totalAmount: "",
    productDescription: "",
    transactionDate: new Date().toISOString().slice(0, 10),
  });
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    api.get<{ dealers: Dealer[] }>(`/api/dealers?pageSize=1000`).then((d) => setDealers(d.dealers)).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const t = await api.post<{ transaction: { id: string } }>("/api/transactions", {
        sellerDealerId: form.sellerDealerId,
        buyerDealerId: form.buyerDealerId,
        totalAmount: form.totalAmount,
        productDescription: form.productDescription || null,
        transactionDate: form.transactionDate,
        photos,
      });
      navigate(`/transactions/${t.transaction.id}`);
    } catch (err: any) {
      setError(err?.message || "লেনদেন তৈরি করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg">
      <Link to="/transactions" className="text-sm text-emerald-700">← লেনদেন</Link>
      <h1 className="text-xl font-bold mt-1 mb-4">নতুন লেনদেন</h1>

      <CardLike>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="বিক্রেতা ব্যবসায়ী *">
            <Select value={form.sellerDealerId} onChange={(e) => setForm({ ...form, sellerDealerId: e.target.value })} required>
              <option value="">বিক্রেতা নির্বাচন করুন</option>
              {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="ক্রেতা ব্যবসায়ী *">
            <Select value={form.buyerDealerId} onChange={(e) => setForm({ ...form, buyerDealerId: e.target.value })} required>
              <option value="">ক্রেতা নির্বাচন করুন</option>
              {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="মোট পরিমাণ (৳) *">
            <Input type="number" step="0.01" min="0.01" inputMode="decimal" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} placeholder="125000.00" required />
          </Field>
          <Field label="পণ্যের বিবরণ">
            <Textarea value={form.productDescription} onChange={(e) => setForm({ ...form, productDescription: e.target.value })} rows={2} />
          </Field>
          <Field label="লেনদেনের তারিখ">
            <Input type="date" value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} />
          </Field>
          <Field label="ছবি সংযুক্তি">
            <PhotoUpload value={photos} onChange={setPhotos} folder="salesmaintain/transactions" />
          </Field>
          <ErrorText message={error} />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={busy}>{busy ? "তৈরি হচ্ছে…" : "লেনদেন তৈরি করুন"}</Button>
          </div>
        </form>
      </CardLike>
    </div>
  );
}

function CardLike({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">{children}</div>;
}
