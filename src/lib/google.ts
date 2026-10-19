import { env } from "./env";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export class GoogleAuthRevoked extends Error {}

export function redirectUri(): string {
  return `${env("APP_URL").replace(/\/$/, "")}/api/auth/google/callback`;
}

export function consentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    // Always ask again so Google hands back a refresh token, also for an account connected before.
    prompt: "consent select_account",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      ...body,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    if (json.error === "invalid_grant") throw new GoogleAuthRevoked(json.error_description || json.error);
    throw new Error(`Google token error: ${json.error_description || json.error || res.status}`);
  }
  return json as { access_token: string; refresh_token?: string; scope: string };
}

export function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
}

export async function accessToken(refreshToken: string): Promise<string> {
  return (await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" })).access_token;
}

async function gmail<T>(token: string, pathAndQuery: string): Promise<T> {
  const res = await fetch(`${GMAIL}${pathAndQuery}`, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new GoogleAuthRevoked("Gmail rejected the access token");
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function profileEmail(token: string): Promise<string> {
  return (await gmail<{ emailAddress: string }>(token, "/profile")).emailAddress;
}

export async function listMessageIds(token: string, query: string, limit: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q: query, maxResults: "500" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(
      token,
      `/messages?${params}`,
    );
    for (const m of page.messages ?? []) ids.push(m.id);
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < limit);
  return ids.slice(0, limit);
}

export interface GmailPart {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

export interface GmailMessage {
  id: string;
  internalDate: string;
  payload: GmailPart;
}

export function getMessage(token: string, id: string) {
  return gmail<GmailMessage>(token, `/messages/${id}?format=full`);
}
