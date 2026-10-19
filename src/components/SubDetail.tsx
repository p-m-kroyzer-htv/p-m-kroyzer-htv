"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Alternatives } from "@/lib/alternatives";
import type { Charge, Subscription } from "@/lib/subscriptions";
import {
  ALT_KIND,
  asUsage,
  bareUrl,
  CHARGE_TAG,
  dateIL,
  fmt,
  hrefOf,
  monthYear,
  originalParts,
  PERIOD_LABEL,
  USAGE_CLASS,
  USAGE_KEYS,
  USAGE_LABEL,
  type Usage,
} from "@/lib/format";
import { api } from "./api";
import { toast } from "./Toast";
import { Acct, Bars, IconExternal, IconRefresh, IconSearch, Mono, Money, Orig } from "./ui";

type AltState = "idle" | "loading" | "results" | "error";

const STATUS_CHIP: Record<string, [string, string]> = {
  active: ["פעיל", ""],
  cancelled: ["בוטל", "c"],
  ignored: ["הוסתר", "h"],
};

/** The charge whose amount went up from the one before it (same currency), latest first. */
function priceRise(charges: Charge[]) {
  const paid = charges.filter((c) => c.kind === "charge" && c.amount != null);
  for (let i = 0; i < paid.length - 1; i++) {
    const now = paid[i];
    const before = paid[i + 1];
    if ((now.currency ?? "ILS") === (before.currency ?? "ILS") && now.amount! > before.amount! + 0.005) {
      return { charge: now, from: before.amount!, to: now.amount!, currency: now.currency };
    }
  }
  return null;
}

