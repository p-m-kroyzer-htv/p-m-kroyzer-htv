import type { CSSProperties } from "react";
import { fmt, hueOf, initial, originalParts, shortEmail } from "@/lib/format";

/** An amount in shekels: the number isolated left to right, the sign apart. */
export function Money({ value, curSize }: { value: number; curSize?: string }) {
  return (
    <bdi className="num">
      {fmt(value)}
      <span className="cur" style={curSize ? { fontSize: curSize } : undefined}>
        ₪
      </span>
    </bdi>
  );
}

/** An amount in the currency it was charged in. */
export function Orig({ amount, currency }: { amount: number; currency: string | null }) {
  const p = originalParts(amount, currency);
  return (
    <bdi className="num">
      {p.text}
      {p.shekel && <span className="cur">₪</span>}
    </bdi>
  );
}

export function Mono({ name, vendor }: { name: string; vendor: string }) {
  return (
    <span className="mono" style={{ "--h": hueOf(vendor || name) } as CSSProperties}>
      {initial(name)}
    </span>
  );
}

export function Acct({ email, alt, style }: { email: string; alt?: boolean; style?: CSSProperties }) {
  return (
    <span className={`acct ${alt ? "b2" : ""}`} style={style}>
      {shortEmail(email)}
    </span>
  );
}

export function Bars() {
  return (
    <span className="bars" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

export const IconRefresh = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.5 8a5.5 5.5 0 1 1-1.7-4" />
    <path d="M13.5 2.5v3h-3" />
  </svg>
);

export const IconExternal = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3h4v4M13 3L7.5 8.5M11 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2.5" />
  </svg>
);

export const IconWarn = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 3l8 14H2L10 3z" />
    <path d="M10 8.5v4M10 15h.01" />
  </svg>
);

export const IconArrowBack = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ rotate: "180deg" }}>
    <path d="M6 3l5 5-5 5" />
  </svg>
);

export const IconSearch = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
);

export const IconGoogle = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.5 5.8c4.4-4.1 7-10.1 7-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

/** "Connect Gmail" goes through Google's own consent screen. */
export function GoogleButton({ label = "חבר תיבת Gmail" }: { label?: string }) {
  return (
    <a className="gbtn" href="/api/auth/google/start" style={{ textDecoration: "none" }}>
      <IconGoogle />
      {label}
    </a>
  );
}

export const BrandMark = () => (
  <svg viewBox="0 0 28 28" aria-hidden="true">
    <rect width="28" height="28" rx="8" fill="oklch(0.37 0.07 215)" />
    <path d="M7 15.5a7 7 0 1 1 7 7" fill="none" stroke="oklch(0.97 0.01 200)" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="14" cy="14" r="2.4" fill="oklch(0.78 0.14 50)" />
    <path d="M5.2 14.2 7 15.9l1.9-1.7" fill="none" stroke="oklch(0.97 0.01 200)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
