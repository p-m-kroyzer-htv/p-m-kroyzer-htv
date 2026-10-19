import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { envOr } from "./env";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  refresh_token_enc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',      -- connected | needs_reconnect | disconnected
  last_scan_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  gmail_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',         -- pending | done | error
  is_subscription INTEGER,
  from_addr TEXT,
  subject TEXT,
  received_at TEXT,
  error TEXT,
  UNIQUE (account_id, gmail_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  category TEXT,
  manage_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',         -- active | cancelled | ignored
  usage TEXT NOT NULL DEFAULT 'unknown',         -- unknown | daily | sometimes | rarely | unused
  notes TEXT,
  alternatives_json TEXT,
  alternatives_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS charges (
  id INTEGER PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email_id INTEGER NOT NULL UNIQUE REFERENCES emails(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  plan TEXT,
  amount REAL,
  currency TEXT,
  amount_ils REAL,
  billing_period TEXT NOT NULL,
  charge_date TEXT,
  next_renewal_date TEXT,
  seats INTEGER
);

CREATE INDEX IF NOT EXISTS emails_pending ON emails (account_id, state);
CREATE INDEX IF NOT EXISTS charges_sub ON charges (subscription_id, charge_date);
`;

let instance: Database.Database | null = null;

export function db(): Database.Database {
  if (instance) return instance;
  const dir = path.resolve(envOr("DATA_DIR", "./data"));
  fs.mkdirSync(dir, { recursive: true });
  instance = new Database(path.join(dir, "subscriptions.db"));
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  instance.exec(SCHEMA);
  return instance;
}
