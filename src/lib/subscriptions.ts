import { db } from "./db";
import type { Alternatives } from "./alternatives";

export const USAGES = ["unknown", "daily", "sometimes", "rarely", "unused"] as const;
export const STATUSES = ["active", "cancelled", "ignored"] as const;

const PER_MONTH: Record<string, number> = { monthly: 1, yearly: 1 / 12, quarterly: 1 / 3, weekly: 52 / 12 };

export interface Charge {
  id: number;
  kind: string;
  plan: string | null;
  amount: number | null;
  currency: string | null;
  amount_ils: number | null;
  billing_period: string;
  charge_date: string | null;
  next_renewal_date: string | null;
  seats: number | null;
  account_email: string;
  subject: string | null;
}

export interface Subscription {
  id: number;
  name: string;
  vendor: string;
  category: string | null;
  manage_url: string | null;
  status: string;
  usage: string;
  notes: string | null;
  plan: string | null;
  period: string;
  lastAmount: number | null;
  lastCurrency: string | null;
  monthlyIls: number | null;
  yearlyIls: number | null;
  lastChargeDate: string | null;
  nextRenewalDate: string | null;
  seats: number | null;
  accounts: string[];
  chargeCount: number;
  alternatives: Alternatives | null;
  alternativesAt: string | null;
}

const daysBetween = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;

/** When the emails never say the period, read it from the gap between charges. */
function guessPeriod(dates: string[]): string {
  if (dates.length < 2) return "unknown";
  const gaps = dates.slice(1).map((d, i) => daysBetween(d, dates[i])).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median >= 25 && median <= 35) return "monthly";
  if (median >= 80 && median <= 100) return "quarterly";
  if (median >= 330 && median <= 400) return "yearly";
  if (median >= 6 && median <= 8) return "weekly";
  return "unknown";
}

function chargesOf(subscriptionId: number): Charge[] {
  return db()
    .prepare(
      `SELECT c.id, c.kind, c.plan, c.amount, c.currency, c.amount_ils, c.billing_period, c.charge_date,
              c.next_renewal_date, c.seats, a.email account_email, e.subject
       FROM charges c JOIN accounts a ON a.id = c.account_id JOIN emails e ON e.id = c.email_id
       WHERE c.subscription_id = ?
       ORDER BY c.charge_date DESC, c.id DESC`,
    )
    .all(subscriptionId) as Charge[];
}

function summarize(row: Record<string, unknown>): Subscription {
  const charges = chargesOf(row.id as number);
  const paid = charges.filter((c) => c.kind === "charge" && c.amount != null);
  const priced = charges.filter((c) => c.amount != null && c.kind !== "cancellation" && c.kind !== "other");
  const latest = priced[0] ?? null;
  const declared = charges.find((c) => c.billing_period !== "unknown" && c.billing_period !== "one_time");
  const period =
    declared?.billing_period ??
    guessPeriod(paid.map((c) => c.charge_date).filter((d): d is string => !!d).reverse());
  const factor = PER_MONTH[period];
  const monthlyIls = latest?.amount_ils != null && factor ? Math.round(latest.amount_ils * factor * 100) / 100 : null;
  const today = new Date().toISOString().slice(0, 10);
  const nextRenewal = charges.map((c) => c.next_renewal_date).filter((d): d is string => !!d && d >= today).sort()[0] ?? null;

  return {
    id: row.id as number,
    name: row.name as string,
    vendor: row.vendor as string,
    category: row.category as string | null,
    manage_url: row.manage_url as string | null,
    status: row.status as string,
    usage: row.usage as string,
    notes: row.notes as string | null,
    plan: latest?.plan ?? null,
    period,
    lastAmount: latest?.amount ?? null,
    lastCurrency: latest?.currency ?? null,
    monthlyIls,
    yearlyIls: monthlyIls != null ? Math.round(monthlyIls * 12) : null,
    lastChargeDate: paid[0]?.charge_date ?? null,
    nextRenewalDate: nextRenewal,
    seats: latest?.seats ?? null,
    accounts: [...new Set(charges.map((c) => c.account_email))],
    chargeCount: paid.length,
    alternatives: row.alternatives_json ? (JSON.parse(row.alternatives_json as string) as Alternatives) : null,
    alternativesAt: row.alternatives_at as string | null,
  };
}

export function listSubscriptions(): Subscription[] {
  const rows = db().prepare("SELECT * FROM subscriptions ORDER BY name COLLATE NOCASE").all() as Record<string, unknown>[];
  return rows.map(summarize).sort((a, b) => (b.monthlyIls ?? -1) - (a.monthlyIls ?? -1));
}

export function getSubscription(id: number): { subscription: Subscription; charges: Charge[] } | null {
  const row = db().prepare("SELECT * FROM subscriptions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? { subscription: summarize(row), charges: chargesOf(id) } : null;
}

export interface Totals {
  activeCount: number;
  monthlyIls: number;
  yearlyIls: number;
  /** What the subscriptions marked unused or rarely used cost per month. */
  wastedMonthlyIls: number;
  /** Active subscriptions with no known price. */
  unpricedCount: number;
}

export function totals(list: Subscription[]): Totals {
  const active = list.filter((s) => s.status === "active");
  const sum = (items: Subscription[]) => Math.round(items.reduce((t, s) => t + (s.monthlyIls ?? 0), 0) * 100) / 100;
  const monthly = sum(active);
  return {
    activeCount: active.length,
    monthlyIls: monthly,
    yearlyIls: Math.round(monthly * 12),
    wastedMonthlyIls: sum(active.filter((s) => s.usage === "unused" || s.usage === "rarely")),
    unpricedCount: active.filter((s) => s.monthlyIls == null).length,
  };
}

export function updateSubscription(
  id: number,
  patch: { usage?: string; status?: string; notes?: string | null; name?: string },
): boolean {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.usage !== undefined) (sets.push("usage = ?"), values.push(patch.usage));
  if (patch.status !== undefined) (sets.push("status = ?"), values.push(patch.status));
  if (patch.notes !== undefined) (sets.push("notes = ?"), values.push(patch.notes));
  if (patch.name !== undefined) (sets.push("name = ?"), values.push(patch.name));
  if (!sets.length) return false;
  return db().prepare(`UPDATE subscriptions SET ${sets.join(", ")} WHERE id = ?`).run(...values, id).changes > 0;
}

export function listAccounts() {
  return db()
    .prepare(
      `SELECT a.id, a.email, a.status, a.last_scan_at, a.created_at,
              (SELECT COUNT(*) FROM emails e WHERE e.account_id = a.id) emails,
              (SELECT COUNT(*) FROM emails e WHERE e.account_id = a.id AND e.state = 'pending') pending
       FROM accounts a ORDER BY a.created_at`,
    )
    .all() as {
    id: number;
    email: string;
    status: string;
    last_scan_at: string | null;
    created_at: string;
    emails: number;
    pending: number;
  }[];
}
