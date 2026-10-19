import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isOwner } from "@/lib/auth";
import { consentUrl, STATE_COOKIE } from "@/lib/google";

export async function GET() {
  if (!(await isOwner())) redirect("/login");
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 600,
  });
  redirect(consentUrl(state));
}
