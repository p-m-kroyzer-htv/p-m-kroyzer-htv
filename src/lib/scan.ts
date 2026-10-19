import { db } from "./db";
import { decrypt } from "./crypto";
import { envOr } from "./env";
import { accessToken, getMessage, GoogleAuthRevoked, listMessageIds } from "./google";
import { readMessage } from "./mailtext";
import { extractSubscription, type Extraction } from "./extract";
import { toIls } from "./rates";

/** Most messages a single account scan will look at. */
const MAX_MESSAGES = 1000;
/** Messages handled per scan request; the screen keeps calling until none are left. */
const BATCH = 8;
const PARALLEL = 4;

function gmailQuery(): string {
  const months = Number(envOr("SCAN_MONTHS", "12")) || 12;
  const words = [
    "receipt", "invoice", "subscription", "renewal", "renews", "\"payment received\"", "\"your payment\"",
    "billing", "trial", "membership", "קבלה", "חשבונית", "מנוי", "חידוש", "תשלום", "חיוב",
  ];
  return `newer_than:${months}m -in:spam -in:trash {subject:(${words.join(" OR ")}) category:purchases}`;
}

export interface ScanProgress {
  total: number;
  done: number;
  pending: number;
  errors: number;
  found: number;
}

export function progress(accountId: number): ScanProgress {
  const row = db()
    .prepare(
      `SELECT COUNT(*) total,
              SUM(state = 'done') done,
              SUM(state = 'pending') pending,
              SUM(state = 'error') errors,
              SUM(is_subscription = 1) found
       FROM emails WHERE account_id = ?`,
    )
    .get(accountId) as Record<keyof ScanProgress, number | null>;
  return {
    total: row.total ?? 0,
    done: row.done ?? 0,
    pending: row.pending ?? 0,
    errors: row.errors ?? 0,
    found: row.found ?? 0,
  };
}

async function tokenFor(accountId: number): Promise<string> {
  const account = db()
    .prepare("SELECT refresh_token_enc FROM accounts WHERE id = ? AND status <> 'disconnected'")
    .get(accountId) as { refresh_token_enc: string } | undefined;
  if (!account) throw new Error("החשבון לא נמצא");
  try {
    return await accessToken(decrypt(account.refresh_token_enc));
  } catch (err) {
    if (err instanceof GoogleAuthRevoked) {
      db().prepare("UPDATE accounts SET status = 'needs_reconnect' WHERE id = ?").run(accountId);
    }
    throw err;
  }
}

/** Step 1: list matching messages and queue the ones not seen before. Cheap, no AI. */
export async function queueMessages(accountId: number): Promise<ScanProgress> {
  const token = await tokenFor(accountId);
  const ids = await listMessageIds(token, gmailQuery(), MAX_MESSAGES);
  const insert = db().prepare("INSERT OR IGNORE INTO emails (account_id, gmail_id) VALUES (?, ?)");
  db().transaction(() => ids.forEach((id) => insert.run(accountId, id)))();
  db().prepare("UPDATE accounts SET last_scan_at = datetime('now') WHERE id = ?").run(accountId);
  return progress(accountId);
}

/** Step 2: read and classify the next few queued messages. */
export async function processBatch(accountId: number): Promise<ScanProgress> {
  const pending = db()
    .prepare("SELECT id, gmail_id FROM emails WHERE account_id = ? AND state = 'pending' LIMIT ?")
    .all(accountId, BATCH) as { id: number; gmail_id: string }[];
  if (pending.length) {
    const token = await tokenFor(accountId);
    for (let i = 0; i < pending.length; i += PARALLEL) {
      await Promise.all(pending.slice(i, i + PARALLEL).map((row) => processOne(accountId, token, row)));
    }
  }
  return progress(accountId);
}

async function processOne(accountId: number, token: string, row: { id: number; gmail_id: string }) {
  try {
    const mail = readMessage(await getMessage(token, row.gmail_id));
    db()
      .prepare("UPDATE emails SET from_addr = ?, subject = ?, received_at = ? WHERE id = ?")
      .run(mail.from, mail.subject, mail.receivedAt, row.id);
    const found = await extractSubscription(mail);
    const isSub = found.is_subscription && found.kind !== "other" && (found.service || found.vendor);
    if (isSub) await saveCharge(accountId, row.id, found, mail.receivedAt);
    db()
      .prepare("UPDATE emails SET state = 'done', is_subscription = ?, error = NULL WHERE id = ?")
      .run(isSub ? 1 : 0, row.id);
  } catch (err) {
    if (err instanceof GoogleAuthRevoked) throw err;
    console.error(`scan: message ${row.gmail_id} failed`, err);
    db()
      .prepare("UPDATE emails SET state = 'error', error = ? WHERE id = ?")
      .run(String(err instanceof Error ? err.message : err).slice(0, 500), row.id);
  }
}

export function subscriptionKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/(premium|plus|subscription|מנוי)$/u, "");
}

async function saveCharge(accountId: number, emailId: number, x: Extraction, receivedAt: string) {
  const name = (x.service || x.vendor).trim();
  const key = subscriptionKey(name) || subscriptionKey(x.vendor);
  const amountIls = await toIls(x.amount, x.currency);
  db().transaction(() => {
    db()
      .prepare(
        `INSERT INTO subscriptions (key, name, vendor, category, manage_url)
         VALUES (@key, @name, @vendor, @category, @manage_url)
         ON CONFLICT (key) DO UPDATE SET
           category = COALESCE(subscriptions.category, excluded.category),
           manage_url = COALESCE(excluded.manage_url, subscriptions.manage_url)`,
      )
      .run({ key, name, vendor: x.vendor || name, category: x.category || null, manage_url: x.manage_url });
    const sub = db().prepare("SELECT id FROM subscriptions WHERE key = ?").get(key) as { id: number };
    if (x.kind === "cancellation") {
      db().prepare("UPDATE subscriptions SET status = 'cancelled' WHERE id = ? AND status = 'active'").run(sub.id);
    }
    db()
      .prepare(
        `INSERT OR REPLACE INTO charges
           (subscription_id, account_id, email_id, kind, plan, amount, currency, amount_ils,
            billing_period, charge_date, next_renewal_date, seats)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        sub.id, accountId, emailId, x.kind, x.plan, x.amount, x.currency?.toUpperCase() ?? null, amountIls,
        x.billing_period, x.charge_date ?? receivedAt.slice(0, 10), x.next_renewal_date, x.seats,
      );
  })();
}

/** Retry the messages that failed (a network hiccup, a rate limit). */
export function retryErrors(accountId: number) {
  db().prepare("UPDATE emails SET state = 'pending' WHERE account_id = ? AND state = 'error'").run(accountId);
}
