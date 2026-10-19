import Link from "next/link";
import type { CSSProperties } from "react";
import { requireOwner } from "@/lib/auth";
import { todayIL } from "@/lib/format";
import { ilsRates } from "@/lib/rates";
import { listAccounts, listSubscriptions } from "@/lib/subscriptions";
import { AppShell } from "@/components/AppShell";
import { Dashboard } from "@/components/Dashboard";
import { GoogleButton, IconRefresh, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

async function usdRate(): Promise<number | null> {
  try {
    return (await ilsRates()).USD ?? null;
  } catch {
    return null;
  }
}

export default async function Home() {
  await requireOwner();
  const subs = listSubscriptions();
  const accounts = listAccounts();

  if (!subs.length) {
    return (
      <AppShell screen="dash">
        <EmptyState hasAccounts={accounts.length > 0} />
      </AppShell>
    );
  }

  return (
    <AppShell screen="dash">
      <Dashboard initial={subs} accounts={accounts} today={todayIL()} usdRate={await usdRate()} />
    </AppShell>
  );
}

function EmptyState({ hasAccounts }: { hasAccounts: boolean }) {
  return (
    <main className="wrap">
      <div className="head rv">
        <div>
          <h1>לוח מנויים</h1>
          <p>{hasAccounts ? "עוד לא נמצאו מנויים" : "עוד לא חוברה תיבת Gmail"}</p>
        </div>
      </div>
      <section className="empty rv" style={{ "--i": 1 } as CSSProperties} aria-label="מצב ריק">
        <svg className="ill" viewBox="0 0 76 76" fill="none" aria-hidden="true">
          <rect x="8" y="16" width="60" height="44" rx="9" fill="oklch(0.968 0.011 205)" stroke="oklch(0.37 0.07 215)" strokeWidth="2" />
          <path d="M10 22l28 22 28-22" stroke="oklch(0.37 0.07 215)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="58" cy="54" r="11" fill="oklch(0.78 0.14 50)" />
          <path d="M58 48v12M52 54h12" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        {hasAccounts ? (
          <>
            <div>
              <h3>התיבה מחוברת, עכשיו סורקים</h3>
              <p>הסריקה קוראת קבלות, חשבוניות והודעות חידוש מהשנה האחרונה ומוצאת את המנויים. לוקח כמה דקות, אפשר להישאר במסך.</p>
            </div>
            <div className="acts">
              <Link className="btn primary lg" href="/inboxes?scan=1">
                <IconRefresh />
                סרוק עכשיו
              </Link>
            </div>
          </>
        ) : (
          <>
            <div>
              <h3>מתחילים בחיבור תיבת Gmail</h3>
              <p>
                המערכת קוראת רק קבלות, חשבוניות והודעות חידוש, מוצאת את המנויים שלך ומראה כמה מהם אתה משלם בלי להשתמש. קריאה בלבד,
                אפשר לנתק בכל רגע.
              </p>
            </div>
            <div className="acts">
              <GoogleButton />
            </div>
          </>
        )}
      </section>
      <section className="zero">
        <div className="kpi">
          <div className="lbl">סך עלות חודשית</div>
          <div className="val">
            <Money value={0} />
          </div>
        </div>
        <div className="kpi">
          <div className="lbl">סך עלות שנתית</div>
          <div className="val">
            <Money value={0} />
          </div>
        </div>
        <div className="kpi">
          <div className="lbl">מנויים פעילים</div>
          <div className="val">0</div>
        </div>
      </section>
    </main>
  );
}
