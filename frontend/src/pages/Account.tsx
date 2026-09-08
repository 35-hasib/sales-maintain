import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type { Officer } from "../lib/types";
import { Card, CardTitle, Button, Input, Field, ErrorText, Spinner } from "../components/ui";
import { formatDate } from "../lib/format";

const roleLabel = (role: string) => (role === "admin" ? "অ্যাডমিন" : "কর্মকর্তা");

export default function Account() {
  const { officer, updateOfficer, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(officer?.name ?? "");
  const [phone, setPhone] = useState(officer?.phone ?? "");
  const [email, setEmail] = useState(officer?.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  if (!officer) return null;
  const me = officer;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const payload: Record<string, string> = { name };
      if (email.trim()) payload.email = email.trim();
      if (phone.trim()) payload.phone = phone.trim();
      if (!payload.email && !payload.phone) {
        setError("ইমেইল বা মোবাইল নম্বর — যেকোনো একটি দিতে হবে");
        setBusy(false);
        return;
      }
      if (password) {
        if (password.length < 6) {
          setError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
          setBusy(false);
          return;
        }
        payload.password = password;
      }
      const d = await api.put<{ officer: Officer }>(`/api/auth/${me.id}`, payload);
      updateOfficer(d.officer);
      setPassword("");
      setMsg("আপনার তথ্য আপডেট হয়েছে।");
    } catch (err: any) {
      setError(err?.message || "সংরক্ষণ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    if (!window.confirm("আপনি কি নিশ্চিত? আপনার নামে থাকা সব লেনদেন, ব্যবসায়ীর তথ্য ও খাতার হিসাব চিরতরে মুছে যাবে।")) return;
    setDeleting(true);
    setError("");
    setMsg("");
    api
      .del(`/api/auth/${me.id}`)
      .then(() => {
        logout();
        navigate("/login");
      })
      .catch((err: any) => {
        setError(err?.message || "আপনার হিসাব মোছা যায়নি");
        setDeleting(false);
      });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">আমার হিসাব</h1>

      {error && <ErrorText message={error} />}
      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg p-3">
          {msg}
        </div>
      )}

      <Card>
        <CardTitle>প্রোফাইল</CardTitle>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Field label="নাম *">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="মোবাইল নম্বর">
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="017XXXXXXXX" />
          </Field>
          <Field label="ইমেইল">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@example.com" />
          </Field>
          <p className="text-xs text-slate-400 -mt-1 sm:col-span-2">ইমেইল বা মোবাইল নম্বর — যেকোনো একটি দিতে হবে</p>
          <Field label="নতুন পাসওয়ার্ড (খালি রাখলে অপরিবর্তিত)">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="অন্তত ৬ অক্ষর" />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? <span className="inline-flex items-center gap-2"><Spinner size={3} light />সংরক্ষণ</span> : "সংরক্ষণ"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>হিসাবের তথ্য</CardTitle>
        <dl className="divide-y divide-slate-100 text-sm">
          <div className="py-2 flex items-center justify-between gap-2">
            <dt className="text-slate-500">ভূমিকা</dt>
            <dd className="font-medium">{roleLabel(me.role)}</dd>
          </div>
          {me.createdAt ? (
            <div className="py-2 flex items-center justify-between gap-2">
              <dt className="text-slate-500">যোগদানের তারিখ</dt>
              <dd className="font-medium">{formatDate(me.createdAt)}</dd>
            </div>
          ) : null}
          <div className="py-2 flex items-center justify-between gap-2">
            <dt className="text-slate-500">মোবাইল</dt>
            <dd className="font-medium">{me.phone ?? "—"}</dd>
          </div>
          <div className="py-2 flex items-center justify-between gap-2">
            <dt className="text-slate-500">ইমেইল</dt>
            <dd className="font-medium">{me.email ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card className="border-red-200">
        <CardTitle>ঝুঁকিপূর্ণ অঞ্চল</CardTitle>
        <p className="text-sm text-slate-500 mb-3">
          আপনার হিসাব মুছে দিলে আপনার সব লেনদেন ও ব্যবসায়ীর তথ্য মুছে যাবে। এ কাজ ফেরানো যাবে না।
        </p>
        <Button variant="danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? <span className="inline-flex items-center gap-2"><Spinner size={3} light />মোছা হচ্ছে…</span> : "আমার হিসাব মুছুন"}
        </Button>
      </Card>
    </div>
  );
}