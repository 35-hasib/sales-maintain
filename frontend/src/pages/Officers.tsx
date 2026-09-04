import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type { Officer } from "../lib/types";
import { Card, CardTitle, Button, Input, Field, Select, ErrorText, Pagination } from "../components/ui";
import { formatDate } from "../lib/format";

type FormState = { name: string; email: string; password: string; role: string };

const emptyForm: FormState = { name: "", email: "", password: "", role: "officer" };

const roleLabel = (role: string) => (role === "admin" ? "অ্যাডমিন" : "কর্মকর্তা");

export default function Officers() {
  const { officer } = useAuth();
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Officer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  const isAdmin = officer?.role === "admin";

  async function load() {
    try {
      const d = await api.get<{ officers: Officer[]; total: number }>(
        `/api/auth/?page=${page}&pageSize=${pageSize}`
      );
      setOfficers(d.officers);
      if (typeof d.total === "number") setTotal(d.total);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, page]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
    setError("");
  }

  function openEdit(o: Officer) {
    setEditing(o);
    setForm({ name: o.name, email: o.email, password: "", role: o.role });
    setShowForm(true);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload: Record<string, string> = { name: form.name, email: form.email, role: form.role };
      if (form.password) payload.password = form.password;
      if (editing) {
        await api.put(`/api/auth/${editing.id}`, payload);
      } else {
        payload.password = form.password;
        await api.post("/api/auth/", payload);
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (err: any) {
      setError(err?.message || "কর্মকর্তা সংরক্ষণ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(o: Officer) {
    if (!confirm(`"${o.name}" কর্মকর্তাকে মুছে ফেলবেন? এটি বাতিল করা যাবে না।`)) return;
    setError("");
    try {
      await api.del(`/api/auth/${o.id}`);
      await load();
    } catch (err: any) {
      setError(err?.message || "কর্মকর্তা মুছে ফেলা যায়নি");
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <p className="text-sm text-slate-500">
          আপনি <b>{officer?.role}</b> হিসেবে লগইন করেছেন। শুধু অ্যাডমিন কর্মকর্তাদের পরিচালনা করতে পারেন।
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">কর্মকর্তা</h1>
        <Button onClick={openNew}>+ কর্মকর্তা যোগ করুন</Button>
      </div>

      {error && <ErrorText message={error} />}

      {showForm && (
        <Card>
          <CardTitle>{editing ? "কর্মকর্তা সম্পাদনা" : "নতুন কর্মকর্তা"}</CardTitle>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Field label="নাম *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="ইমেইল *">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Field>
            <Field label={editing ? "পাসওয়ার্ড (অপরিবর্তিত রাখতে খালি রাখুন)" : "পাসওয়ার্ড *"}>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editing}
              />
            </Field>
            <Field label="ভূমিকা">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="officer">কর্মকর্তা</option>
                <option value="admin">অ্যাডমিন</option>
              </Select>
            </Field>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={busy}>{busy ? "সংরক্ষণ হচ্ছে…" : editing ? "পরিবর্তন সংরক্ষণ" : "কর্মকর্তা তৈরি করুন"}</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                  setForm(emptyForm);
                }}
              >
                বাতিল
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <ul className="divide-y divide-slate-100">
          {officers.length === 0 && <li className="text-sm text-slate-500 py-3">এখনো কোনো কর্মকর্তা নেই।</li>}
          {officers.map((o) => (
            <li key={o.id} className="py-3 flex items-center justify-between gap-2">
              <div>
                <div className="font-medium text-sm">{o.name}</div>
                <div className="text-xs text-slate-500">{o.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                  {roleLabel(o.role)}
                </span>
                <div className="hidden sm:block text-[11px] text-slate-400">যোগ করা হয়েছে {formatDate(o.createdAt)}</div>
                <button type="button" title="সম্পাদনা" aria-label="সম্পাদনা" onClick={() => openEdit(o)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button type="button" title="মুছুন" aria-label="মুছুন" onClick={() => handleDelete(o)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}