export function SubDetail({
  initial,
  charges,
  accounts,
}: {
  initial: Subscription;
  charges: Charge[];
  accounts: string[];
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [alts, setAlts] = useState<Alternatives | null>(initial.alternatives);
  const [altState, setAltState] = useState<AltState>(initial.alternatives ? "results" : "idle");
  const [altError, setAltError] = useState("");
  const [progress, setProgress] = useState(8);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const altAcct = (email: string) => accounts.indexOf(email) % 2 === 1;

  async function patch(body: Partial<Pick<Subscription, "usage" | "status" | "notes">>, done: string) {
    try {
      const res = await api<{ subscription: Subscription }>(`/api/subscriptions/${s.id}`, "PATCH", body);
      setS(res.subscription);
      toast(done);
      router.refresh();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  async function findAlternatives() {
    setAltState("loading");
    setProgress(8);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setProgress((p) => Math.min(96, p + 3)), 1500);
    try {
      const res = await api<Alternatives>(`/api/subscriptions/${s.id}/alternatives`, "POST");
      setAlts(res);
      setAltState("results");
    } catch (err) {
      setAltError((err as Error).message);
      setAltState("error");
    } finally {
      if (timer.current) clearInterval(timer.current);
    }
  }

  const usage = asUsage(s.usage);
  const [stText, stCls] = STATUS_CHIP[s.status] ?? STATUS_CHIP.active;
  const rise = priceRise(charges);
  const history = charges.filter((c) => c.amount != null);
  const list = alts?.alternatives ?? [];
  const bestSaving = Math.max(0, ...list.map((a) => a.saving_ils_monthly ?? 0));
  const checked = alts?.checked_at ? dateIL(alts.checked_at) : "";
  const originalOf = (c: Charge) => originalParts(c.amount!, c.currency);

  let altBody;
  if (altState === "idle") {
    altBody = (
      <div className="altbox idle">
        <p>בדיקה חיה ברשת של מחירים ומתחרים. לוקחת בין חצי דקה לדקה.</p>
        <button className="btn primary lg" onClick={findAlternatives}>
          <IconSearch />
          מצא חלופות
        </button>
      </div>
    );
  } else if (altState === "loading") {
    altBody = (
      <div className="altbox">
        <div className="ld-top">
          <span className="spin" />
          בודק מחירים... <small>עד דקה, אפשר להישאר במסך</small>
        </div>
        <div className="prog">
          <i style={{ "--pp": `${progress}%` } as CSSProperties} />
        </div>
        <div className="sk-row">
          {[0, 1].map((k) => (
            <div className="sk" key={k}>
              <i />
              <i />
              <i />
              <i />
            </div>
          ))}
        </div>
      </div>
    );
  } else if (altState === "error") {
    altBody = (
      <div className="altbox err">
        <p>{altError || "לא הצלחתי לבדוק חלופות כרגע, אפשר לנסות שוב"}</p>
        <button className="btn lg" onClick={findAlternatives}>
          <IconRefresh />
          נסה שוב
        </button>
      </div>
    );
  } else if (!list.length) {
    altBody = (
      <div className="altbox idle">
        <p>לא נמצאה חלופה זולה יותר למנוי הזה.</p>
        <span className="checked">
          נבדק ב-<bdi className="num">{checked}</bdi>
        </span>
        <button className="btn ghost" onClick={findAlternatives}>
          בדוק שוב
        </button>
      </div>
    );
  } else {
    altBody = (
      <>
        <div className="alts">
          {list.map((a, i) => {
            const kind = ALT_KIND[a.kind] ?? ALT_KIND.competitor;
            const best = bestSaving > 0 && (a.saving_ils_monthly ?? 0) === bestSaving && list.findIndex((x) => (x.saving_ils_monthly ?? 0) === bestSaving) === i;
            return (
              <article className={`alt ${best ? "best" : ""}`} key={`${a.name}-${i}`}>
                {best && <span className="bestlbl">החיסכון הגדול ביותר</span>}
                <div className="alt-h">
                  <div>
                    <b>{a.name}</b>
                    <span className={`atype ${kind.cls}`}>{kind.label}</span>
                  </div>
                  {a.price_ils_monthly != null && (
                    <div className="alt-p">
                      {a.price_ils_monthly === 0 ? (
                        <>
                          0 <span className="cur">₪</span>
                        </>
                      ) : (
                        <Money value={a.price_ils_monthly} />
                      )}
                      <small>לחודש</small>
                    </div>
                  )}
                </div>
                {a.saving_ils_monthly != null && a.saving_ils_monthly > 0 && (
                  <span className="save">
                    חיסכון{" "}
                    <bdi className="num">
                      {fmt(a.saving_ils_monthly)}
                      <span className="cur">₪</span>
                    </bdi>{" "}
                    לחודש
                  </span>
                )}
                <p>{a.why}</p>
                {a.catch && (
                  <div className="give">
                    <em>מוותרים על:</em>
                    {a.catch}
                  </div>
                )}
                {a.url && (
                  <a href={hrefOf(a.url)} target="_blank" rel="noopener noreferrer">
                    <IconExternal />
                    <bdi className="ltr">{bareUrl(a.url)}</bdi>
                  </a>
                )}
              </article>
            );
          })}
        </div>
        <div className="acts">
          <span className="checked">
            נבדק ב-<bdi className="num">{checked}</bdi>
          </span>
          <button className="btn ghost" onClick={findAlternatives}>
            בדוק שוב
          </button>
        </div>
      </>
    );
  }

  return (
    <main className="wrap">
      <div className="crumb rv">
        <Link href="/">לוח מנויים</Link>
        <span>/</span>
        <span>{s.name}</span>
      </div>
      <article className="card dr rv" style={{ "--i": 1 } as CSSProperties}>
        <div className="dr-h">
          <Mono name={s.name} vendor={s.vendor} />
          <div>
            <h2>{s.name}</h2>
            <div className="sub">{[s.vendor, s.category, s.plan].filter(Boolean).join(" · ")}</div>
          </div>
          <span className="sp" />
          <span className={`stchip ${stCls}`}>{stText}</span>
        </div>
        <div className="dr-grid">
          <div className="dr-col">
            <div className="h3">שימוש</div>
            <div className="useseg" role="group" aria-label="רמת שימוש">
              {USAGE_KEYS.map((k: Usage) => (
                <button
                  key={k}
                  data-s={USAGE_CLASS[k]}
                  aria-pressed={usage === k}
                  onClick={() => k !== usage && patch({ usage: k }, `סומן: ${USAGE_LABEL[k]}`)}
                >
                  <Bars />
                  {USAGE_LABEL[k]}
                </button>
              ))}
            </div>
            {rise && (
              <div className="alert">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2l7 12H1L8 2z" />
                  <path d="M8 6.5v3.5M8 12h.01" />
                </svg>
                <span>
                  המחיר עלה מ-<Orig amount={rise.from} currency={rise.currency} /> ל-<Orig amount={rise.to} currency={rise.currency} />
                  {rise.charge.charge_date ? ` ב${monthYear(rise.charge.charge_date)}` : ""}.
                </span>
              </div>
            )}
            <div className="h3">פרטי המנוי</div>
            <div className="facts">
              <div>
                <small>חיוב אחרון</small>
                <b>{s.lastAmount == null ? "לא ידוע" : <Orig amount={s.lastAmount} currency={s.lastCurrency} />}</b>
              </div>
              <div>
                <small>לחודש</small>
                <b>{s.monthlyIls ? <Money value={s.monthlyIls} /> : "לא ידוע"}</b>
              </div>
              <div>
                <small>לשנה</small>
                <b>{s.monthlyIls ? <Money value={s.monthlyIls * 12} /> : "לא ידוע"}</b>
              </div>
              <div>
                <small>תדירות</small>
                <b>{PERIOD_LABEL[s.period] ?? "לא ידוע"}</b>
              </div>
              <div>
                <small>חיוב אחרון, תאריך</small>
                <b>{s.lastChargeDate ? <bdi className="num">{dateIL(s.lastChargeDate)}</bdi> : "לא ידוע"}</b>
              </div>
              <div>
                <small>חידוש הבא</small>
                <b>
                  {s.nextRenewalDate ? (
                    <>
                      <bdi className="num">{dateIL(s.nextRenewalDate)}</bdi>
                      {s.nextRenewalEstimated ? " (משוער)" : ""}
                    </>
                  ) : s.status === "cancelled" ? (
                    "בוטל"
                  ) : (
                    "לא ידוע"
                  )}
                </b>
              </div>
              <div>
                <small>משתמשים</small>
                <b>{!s.seats ? "לא ידוע" : s.seats === 1 ? "משתמש אחד" : `${s.seats} משתמשים`}</b>
              </div>
              <div className="l">
                <small>קטגוריה</small>
                <b>{s.category || "ללא קטגוריה"}</b>
              </div>
              <div className="wide">
                <small>נמצא בתיבה</small>
                <b className="sm">
                  {s.accounts.map((a, i) => (
                    <span key={a}>
                      {i > 0 && ", "}
                      <bdi>{a}</bdi>
                    </span>
                  ))}
                </b>
              </div>
            </div>
            {s.manage_url && (
              <a className="btn primary lg vendor" href={hrefOf(s.manage_url)} target="_blank" rel="noopener noreferrer">
                <IconExternal />
                ניהול או ביטול אצל הספק
              </a>
            )}
            <div className="acts" style={{ marginTop: 0, marginBottom: 22 }}>
              <button
                className="btn"
                onClick={() =>
                  s.status === "cancelled"
                    ? patch({ status: "active" }, "הוחזר לפעילים")
                    : patch({ status: "cancelled" }, "סומן כבוטל")
                }
              >
                {s.status === "cancelled" ? "החזר לפעיל" : "ביטלתי"}
              </button>
              <button
                className="btn ghost"
                onClick={() =>
                  s.status === "ignored"
                    ? patch({ status: "active" }, "המנוי חזר")
                    : patch({ status: "ignored" }, "המנוי הוסתר מהרשימה")
                }
              >
                {s.status === "ignored" ? "החזר לרשימה" : "זה לא מנוי"}
              </button>
            </div>
            <div className="h3">הערות</div>
            <textarea aria-label="הערות" placeholder="הערה חופשית על המנוי" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="acts">
              <button className="btn" disabled={notes === (s.notes ?? "")} onClick={() => patch({ notes: notes.trim() || null }, "ההערה נשמרה")}>
                שמור הערה
              </button>
            </div>
          </div>
          <div className="dr-col">
            <div className="h3">
              חלופות{" "}
              {altState === "results" && list.length > 0 && (
                <span className="checked">
                  נבדק ב-<bdi className="num">{checked}</bdi>
                </span>
              )}
            </div>
            <div style={{ marginBottom: 22 }}>{altBody}</div>
            <div className="h3">היסטוריית חיובים</div>
            <div className="hist">
              {history.length ? (
                <>
                  <div className="hrow hh">
                    <span>תאריך</span>
                    <span>סכום</span>
                    <span style={{ textAlign: "end" }}>בשקלים</span>
                  </div>
                  {history.map((c) => {
                    const tag = c.id === rise?.charge.id ? "עליית מחיר" : CHARGE_TAG[c.kind];
                    return (
                      <div className="hrow" key={c.id}>
                        <bdi className="num">{dateIL(c.charge_date) || "לא ידוע"}</bdi>
                        <span className="amt">
                          <Orig amount={c.amount!} currency={c.currency} />
                          <small>{originalOf(c).code}</small>
                        </span>
                        <span className="amt" style={{ textAlign: "end" }}>
                          {c.amount_ils != null ? <Money value={c.amount_ils} /> : "לא ידוע"}
                          {tag && <span className="tagp">{tag}</span>}
                        </span>
                        <Acct email={c.account_email} alt={altAcct(c.account_email)} style={{ gridColumn: "1/-1", fontSize: "11.5px" }} />
                        {c.subject && (
                          <span className="subj" style={{ gridColumn: "1/-1", textAlign: "start" }} title={c.subject}>
                            {c.subject}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="none-found" style={{ padding: 14 }}>
                  עוד לא נמצאו חיובים עם סכום
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
