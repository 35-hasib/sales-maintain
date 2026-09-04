import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Dealer } from "../lib/types";
import { Card, Button, Input, Textarea, Field, ErrorText } from "../components/ui";

type FormState = { name: string; phone: string; address: string; notes: string };

const emptyForm: FormState = { name: "", phone: "", address: "", notes: "" };

export default function Dealers() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Dealer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  async function load(p = page, q = debouncedSearch) {
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (q.trim()) params.set("q", q.trim());
      const d = await api.get<{ dealers: Dealer[]; total: number; page: number }>(
        `/api/dealers?${params.toString()}`
      );
      setDealers(d.dealers);
      setTotal(d.total);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  function onSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }
  function openEdit(d: Dealer) {
    setEditing(d);
    setForm({ name: d.name, phone: d.phone || "", address: d.address || "", notes: d.notes || "" });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      name: form.name,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
    };
    try {
      if (editing) await api.put(`/api/dealers/${editing.id}`, payload);
      else await api.post("/api/dealers", payload);
      setShowModal(false);
      await load();
    } catch (err: any) {
      setError(err?.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(d: Dealer) {
    if (!confirm(`"${d.name}" ব্যবসায়ীটি মুছে ফেলবেন?`)) return;
    try {
      await api.del(`/api/dealers/${d.id}`);
      await load();
    } catch (err: any) {
      alert(err?.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ব্যবসায়ী</h1>
        <Button onClick={openNew}>+ ব্যবসায়ী যোগ করুন</Button>
      </div>

      <Input
        type="search"
        placeholder="নাম বা ফোন দিয়ে খুঁজুন…"
        value={search}
        onChange={onSearchChange}
      />

      {error && <ErrorText message={error} />}

      <Card>
        {dealers.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            {total === 0 && !search ? "এখনো কোনো ব্যবসায়ী নেই।" : "খোঁজে কোনো ব্যবসায়ী পাওয়া যায়নি।"}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {dealers.map((d) => (
              <li key={d.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <Link to={`/dealers/${d.id}`} className="min-w-0">
                    <div className="font-medium text-sm">{d.name}</div>
                    <div className="text-xs text-slate-500">
                      {d.phone || "—"}
                      {d._count && ` · ${d._count.transactionsAsSeller} বিক্রেতা / ${d._count.transactionsAsBuyer} ক্রেতা লেনদেন`}
                    </div>
                  </Link>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" title="সম্পাদনা" aria-label="সম্পাদনা" onClick={() => openEdit(d)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button type="button" title="মুছুন" aria-label="মুছুন" onClick={() => handleDelete(d)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 mt-2">
            <span className="text-xs text-slate-500">
              মোট {total} জন · {page} / {totalPages}
            </span>
            <div className="flex gap-1">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                পূর্ববর্তী
              </Button>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                পরবর্তী
              </Button>
            </div>
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">{editing ? "ব্যবসায়ী সম্পাদনা" : "ব্যবসায়ী যোগ করুন"}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="নাম *">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field label="ফোন">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="ঠিকানা">
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <Field label="নোট">
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </Field>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={busy}>{busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ"}</Button>
                <Button variant="secondary" onClick={() => setShowModal(false)}>বাতিল</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
