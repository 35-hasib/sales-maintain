import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { formatTaka, formatDate } from "../lib/format";
import type { Summary, Dealer } from "../lib/types";
import { Card, CardTitle, StatusBadge, Button, Input, Textarea, Field, Select, ErrorText, Alert } from "../components/ui";
import PhotoUpload from "../components/PhotoUpload";
import PhotoGallery from "../components/PhotoGallery";

type Entry = {
  id: string;
  amount: string;
  collectedAt?: string;
  disbursedAt?: string;
  paymentMethod: string | null;
  note: string | null;
  runningTotal?: string;
  photos?: string[];
  recordedByOfficer?: { name: string };
};

type Detail = {
  summary: Summary;
  collections: Entry[];
  disbursements: Entry[];
};

type ModalState = {
  kind: "collection" | "disbursement" | null;
  amount: string;
  date: string;
  paymentMethod: string;
  note: string;
  photos: string[];
};

type EditState = {
  sellerDealerId: string;
  buyerDealerId: string;
  totalAmount: string;
  productDescription: string;
  transactionDate: string;
  photos: string[];
} | null;

type EntryEditState = {
  kind: "collection" | "disbursement";
  id: string;
  amount: string;
  date: string;
  paymentMethod: string;
  note: string;
  photos: string[];
} | null;

const PAYMENT_LABEL: Record<string, string> = {
  cash: "নগদ",
  bank: "ব্যাংক",
  mobile_banking: "মোবাইল ব্যাংকিং",
  other: "অন্যান্য",
};
const paymentLabel = (m: string | null | undefined) => (m ? (PAYMENT_LABEL[m] ?? m) : "—");

