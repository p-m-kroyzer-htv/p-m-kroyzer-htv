import { startSession } from "@/lib/auth";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!password || !safeEqual(password, env("ADMIN_PASSWORD"))) {
    // A small delay so the password cannot be guessed quickly.
    await new Promise((r) => setTimeout(r, 800));
    return Response.json({ error: "הסיסמה לא נכונה" }, { status: 401 });
  }
  await startSession();
  return Response.json({ ok: true });
}
