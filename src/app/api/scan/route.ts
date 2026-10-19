import { z } from "zod";
import { denyUnlessOwner } from "@/lib/auth";
import { GoogleAuthRevoked } from "@/lib/google";
import { processBatch, progress, queueMessages, retryErrors } from "@/lib/scan";

export const maxDuration = 300;

const Body = z.object({
  accountId: z.number().int(),
  step: z.enum(["queue", "batch", "retry", "status"]),
});

/**
 * The screen drives a scan: "queue" once, then "batch" again and again until pending is 0.
 * Each call is short, so a scan of a thousand emails never hits a request timeout.
 */
export async function POST(request: Request) {
  const denied = await denyUnlessOwner();
  if (denied) return denied;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "בקשה לא תקינה" }, { status: 400 });
  const { accountId, step } = parsed.data;
  try {
    if (step === "queue") return Response.json(await queueMessages(accountId));
    if (step === "batch") return Response.json(await processBatch(accountId));
    if (step === "retry") retryErrors(accountId);
    return Response.json(progress(accountId));
  } catch (err) {
    if (err instanceof GoogleAuthRevoked) {
      return Response.json({ error: "ההרשאה של Google פגה, צריך לחבר את החשבון מחדש", reconnect: true }, { status: 409 });
    }
    console.error("scan failed", err);
    return Response.json({ error: "הסריקה נתקעה, אפשר לנסות שוב" }, { status: 500 });
  }
}
