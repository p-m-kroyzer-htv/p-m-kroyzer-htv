"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res?.ok) {
      router.replace("/");
      router.refresh();
      return;
    }
    const json = res ? await res.json().catch(() => ({})) : {};
    setError(json.error || "אין חיבור לשרת, אפשר לנסות שוב");
    setBusy(false);
  }

  return (
    <main className="login">
      <form className="card lcard rv" onSubmit={submit} style={{ "--i": 0 } as CSSProperties}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lg" src="/icon.svg" alt="" />
        <h1>מנויומטר</h1>
        <p>כניסה לבעל המערכת</p>
        <div className="field">
          <label htmlFor="pw">סיסמה</label>
          <div className="pw">
            <input
              id="pw"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" aria-label={show ? "הסתר סיסמה" : "הצג סיסמה"} onClick={() => setShow(!show)}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z" />
                <circle cx="10" cy="10" r="2.5" />
              </svg>
            </button>
          </div>
        </div>
        {error && <div className="form-err">{error}</div>}
        <button className="btn primary lg" style={{ width: "100%" }} disabled={busy || !password}>
          {busy ? "נכנס..." : "כניסה"}
        </button>
        <div className="foot">כלי אישי, משתמש אחד</div>
      </form>
    </main>
  );
}
