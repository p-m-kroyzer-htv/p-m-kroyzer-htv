"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Account } from "@/lib/subscriptions";
import { initial, whenIL } from "@/lib/format";
import { api, ApiError } from "./api";
import { toast } from "./Toast";
import { GoogleButton, IconRefresh } from "./ui";

interface Progress {
  total: number;
  done: number;
  pending: number;
  errors: number;
  found: number;
}

type Scan = { state: "running" | "done" | "failed"; read: number; total: number; found: number; message?: string };

const CONNECT_ERROR: Record<string, string> = {
  cancelled: "החיבור בוטל",
  state: "החיבור פג תוקף, נסה שוב",
  scope: "צריך לאשר את ההרשאה לקריאת Gmail",
  no_refresh: "Google לא החזיר הרשאה קבועה, נסה שוב",
  google: "Google לא אישר את החיבור, נסה שוב",
};

export function Inboxes({ accounts, lastScan }: { accounts: Account[]; lastScan: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [scan, setScan] = useState<Scan | null>(null);
  const [confirm, setConfirm] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const flashed = useRef(false);

  const runScan = useCallback(async () => {
    if (running.current) return;
    const targets = accounts.filter((a) => a.status === "connected");
    if (!targets.length) {
      toast(accounts.length ? "אין תיבה מחוברת לסריקה" : "קודם מחברים תיבת Gmail");
      return;
    }
    running.current = true;
    const totals = new Map<number, Progress>();
    const show = (state: Scan["state"], message?: string) => {
      const all = [...totals.values()];
      setScan({
        state,
        read: all.reduce((t, p) => t + p.done + p.errors, 0),
        total: all.reduce((t, p) => t + p.total, 0),
        found: all.reduce((t, p) => t + p.found, 0),
        message,
      });
    };
    show("running");
    let failed: string | undefined;
    for (const account of targets) {
      try {
        let p = await api<Progress>("/api/scan", "POST", { accountId: account.id, step: "queue" });
        totals.set(account.id, p);
        show("running");
        while (p.pending > 0) {
          p = await api<Progress>("/api/scan", "POST", { accountId: account.id, step: "batch" });
          totals.set(account.id, p);
          show("running");
        }
      } catch (err) {
        failed =
          err instanceof ApiError && err.body.reconnect
            ? `התיבה ${account.email} צריכה חיבור מחדש`
            : (err as Error).message;
      }
    }
    running.current = false;
    show(failed ? "failed" : "done", failed);
    const found = [...totals.values()].reduce((t, p) => t + p.found, 0);
    if (!failed) toast(found ? `נמצאו ${found} חיובים של מנויים` : "הסריקה הסתיימה");
    router.refresh();
  }, [accounts, router]);

  // Back from Google, or "סרוק עכשיו" from another screen.
  useEffect(() => {
    if (flashed.current) return;
    const connected = params.get("connected");
    const error = params.get("error");
    const wantScan = params.get("scan") === "1";
    if (!connected && !error && !wantScan) return;
    flashed.current = true;
    router.replace("/inboxes");
    if (error) toast(CONNECT_ERROR[error] ?? CONNECT_ERROR.google);
    if (connected) toast(`התיבה ${connected} חוברה`);
    if (connected || wantScan) void runScan();
  }, [params, router, runScan]);

  async function disconnect(account: Account) {
    setBusy(true);
    try {
      await api(`/api/accounts/${account.id}`, "DELETE");
      setConfirm(null);
      toast("התיבה נותקה");
      router.refresh();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setConfirm(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm]);

  const pct = scan && scan.total ? Math.round((scan.read / scan.total) * 100) : scan?.state === "running" ? 4 : 100;
  const lastScanText = whenIL(lastScan);

  return (
    <main className="wrap">
      <div className="head rv">
        <div>
          <h1>תיבות Gmail</h1>
          <p>המערכת קוראת קבלות והודעות חידוש בלבד, בקריאה בלבד</p>
        </div>
        <GoogleButton />
      </div>

      {scan && (
        <section className={`card scanp rv ${scan.state !== "running" ? "scan-done" : ""}`} style={{ "--i": 1 } as CSSProperties} aria-live="polite">
          <div className="big">
            <span className="spin" />
            <span>{scan.state === "running" ? "סורק את התיבות" : scan.state === "done" ? "הסריקה הסתיימה" : "הסריקה נעצרה"}</span>
          </div>
          <div className="prog">
            <i style={{ "--pp": `${pct}%` } as CSSProperties} />
          </div>
          <div className="st">
            <span>
              נקראו{" "}
              <b>
                <bdi className="num">{scan.read.toLocaleString("en-US")}</bdi> מתוך <bdi className="num">{scan.total.toLocaleString("en-US")}</bdi>
              </b>{" "}
              מיילים
            </span>
            <span>
              נמצאו{" "}
              <b>
                <bdi className="num">{scan.found}</bdi>
              </b>{" "}
              חיובים של מנויים
            </span>
          </div>
          {scan.state === "failed" && (
            <div className="acts">
              <span className="form-err">{scan.message}</span>
              <button className="btn" onClick={runScan}>
                <IconRefresh />
                נסה שוב
              </button>
            </div>
          )}
        </section>
      )}

      <div className="ibx" style={{ marginTop: 14 }}>
        {accounts.map((a, i) => {
          const bad = a.status === "needs_reconnect";
          return (
            <article className={`card ib ${bad ? "bad" : ""} rv`} key={a.id}>
              <div className="ib-h">
                <span className={`av ${i % 2 ? "b2" : ""}`}>{initial(a.email)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="em">{a.email}</div>
                  <small>{a.subs === 1 ? "מנוי אחד נמצא" : `${a.subs} מנויים נמצאו`}</small>
                </div>
                <span
                  className={`stchip ib-st ${bad ? "h" : ""}`}
                  style={bad ? { background: "var(--rare-bg)", color: "var(--rare)", border: 0 } : undefined}
                >
                  {bad ? "צריך לחבר מחדש" : "מחוברת"}
                </span>
              </div>
              <div className="ib-facts">
                <div>
                  <small>סריקה אחרונה</small>
                  <b>{a.last_scan_at ? <bdi>{whenIL(a.last_scan_at)}</bdi> : "עוד לא נסרקה"}</b>
                </div>
                <div>
                  <small>מיילים שנקראו</small>
                  <b>
                    <bdi className="num">{a.read.toLocaleString("en-US")}</bdi>
                  </b>
                </div>
              </div>
              <div className="acts">
                {bad && (
                  <a className="btn primary" href="/api/auth/google/start">
                    חבר מחדש
                  </a>
                )}
                <button className="btn danger-o" onClick={() => setConfirm(a)}>
                  נתק תיבה
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {accounts.length === 0 && <div className="none-found">עוד לא חוברה תיבה. החיבור עובר דרך מסך ההרשאה של Google.</div>}

      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn primary lg" onClick={runScan} disabled={scan?.state === "running" || !accounts.some((a) => a.status === "connected")}>
          <IconRefresh />
          סרוק עכשיו
        </button>
        {lastScanText && (
          <span style={{ color: "var(--ink3)", fontSize: 13 }}>
            סריקה אחרונה: <bdi>{lastScanText}</bdi>
          </span>
        )}
      </div>

      {confirm && (
        <div className="ov" onClick={(e) => e.target === e.currentTarget && !busy && setConfirm(null)}>
          <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="dt">
            <h3 id="dt">לנתק את התיבה?</h3>
            <p>
              <bdi className="ltr" style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
                {confirm.email}
              </bdi>
            </p>
            <p style={{ marginTop: 8 }}>
              הסריקה של התיבה הזו תיפסק. המנויים שכבר נמצאו נשארים ברשימה, ואפשר לחבר אותה שוב בכל רגע.
            </p>
            <div className="acts">
              <button className="btn lg" onClick={() => setConfirm(null)} disabled={busy} autoFocus>
                ביטול
              </button>
              <button className="btn ember lg" onClick={() => disconnect(confirm)} disabled={busy}>
                נתק תיבה
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
