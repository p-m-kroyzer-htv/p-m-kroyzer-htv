import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sign, unsign } from "./crypto";

const COOKIE = "owner_session";
const MAX_AGE_DAYS = 30;

export async function startSession() {
  const jar = await cookies();
  jar.set(COOKIE, sign(`owner:${Date.now()}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_DAYS * 86400,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isOwner(): Promise<boolean> {
  const value = unsign((await cookies()).get(COOKIE)?.value);
  if (!value?.startsWith("owner:")) return false;
  const issued = Number(value.slice("owner:".length));
  return Date.now() - issued < MAX_AGE_DAYS * 86400 * 1000;
}

/** For pages: send a visitor without a session to the login screen. */
export async function requireOwner() {
  if (!(await isOwner())) redirect("/login");
}

/** For API routes: a 401 response when there is no session, else null. */
export async function denyUnlessOwner(): Promise<Response | null> {
  return (await isOwner()) ? null : Response.json({ error: "צריך להתחבר" }, { status: 401 });
}
