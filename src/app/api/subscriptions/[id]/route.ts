import { z } from "zod";
import { denyUnlessOwner } from "@/lib/auth";
import { getSubscription, STATUSES, updateSubscription, USAGES } from "@/lib/subscriptions";

const Patch = z.object({
  usage: z.enum(USAGES).optional(),
  status: z.enum(STATUSES).optional(),
  notes: z.string().max(2000).nullable().optional(),
  name: z.string().trim().min(1).max(120).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessOwner();
  if (denied) return denied;
  const found = getSubscription(Number((await params).id));
  return found ? Response.json(found) : Response.json({ error: "המנוי לא נמצא" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessOwner();
  if (denied) return denied;
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "בקשה לא תקינה" }, { status: 400 });
  const id = Number((await params).id);
  if (!updateSubscription(id, parsed.data)) return Response.json({ error: "המנוי לא נמצא" }, { status: 404 });
  return Response.json(getSubscription(id));
}
