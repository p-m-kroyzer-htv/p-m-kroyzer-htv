import { denyUnlessOwner } from "@/lib/auth";
import { db } from "@/lib/db";

/** Disconnect a mailbox: its emails and charges go with it; subscriptions left with no charges are removed. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessOwner();
  if (denied) return denied;
  const id = Number((await params).id);
  const removed = db().transaction(() => {
    const changes = db().prepare("DELETE FROM accounts WHERE id = ?").run(id).changes;
    db().prepare("DELETE FROM subscriptions WHERE id NOT IN (SELECT subscription_id FROM charges)").run();
    return changes;
  })();
  return removed ? Response.json({ ok: true }) : Response.json({ error: "החשבון לא נמצא" }, { status: 404 });
}