export default function TransactionDetail() {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [warning, setWarning] = useState("");
  const [editing, setEditing] = useState<EditState>(null);
  const [editError, setEditError] = useState("");
  const [entryEditing, setEntryEditing] = useState<EntryEditState>(null);
  const [entryEditError, setEntryEditError] = useState("");
  const [dealers, setDealers] = useState<Dealer[]>([]);

  async function load() {
    try {
      const d = await api.get<Detail>(`/api/transactions/${id}`);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    api.get<{ dealers: Dealer[] }>(`/api/dealers?pageSize=1000`).then((d) => setDealers(d.dealers)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p>লোড হচ্ছে…</p>;

  const s = data.summary;
  const held = formatTaka(s.officer_held_balance);
  const availableToPay = Number(s.total_collected) - Number(s.total_disbursed);

  function openModal(kind: "collection" | "disbursement") {
    setModal({
      kind,
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: kind === "disbursement" ? "bank" : "cash",
      note: "",
      photos: [],
    });
    setModalError("");
    setWarning("");
  }

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    setBusy(true);
    setModalError("");
    setWarning("");
    const path = modal.kind === "collection" ? "/api/collections" : "/api/disbursements";
    const dateKey = modal.kind === "collection" ? "collectedAt" : "disbursedAt";
    try {
      const args: Record<string, unknown> = {
        transactionId: id,
        amount: modal.amount,
        paymentMethod: modal.paymentMethod || null,
        note: modal.note || null,
        photos: modal.photos,
      };
      if (modal.date) args[dateKey] = modal.date;
      const result = await api.post<Record<string, unknown>>(path, args);
      if (modal.kind === "collection" && (result as any).warning) {
        setWarning("রেকর্ড হয়েছে — কিন্তু এই পরিমাণ ক্রেতার নিকট বাকি টাকার চেয়ে বেশি।");
      }
      setModal(null);
      await load();
    } catch (err: any) {
      setModalError(err?.message || "রেকর্ড করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  function openEntryEdit(kind: "collection" | "disbursement", en: Entry) {
    setEntryEditError("");
    setEntryEditing({
      kind,
      id: en.id,
      amount: en.amount,
      date: (en.collectedAt || en.disbursedAt || "").slice(0, 10),
      paymentMethod: en.paymentMethod || "",
      note: en.note || "",
      photos: en.photos || [],
    });
  }

  async function handleEntryEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entryEditing) return;
    setBusy(true);
    setEntryEditError("");
    const dateKey = entryEditing.kind === "collection" ? "collectedAt" : "disbursedAt";
    try {
      const args: Record<string, unknown> = {
        amount: entryEditing.amount,
        paymentMethod: entryEditing.paymentMethod || null,
        note: entryEditing.note || null,
        photos: entryEditing.photos,
      };
      if (entryEditing.date) args[dateKey] = entryEditing.date;
      await api.put(`/api/${entryEditing.kind}s/${entryEditing.id}`, args);
      setEntryEditing(null);
      await load();
    } catch (err: any) {
      setEntryEditError(err?.message || "পরিবর্তন সংরক্ষণ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  function openEdit() {
    const s = data!.summary;
    setEditError("");
    setEditing({
      sellerDealerId: s.seller_dealer_id,
      buyerDealerId: s.buyer_dealer_id,
      totalAmount: s.total_amount,
      productDescription: s.product_description || "",
      transactionDate: (s.transaction_date || "").slice(0, 10),
      photos: s.photos || [],
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setEditError("");
    try {
      await api.put(`/api/transactions/${id}`, {
        sellerDealerId: editing.sellerDealerId,
        buyerDealerId: editing.buyerDealerId,
        totalAmount: editing.totalAmount,
        productDescription: editing.productDescription || null,
        transactionDate: editing.transactionDate,
        photos: editing.photos,
      });
      setEditing(null);
      await load();
    } catch (err: any) {
      setEditError(err?.message || "পরিবর্তন সংরক্ষণ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  const renderEntry = (kind: "collection" | "disbursement", entries: Entry[], sign: 1 | -1) => (
    <>
      {entries.length === 0 && (
        <p className="text-sm text-slate-400 py-3">এখনো কিছু রেকর্ড হয়নি।</p>
      )}

      {/* Mobile: card list */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {entries.map((en) => {
          const amt = Number(en.amount);
          const tone = kind === "collection" ? "text-emerald-700" : "text-rose-700";
          return (
            <li key={en.id} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${tone}`}>
                    {sign === 1 ? "+" : "−"}{formatTaka(amt)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDate(en.collectedAt || en.disbursedAt)} · {paymentLabel(en.paymentMethod)}
                    {en.runningTotal ? ` · চলমান ${formatTaka(en.runningTotal)}` : ""}
                  </div>
                  {en.note && <div className="text-xs text-slate-500 mt-0.5 truncate">{en.note}</div>}
                  {en.photos && en.photos.length > 0 && (
                    <div className="mt-1.5"><PhotoGallery photos={en.photos} /></div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" title="সম্পাদনা" aria-label="সম্পাদনা" onClick={() => openEntryEdit(kind, en)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop/tablet: full table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="text-left text-xs text-slate-500 border-b">
            <tr>
              <th className="py-2 pr-2">তারিখ</th>
              <th className="py-2 pr-2 text-right">পরিমাণ</th>
              <th className="py-2 pr-2 text-right">চলমান</th>
              <th className="py-2 pr-2">পদ্ধতি</th>
              <th className="py-2 pr-2">নোট</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((en) => {
              const amt = Number(en.amount);
              return (
                <tr key={en.id}>
                  <td className="py-2 pr-2">{formatDate(en.collectedAt || en.disbursedAt)}</td>
                  <td className={`py-2 pr-2 text-right font-medium ${kind === "collection" ? "text-emerald-700" : "text-rose-700"}`}>
                    {sign === 1 ? "+" : "−"}{formatTaka(amt)}
                  </td>
                  <td className="py-2 pr-2 text-right text-slate-500">{en.runningTotal ? formatTaka(en.runningTotal) : ""}</td>
                  <td className="py-2 pr-2">{paymentLabel(en.paymentMethod)}</td>
                  <td className="py-2 pr-2 text-slate-500 max-w-[160px]">
                    <div className="truncate">{en.note || "—"}</div>
                    {en.photos && en.photos.length > 0 && (
                      <div className="mt-1"><PhotoGallery photos={en.photos} /></div>
                    )}
                  </td>
                  <td className="py-2 text-right space-x-1">
                    <button type="button" title="সম্পাদনা" aria-label="সম্পাদনা" onClick={() => openEntryEdit(kind, en)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <div className="space-y-5">
      <div>
        <Link to="/transactions" className="text-sm text-emerald-700">← লেনদেন</Link>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
          <h1 className="text-xl font-bold min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{s.product_description || "লেনদেন"}</h1>
          <button
            type="button"
            title="লেনদেন সম্পাদনা"
            aria-label="লেনদেন সম্পাদনা"
            onClick={openEdit}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <StatusBadge status={s.status} />
        </div>
        <p className="text-sm text-slate-500 break-words">
          {s.seller_name} (বিক্রেতা) → {s.buyer_name} (ক্রেতা) · {formatDate(s.transaction_date)}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardTitle>মোট পরিমাণ</CardTitle><div className="text-xl font-bold break-words">{formatTaka(s.total_amount)}</div></Card>
        <Card><CardTitle>আদায়কৃত</CardTitle><div className="text-xl font-bold text-emerald-700 break-words">{formatTaka(s.total_collected)}</div>
          <div className="text-xs text-slate-400 mt-1 break-words">ক্রেতার নিকট বাকি: {formatTaka(s.amount_due_from_buyer)}</div></Card>
        <Card><CardTitle>পরিশোধিত</CardTitle><div className="text-xl font-bold text-rose-700 break-words">{formatTaka(s.total_disbursed)}</div>
          <div className="text-xs text-slate-400 mt-1 break-words">বিক্রেতাকে বাকি: {formatTaka(s.amount_due_to_seller)}</div></Card>
        <Card className="sm:col-span-3 bg-emerald-50 border-emerald-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-emerald-800">কর্মকর্তার হাতে থাকা টাকা</div>
              <div className="text-xs text-emerald-700 break-words">আদায়কৃত কিন্তু এখনো বিক্রেতাকে দেওয়া হয়নি
                <br />এখন পরিশোধযোগ্য: {formatTaka(availableToPay)}</div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-800 shrink-0 break-words">{held}</div>
          </div>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-2 sm:flex-wrap">
        <Button onClick={() => openModal("collection")} className="w-full sm:w-auto">+ আদায় রেকর্ড করুন</Button>
        <Button variant="secondary" onClick={() => openModal("disbursement")} className="w-full sm:w-auto">+ পরিশোধ রেকর্ড করুন</Button>
      </div>

      {s.photos && s.photos.length > 0 && (
        <Card>
          <CardTitle>লেনদেনের ছবি</CardTitle>
          <PhotoGallery photos={s.photos} />
        </Card>
      )}

      {warning && <Alert>{warning}</Alert>}

      {/* Collections */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>ক্রেতার কাছ থেকে আদায় ({data.collections.length})</CardTitle>
          <span className="text-xs text-slate-400">মোট {formatTaka(s.total_collected)}</span>
        </div>
        {renderEntry("collection", data.collections, 1)}
      </Card>

      {/* Disbursements */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>বিক্রেতাকে পরিশোধ ({data.disbursements.length})</CardTitle>
          <span className="text-xs text-slate-400">মোট {formatTaka(s.total_disbursed)}</span>
        </div>
        {renderEntry("disbursement", data.disbursements, -1)}
      </Card>

      {/* Record modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-1">
              {modal.kind === "collection" ? "আদায় রেকর্ড করুন" : "পরিশোধ রেকর্ড করুন"}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {modal.kind === "collection" ? "ক্রেতা ব্যবসায়ীর কাছ থেকে প্রাপ্ত টাকা।" : "বিক্রেতা ব্যবসায়ীকে প্রদত্ত টাকা।"}
              {modal.kind === "disbursement" && ` এখন সর্বোচ্চ প্রদেয়: ${formatTaka(availableToPay)}।`}
            </p>
            <form onSubmit={handleRecord} className="space-y-3">
              <Field label="পরিমাণ (৳) *">
                <Input type="number" step="0.01" min="0.01" inputMode="decimal" value={modal.amount}
                  onChange={(e) => setModal({ ...modal, amount: e.target.value })} placeholder="0.00" required />
              </Field>
              <Field label="তারিখ">
                <Input type="date" value={modal.date} onChange={(e) => setModal({ ...modal, date: e.target.value })} />
              </Field>
              <Field label="পরিশোধের পদ্ধতি">
                <Select value={modal.paymentMethod} onChange={(e) => setModal({ ...modal, paymentMethod: e.target.value })}>
                  <option value="cash">নগদ</option>
                  <option value="bank">ব্যাংক</option>
                  <option value="mobile_banking">মোবাইল ব্যাংকিং</option>
                  <option value="other">অন্যান্য</option>
                </Select>
              </Field>
              <Field label="নোট">
                <Textarea value={modal.note} onChange={(e) => setModal({ ...modal, note: e.target.value })} rows={2} />
              </Field>
              <Field label="ছবি">
                <PhotoUpload
                  value={modal.photos}
                  onChange={(p) => setModal({ ...modal, photos: p })}
                  folder={`salesmaintain/${modal.kind === "collection" ? "collections" : "disbursements"}`}
                />
              </Field>
              {modalError && <ErrorText message={modalError} />}
              {modal.kind === "collection" && !modalError && (
                <p className="text-xs text-slate-400">
                  বাকি টাকার চেয়ে বেশি পরিমাণ নিলে তা সত্ত্বেও রেকর্ড হবে, তবে সতর্কবার্তা দেখাবে।
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={busy}>{busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ"}</Button>
                <Button variant="secondary" onClick={() => setModal(null)}>বাতিল</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit transaction modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-1">লেনদেন সম্পাদনা</h2>
            <p className="text-xs text-slate-500 mb-4">
              পরিমাণ সম্পাদনা করলে বিদ্যমান আদায় ও পরিশোধ অনুযায়ী হিসাব পুনঃগণনা হবে।
            </p>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <Field label="বিক্রেতা ব্যবসায়ী *">
                <Select value={editing.sellerDealerId} onChange={(e) => setEditing({ ...editing, sellerDealerId: e.target.value })} required>
                  <option value="">বিক্রেতা নির্বাচন করুন</option>
                  {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="ক্রেতা ব্যবসায়ী *">
                <Select value={editing.buyerDealerId} onChange={(e) => setEditing({ ...editing, buyerDealerId: e.target.value })} required>
                  <option value="">ক্রেতা নির্বাচন করুন</option>
                  {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="মোট পরিমাণ (৳) *">
                <Input type="number" step="0.01" min="0.01" inputMode="decimal" value={editing.totalAmount}
                  onChange={(e) => setEditing({ ...editing, totalAmount: e.target.value })} required />
              </Field>
              <Field label="পণ্যের বিবরণ">
                <Textarea value={editing.productDescription} onChange={(e) => setEditing({ ...editing, productDescription: e.target.value })} rows={2} />
              </Field>
              <Field label="লেনদেনের তারিখ">
                <Input type="date" value={editing.transactionDate} onChange={(e) => setEditing({ ...editing, transactionDate: e.target.value })} />
              </Field>
              <Field label="ছবি">
                <PhotoUpload
                  value={editing.photos}
                  onChange={(p) => setEditing({ ...editing, photos: p })}
                  folder="salesmaintain/transactions"
                />
              </Field>
              {editError && <ErrorText message={editError} />}
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={busy}>{busy ? "সংরক্ষণ হচ্ছে…" : "পরিবর্তন সংরক্ষণ"}</Button>
                <Button variant="secondary" onClick={() => setEditing(null)}>বাতিল</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit entry modal */}
      {entryEditing && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-1">
              {entryEditing.kind === "collection" ? "আদায় সম্পাদনা" : "পরিশোধ সম্পাদনা"}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {entryEditing.kind === "collection"
                ? "ক্রেতা ব্যবসায়ীর কাছ থেকে প্রাপ্ত টাকা।"
                : "বিক্রেতা ব্যবসায়ীকে প্রদত্ত টাকা।"}{" "}
              পরিমাণ পরিবর্তন করলে চলমান হিসাব ও খাতা আপডেট হবে।
            </p>
            <form onSubmit={handleEntryEditSubmit} className="space-y-3">
              <Field label="পরিমাণ (৳) *">
                <Input type="number" step="0.01" min="0.01" inputMode="decimal" value={entryEditing.amount}
                  onChange={(e) => setEntryEditing({ ...entryEditing, amount: e.target.value })} placeholder="0.00" required />
              </Field>
              <Field label="তারিখ">
                <Input type="date" value={entryEditing.date} onChange={(e) => setEntryEditing({ ...entryEditing, date: e.target.value })} />
              </Field>
              <Field label="পরিশোধের পদ্ধতি">
                <Select value={entryEditing.paymentMethod} onChange={(e) => setEntryEditing({ ...entryEditing, paymentMethod: e.target.value })}>
                  <option value="">কোনোটি নয়</option>
                  <option value="cash">নগদ</option>
                  <option value="bank">ব্যাংক</option>
                  <option value="mobile_banking">মোবাইল ব্যাংকিং</option>
                  <option value="other">অন্যান্য</option>
                </Select>
              </Field>
              <Field label="নোট">
                <Textarea value={entryEditing.note} onChange={(e) => setEntryEditing({ ...entryEditing, note: e.target.value })} rows={2} />
              </Field>
              <Field label="ছবি">
                <PhotoUpload
                  value={entryEditing.photos}
                  onChange={(p) => setEntryEditing({ ...entryEditing, photos: p })}
                  folder={`salesmaintain/${entryEditing.kind === "collection" ? "collections" : "disbursements"}`}
                />
              </Field>
              {entryEditError && <ErrorText message={entryEditError} />}
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={busy}>{busy ? "সংরক্ষণ হচ্ছে…" : "পরিবর্তন সংরক্ষণ"}</Button>
                <Button variant="secondary" onClick={() => setEntryEditing(null)}>বাতিল</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
