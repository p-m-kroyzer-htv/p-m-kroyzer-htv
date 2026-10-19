"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import type { Account, Subscription } from "@/lib/subscriptions";
import {
  asUsage,
  dateIL,
  daysUntil,
  fmt,
  isLeak,
  METER_ORDER,
  monthShort,
  PER_LABEL,
  shortEmail,
  USAGE_CLASS,
  USAGE_KEYS,
  USAGE_LABEL,
  type Usage,
} from "@/lib/format";
import { api } from "./api";
import { toast } from "./Toast";
import { Acct, Bars, IconArrowBack, IconWarn, Mono, Money, Orig } from "./ui";

type StatusTab = "active" | "cancelled" | "ignored";
type Sort = "cost" | "renew" | "name" | "last";

interface Props {
  initial: Subscription[];
  accounts: Account[];
  today: string;
  usdRate: number | null;
}

export function Dashboard({ initial, accounts, today, usdRate }: Props) {
  const router = useRouter();
  const [subs, setSubs] = useState(initial);
  const [status, setStatus] = useState<StatusTab>("active");
  const [inbox, setInbox] = useState("all");
  const [cat, setCat] = useState("all");
  const [use, setUse] = useState("all");
  const [sort, setSort] = useState<Sort>("cost");

  const open = (id: number) => router.push(`/subscriptions/${id}`);
  const altAcct = (email: string) => accounts.findIndex((a) => a.email === email) % 2 === 1;

  async function changeUsage(id: number, usage: Usage) {
    const before = subs;
    setSubs((list) => list.map((s) => (s.id === id ? { ...s, usage } : s)));
    try {
      await api(`/api/subscriptions/${id}`, "PATCH", { usage });
    } catch (err) {
      setSubs(before);
      toast((err as Error).message);
    }
  }

  const active = subs.filter((s) => s.status === "active");
  const priced = active.filter((s) => s.monthlyIls != null && s.monthlyIls > 0);
  const m = (s: Subscription) => s.monthlyIls ?? 0;
  const total = priced.reduce((t, s) => t + m(s), 0);
  const leakSubs = active.filter((s) => isLeak(s.usage));
  const leak = leakSubs.reduce((t, s) => t + m(s), 0);
  const noPrice = active.filter((s) => !s.monthlyIls);
  const anyMarked = active.some((s) => s.usage !== "unknown");
  const counts = {
    active: active.length,
    cancelled: subs.filter((s) => s.status === "cancelled").length,
    ignored: subs.filter((s) => s.status === "ignored").length,
  };
  const needReconnect = accounts.filter((a) => a.status === "needs_reconnect");

  // leak meter: the leak group first, then the rest, each ordered by usage then size
  const sorted = [...priced].sort(
    (a, b) => METER_ORDER.indexOf(asUsage(a.usage)) - METER_ORDER.indexOf(asUsage(b.usage)) || m(b) - m(a),
  );
  const meterLeak = sorted.filter((s) => isLeak(s.usage));
  const meterOk = sorted.filter((s) => !isLeak(s.usage));
  const okTotal = total - leak;
  const byUsage = (u: Usage) => active.filter((s) => s.usage === u).reduce((t, s) => t + m(s), 0);

  const segment = (s: Subscription) => {
    const share = m(s) / total;
    const u = asUsage(s.usage);
    return (
      <button
        key={s.id}
        className={`mseg s-${USAGE_CLASS[u]}`}
        style={{ "--w": m(s) } as CSSProperties}
        title={`${s.name}: ${fmt(m(s))} ₪, ${USAGE_LABEL[u]}`}
        aria-label={`${s.name}, ${fmt(m(s))} שקלים לחודש, ${USAGE_LABEL[u]}`}
        onClick={() => open(s.id)}
      >
        {share > 0.07 && <span className={`nm ${share > 0.16 ? "" : "l1"}`}>{s.name.split(" ")[0]}</span>}
      </button>
    );
  };

  // renewals in the coming 30 days
  const renewals = active
    .filter((s) => s.nextRenewalDate && daysUntil(s.nextRenewalDate, today) >= 0 && daysUntil(s.nextRenewalDate, today) <= 30)
    .sort((a, b) => a.nextRenewalDate!.localeCompare(b.nextRenewalDate!));
  const renewalsIls = renewals.reduce((t, s) => t + (s.lastAmountIls ?? 0), 0);

  // list
  const categories = useMemo(() => [...new Set(subs.map((s) => s.category || "ללא קטגוריה"))], [subs]);
  const inboxes = useMemo(
    () => [...new Set([...accounts.map((a) => a.email), ...subs.flatMap((s) => s.accounts)])],
    [accounts, subs],
  );
  const inTab = subs.filter((s) => s.status === status);
  let list = inTab;
  if (inbox !== "all") list = list.filter((s) => s.accounts.includes(inbox));
  if (cat !== "all") list = list.filter((s) => (s.category || "ללא קטגוריה") === cat);
  if (use === "leak") list = list.filter((s) => isLeak(s.usage));
  else if (use !== "all") list = list.filter((s) => s.usage === use);
  const far = "9999-12-31";
  const compare: Record<Sort, (a: Subscription, b: Subscription) => number> = {
    cost: (a, b) => m(b) - m(a),
    renew: (a, b) => (a.nextRenewalDate ?? far).localeCompare(b.nextRenewalDate ?? far),
    name: (a, b) => a.name.localeCompare(b.name, "en"),
    last: (a, b) => (b.lastChargeDate ?? "").localeCompare(a.lastChargeDate ?? ""),
  };
  list = [...list].sort(compare[sort]);
  const filtered = inbox !== "all" || cat !== "all" || use !== "all";
  const maxM = Math.max(1, ...subs.map(m));
  const listTotal = list.reduce((t, s) => t + m(s), 0);

  const reviewLeak = () => {
    setUse("leak");
    setStatus("active");
    document.getElementById("lh")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const costCell = (s: Subscription) =>
    !s.monthlyIls ? (
      <span className="nop">מחיר לא ידוע</span>
    ) : (
      <div className="mcost">
        <span>
          <Money value={s.monthlyIls} />
        </span>
        <i className={isLeak(s.usage) ? "w" : ""} style={{ "--w": `${Math.max(6, (s.monthlyIls / maxM) * 46)}px` } as CSSProperties} />
      </div>
    );

  const soon = (s: Subscription) => {
    if (!s.nextRenewalDate) return null;
    const d = daysUntil(s.nextRenewalDate, today);
    return d >= 0 && d <= 30 ? d : null;
  };

  const noRenewal = (s: Subscription) => (
    <span className="cancelled-tag">{s.status === "cancelled" ? "בוטל" : s.status === "ignored" ? "הוסתר" : "אין תאריך חידוש"}</span>
  );

  const usageChip = (s: Subscription) => {
    const u = asUsage(s.usage);
    return (
      <label className="use" data-s={USAGE_CLASS[u]} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <Bars />
        <select aria-label={`שימוש ב-${s.name}`} value={u} onChange={(e) => changeUsage(s.id, e.target.value as Usage)}>
          {USAGE_KEYS.map((k) => (
            <option key={k} value={k}>
              {USAGE_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
    );
  };

  const origLine = (s: Subscription) =>
    s.lastAmount != null ? (
      <>
        <Orig amount={s.lastAmount} currency={s.lastCurrency} /> {PER_LABEL[s.period] ?? ""}
      </>
    ) : null;

  const rowKey = (id: number) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") open(id);
  };

  return (
    <main className="wrap">
      <div className="head rv">
        <div>
          <h1>לוח מנויים</h1>
          <p>
            {active.length} מנויים פעילים, מ-{accounts.length === 1 ? "תיבת Gmail אחת" : `${accounts.length} תיבות Gmail`}
          </p>
        </div>
        <div className="today">
          היום, <bdi className="num">{dateIL(today)}</bdi>
          {usdRate && (
            <>
              {" "}
              &nbsp;·&nbsp; שער לחישוב <bdi className="num">$1 = {usdRate.toFixed(2)} ₪</bdi>
            </>
          )}
        </div>
      </div>

      {needReconnect.map((a) => (
        <div className="banner" key={a.id}>
          <IconWarn />
          <span>
            התיבה{" "}
            <bdi className="ltr" style={{ fontFamily: "var(--mono)", fontSize: "12.5px" }}>
              {a.email}
            </bdi>{" "}
            צריכה חיבור מחדש, הסריקה שלה מושהית.
          </span>
          <Link href="/inboxes">חבר מחדש</Link>
        </div>
      ))}

      <section className="leak rv" style={{ "--i": 1, marginTop: 14 } as CSSProperties} aria-label="דליפה">
        <div className="leak-top">
          <div>
            <div className="lbl">
              <i />
              משלם על מה שלא בשימוש
            </div>
            <div className="val">
              <Money value={leak} curSize=".45em" />
              <span className="per">לחודש</span>
            </div>
            <div className="sub">
              <b>
                <Money value={leak * 12} /> בשנה
              </b>{" "}
              {leakSubs.length ? (
                <>
                  על{" "}
                  {leakSubs.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 && ", "}
                      <bdi>{s.name}</bdi>
                    </span>
                  ))}
                </>
              ) : anyMarked ? (
                "אין דליפה כרגע"
              ) : (
                "סמן כמה אתה משתמש בכל מנוי, וכאן יופיע מה שהולך לפח"
              )}
            </div>
          </div>
          {leakSubs.length > 0 && (
            <button className="btn ember cta" onClick={reviewLeak}>
              סקור {leakSubs.length} מנויים
              <IconArrowBack />
            </button>
          )}
        </div>
        {total > 0 && (
          <div className="mwrap">
            <div className="meter" role="img" aria-label="פילוח ההוצאה החודשית לפי רמת שימוש">
              {meterLeak.length > 0 && (
                <div className="mgrp lk" style={{ flex: `${leak} 1 0` }}>
                  <span className="mcap">
                    דליפה, <bdi className="num">{fmt(leak)} ₪</bdi> ({Math.round((leak / total) * 100)}%)
                  </span>
                  {meterLeak.map(segment)}
                </div>
              )}
              {meterOk.length > 0 && (
                <div className="mgrp ok" style={{ flex: `${okTotal} 1 0` }}>
                  <span className="mcap">
                    בשימוש או לא סומן, <bdi className="num">{fmt(okTotal)} ₪</bdi>
                  </span>
                  {meterOk.map(segment)}
                </div>
              )}
            </div>
            <div className="mleg">
              {METER_ORDER.map((u) => (
                <span key={u}>
                  <i className={`s-${USAGE_CLASS[u]}`} />
                  {USAGE_LABEL[u]}{" "}
                  <b>
                    <bdi className="num">{fmt(byUsage(u))}</bdi>
                  </b>
                </span>
              ))}
            </div>
          </div>
        )}
        {noPrice.length > 0 && (
          <div className="mnote">
            <span>
              {noPrice.length === 1 ? "מנוי אחד" : `${noPrice.length} מנויים`} ללא מחיר ידוע (
              <bdi>{noPrice.map((s) => s.name).join(", ")}</bdi>) לא {noPrice.length === 1 ? "נכנס" : "נכנסים"} לחישוב.
            </span>
            <Link href={`/subscriptions/${noPrice[0].id}`}>לפרטי המנוי</Link>
          </div>
        )}
      </section>

      <section className="kpis" aria-label="סיכום">
        <div className="kpi rv" style={{ "--i": 2 } as CSSProperties}>
          <div className="lbl">סך עלות חודשית</div>
          <div className="val">
            <Money value={total} curSize=".55em" />
          </div>
          <div className="sub">{usdRate ? `כולל המרת דולר לפי ${usdRate.toFixed(2)}` : "בשקלים, לפי שער בנק ישראל"}</div>
        </div>
        <div className="kpi rv" style={{ "--i": 3 } as CSSProperties}>
          <div className="lbl">סך עלות שנתית</div>
          <div className="val">
            <Money value={total * 12} curSize=".55em" />
          </div>
          <div className="sub">צפי ל-12 חודשים קדימה</div>
        </div>
        <div className="kpi k3 rv" style={{ "--i": 4 } as CSSProperties}>
          <div className="lbl">מנויים פעילים</div>
          <div className="val">{active.length}</div>
          <div className="sub">
            {noPrice.length > 0 && (
              <>
                <b style={{ color: "var(--rare)" }}>{noPrice.length} ללא מחיר ידוע</b> ·{" "}
              </>
            )}
            בוטלו עד היום: <bdi className="num">{counts.cancelled}</bdi>
          </div>
        </div>
      </section>

      <section className="card sec rv" style={{ "--i": 5 } as CSSProperties} aria-labelledby="rh">
        <div className="card-h">
          <h2 id="rh">חידושים ב-30 הימים הקרובים</h2>
          <span className="meta">
            {renewals.length ? (
              <>
                {renewals.length === 1 ? "חידוש אחד" : `${renewals.length} חידושים`}, סה&quot;כ <Money value={renewalsIls} />
              </>
            ) : (
              "אין חידושים בחודש הקרוב"
            )}
          </span>
        </div>
        {renewals.length > 0 && (
          <div className="ren">
            {renewals.map((s) => {
              const d = daysUntil(s.nextRenewalDate!, today);
              return (
                <button key={s.id} className={`rn ${d <= 7 ? "soon" : ""} ${isLeak(s.usage) ? "warn" : ""}`} onClick={() => open(s.id)}>
                  <span className="d">
                    <b>
                      <bdi className="num">{Number(s.nextRenewalDate!.slice(8, 10))}</bdi>
                    </b>
                    <small>{monthShort(s.nextRenewalDate!)}</small>
                  </span>
                  <span className="t">
                    <b>{s.name}</b>
                    <small>
                      {s.lastAmount != null ? <Orig amount={s.lastAmount} currency={s.lastCurrency} /> : "מחיר לא ידוע"} ·{" "}
                      {d === 0 ? "היום" : d === 1 ? "מחר" : `בעוד ${d} ימים`}
                      {s.nextRenewalEstimated ? ", משוער" : ""}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="card sec rv" style={{ "--i": 6 } as CSSProperties} aria-labelledby="lh">
        <div className="card-h">
          <h2 id="lh">כל המנויים</h2>
        </div>
        <div className="toolbar">
          <div className="seg">
            {(
              [
                ["active", "פעילים"],
                ["cancelled", "בוטלו"],
                ["ignored", "הוסתרו"],
              ] as [StatusTab, string][]
            )
              .filter(([k]) => k !== "ignored" || counts.ignored > 0 || status === "ignored")
              .map(([k, label]) => (
                <button key={k} aria-pressed={status === k} onClick={() => setStatus(k)}>
                  {label}
                  <span className="ct">
                    <bdi className="num">{counts[k]}</bdi>
                  </span>
                </button>
              ))}
          </div>
          <div className="sel">
            <select aria-label="תיבה" className={inbox !== "all" ? "act" : ""} value={inbox} onChange={(e) => setInbox(e.target.value)}>
              <option value="all">כל התיבות</option>
              {inboxes.map((e) => (
                <option key={e} value={e}>
                  {shortEmail(e)}
                </option>
              ))}
            </select>
          </div>
          <div className="sel">
            <select aria-label="קטגוריה" className={cat !== "all" ? "act" : ""} value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="all">כל הקטגוריות</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="sel">
            <select aria-label="שימוש" className={use !== "all" ? "act" : ""} value={use} onChange={(e) => setUse(e.target.value)}>
              <option value="all">כל רמות השימוש</option>
              <option value="leak">דליפה (לא משתמש ולעיתים רחוקות)</option>
              {USAGE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {USAGE_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="sel">
            <select aria-label="מיון" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="cost">מיון: עלות חודשית</option>
              <option value="renew">מיון: חידוש קרוב</option>
              <option value="name">מיון: שם</option>
              <option value="last">מיון: חיוב אחרון</option>
            </select>
          </div>
          {filtered && (
            <button
              className="clear"
              onClick={() => {
                setInbox("all");
                setCat("all");
                setUse("all");
              }}
            >
              נקה סינון
            </button>
          )}
          <span className="tb-count">{list.length} מנויים</span>
        </div>

        {list.length === 0 ? (
          <div className="none-found">{inTab.length ? "אין מנויים שמתאימים לסינון" : "אין כאן מנויים"}</div>
        ) : (
          <>
            <div className="rows">
              {list.map((s) => {
                const d = soon(s);
                return (
                  <div className="srow" key={s.id} tabIndex={0} role="link" onClick={() => open(s.id)} onKeyDown={rowKey(s.id)}>
                    <Mono name={s.name} vendor={s.vendor} />
                    <div className="main">
                      <b>{s.name}</b>
                      <small>
                        {s.vendor}
                        {s.category ? ` · ${s.category}` : ""}
                        {s.seats && s.seats > 1 ? ` · ${s.seats} משתמשים` : ""}
                      </small>
                    </div>
                    <div className="cost">
                      {costCell(s)}
                      {s.lastAmount != null && (
                        <div style={{ textAlign: "end", color: "var(--ink3)", fontSize: "11.5px", marginTop: 2 }}>{origLine(s)}</div>
                      )}
                    </div>
                    <div className="rn2">
                      {s.nextRenewalDate ? (
                        <>
                          חידוש <bdi className="num">{dateIL(s.nextRenewalDate)}</bdi> <em>{d != null ? `בעוד ${d} ימים` : ""}</em>
                        </>
                      ) : (
                        noRenewal(s)
                      )}
                    </div>
                    {usageChip(s)}
                    {s.accounts[0] ? <Acct email={s.accounts[0]} alt={altAcct(s.accounts[0])} /> : <span />}
                  </div>
                );
              })}
            </div>
            <table className="t">
              <thead>
                <tr>
                  <th>שירות</th>
                  <th>קטגוריה</th>
                  <th className="r">מחיר</th>
                  <th className="r">לחודש</th>
                  <th>חיוב אחרון</th>
                  <th>חידוש הבא</th>
                  <th>תיבה</th>
                  <th>שימוש</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const d = soon(s);
                  return (
                    <tr key={s.id} onClick={() => open(s.id)} tabIndex={0} onKeyDown={rowKey(s.id)}>
                      <td>
                        <div className="svc">
                          <Mono name={s.name} vendor={s.vendor} />
                          <div>
                            <b>{s.name}</b>
                            <small>
                              {s.vendor}
                              {s.seats && s.seats > 1 ? ` · ${s.seats} משתמשים` : ""}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: "var(--ink2)" }}>{s.category || "ללא קטגוריה"}</td>
                      <td className="r">
                        {s.lastAmount == null ? (
                          <span style={{ color: "var(--ink3)" }}>לא ידוע</span>
                        ) : (
                          <>
                            <Orig amount={s.lastAmount} currency={s.lastCurrency} />{" "}
                            <small style={{ color: "var(--ink3)", fontSize: 12 }}>{PER_LABEL[s.period] ?? ""}</small>
                          </>
                        )}
                      </td>
                      <td className="r">{costCell(s)}</td>
                      <td className="dt">
                        <bdi className="num">{dateIL(s.lastChargeDate) || "לא ידוע"}</bdi>
                      </td>
                      <td>
                        {s.nextRenewalDate ? (
                          <div className={`dt ${d != null ? "soon" : ""}`}>
                            <bdi className="num">{dateIL(s.nextRenewalDate)}</bdi>
                            <small>{d != null ? `בעוד ${d} ימים` : s.nextRenewalEstimated ? "משוער" : ""}</small>
                          </div>
                        ) : (
                          noRenewal(s)
                        )}
                      </td>
                      <td>{s.accounts[0] && <Acct email={s.accounts[0]} alt={altAcct(s.accounts[0])} />}</td>
                      <td>{usageChip(s)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
        <div className="tfoot">
          <span>
            מציג <b>{list.length}</b> מתוך {inTab.length}
          </span>
          <span>
            סך חודשי בתצוגה:{" "}
            <b>
              <Money value={listTotal} />
            </b>
          </span>
        </div>
      </section>
    </main>
  );
}
