import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Input, Field, ErrorText, Spinner } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const officer = await login(identifier, password);
      navigate(officer.role === "admin" ? "/officers" : "/");
    } catch (err: any) {
      setError(err?.message || "লগইন ব্যর্থ হয়েছে");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-emerald-700">SalesMaintain</h1>
        <p className="text-center text-sm text-slate-500 mt-1 mb-6">
          টাকার হিসাব · {new Date().getFullYear()}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="ইমেইল বা মোবাইল">
            <Input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="hello@example.com অথবা 017XXXXXXXX"
              autoComplete="username"
              required
            />
          </Field>
          <Field label="পাসওয়ার্ড">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>
          <ErrorText message={error} />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <span className="inline-flex items-center gap-2"><Spinner size={3} light />লগইন</span> : "লগইন"}
          </Button>
        </form>
      </div>
    </div>
  );
}
