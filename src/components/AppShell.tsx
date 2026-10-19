import Link from "next/link";
import type { ReactNode } from "react";
import { whenIL } from "@/lib/format";
import { lastScanAt } from "@/lib/subscriptions";
import { LogoutButton } from "./LogoutButton";
import { Toaster } from "./Toast";
import { BrandMark, IconRefresh } from "./ui";

type Screen = "dash" | "inboxes" | "sub";

/** Top bar, the nav (top above 760px, tabs below), the footer and the toast. */
export function AppShell({ screen, title, children }: { screen: Screen; title?: string; children: ReactNode }) {
  const last = whenIL(lastScanAt());
  const current = (s: Screen) => (s === screen || (s === "dash" && screen === "sub") ? ("page" as const) : undefined);

  return (
    <div className={`app ${screen === "sub" ? "sub-view" : ""}`}>
      <header className="top">
        <div className="wrap">
          <Link className="backbtn" href="/" aria-label="חזרה">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ rotate: "180deg" }}>
              <path d="M7 4l6 6-6 6" />
            </svg>
          </Link>
          <span className="appttl">{title}</span>
          <Link className="brand" href="/">
            <BrandMark />
            מנויומטר
          </Link>
          <nav className="nav" aria-label="ניווט ראשי">
            <Link href="/" aria-current={current("dash")}>
              מנויים
            </Link>
            <Link href="/inboxes" aria-current={current("inboxes")}>
              תיבות Gmail
            </Link>
          </nav>
          <div className="scan">
            {last && (
              <span className="scan-st">
                <span className="pulse" />
                <span className="t">נסרק לאחרונה:</span>{" "}
                <b style={{ fontWeight: 600 }}>
                  <bdi>{last}</bdi>
                </b>
              </span>
            )}
            <Link className="btn scanb" href="/inboxes?scan=1">
              <IconRefresh />
              סרוק עכשיו
            </Link>
            <LogoutButton className="logout">יציאה</LogoutButton>
          </div>
        </div>
      </header>

      {children}

      <footer className="wrap">מנויומטר, כלי אישי</footer>

      <nav className="tabbar" aria-label="ניווט תחתון">
        <Link href="/" aria-current={current("dash")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="3.5" width="7" height="9" rx="2" />
            <rect x="13.5" y="3.5" width="7" height="5" rx="2" />
            <rect x="13.5" y="11.5" width="7" height="9" rx="2" />
            <rect x="3.5" y="15.5" width="7" height="5" rx="2" />
          </svg>
          מנויים
        </Link>
        <Link href="/inboxes" aria-current={current("inboxes")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5.5" width="18" height="13" rx="3" />
            <path d="M4 8l8 6 8-6" />
          </svg>
          תיבות
        </Link>
        <LogoutButton>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10" />
            <path d="M15 8l4 4-4 4M19 12H9" />
          </svg>
          יציאה
        </LogoutButton>
      </nav>

      <Toaster />
    </div>
  );
}
