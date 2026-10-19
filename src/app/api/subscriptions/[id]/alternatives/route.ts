import { denyUnlessOwner } from "@/lib/auth";
import { findAlternatives, saveAlternatives } from "@/lib/alternatives";
import { getSubscription, listSubscriptions } from "@/lib/subscriptions";

export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessOwner();
  if (denied) return denied;
  const id = Number((await params).id);
  const found = getSubscription(id);
  if (!found) return Response.json({ error: "המנוי לא נמצא" }, { status: 404 });
  const sub = found.subscription;
  const others = listSubscriptions()
    .filter((s) => s.id !== id && s.status === "active")
    .map((s) => (s.plan ? `${s.name} (${s.plan})` : s.name));
  try {
    const answer = await findAlternatives({
      name: sub.name,
      vendor: sub.vendor,
      plan: sub.plan,
      monthlyIls: sub.monthlyIls,
      usage: sub.usage,
      seats: sub.seats,
      others,
    });
    saveAlternatives(id, answer);
    return Response.json(answer);
  } catch (err) {
    console.error("alternatives failed", err);
    return Response.json({ error: "לא הצלחתי לבדוק חלופות כרגע, אפשר לנסות שוב" }, { status: 502 });
  }
}
