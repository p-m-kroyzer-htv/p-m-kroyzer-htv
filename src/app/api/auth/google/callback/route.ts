import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isOwner } from "@/lib/auth";
import { encrypt, safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { exchangeCode, GMAIL_SCOPE, profileEmail, STATE_COOKIE } from "@/lib/google";

type Result = { connected: string } | { error: "cancelled" | "state" | "scope" | "no_refresh" | "google" };

async function connect(url: URL, expected: string | undefined): Promise<Result> {
  if (url.searchParams.get("error")) return { error: "cancelled" };
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!code || !state || !expected || !safeEqual(state, expected)) return { error: "state" };
  try {
    const tokens = await exchangeCode(code);
    // The person can untick the Gmail permission on Google's screen.
    if (!tokens.scope.split(" ").includes(GMAIL_SCOPE)) return { error: "scope" };
    if (!tokens.refresh_token) return { error: "no_refresh" };
    const email = await profileEmail(tokens.access_token);
    db()
      .prepare(
        `INSERT INTO accounts (email, refresh_token_enc) VALUES (?, ?)
         ON CONFLICT (email) DO UPDATE SET refresh_token_enc = excluded.refresh_token_enc, status = 'connected'`,
      )
      .run(email, encrypt(tokens.refresh_token));
    return { connected: email };
  } catch (err) {
    console.error("Google connect failed", err);
    return { error: "google" };
  }
}

export async function GET(request: Request) {
  if (!(await isOwner())) redirect("/login");
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  const result = await connect(new URL(request.url), expected);
  redirect(`/accounts?${new URLSearchParams(result)}`);
}
