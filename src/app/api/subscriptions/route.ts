import { denyUnlessOwner } from "@/lib/auth";
import { listAccounts, listSubscriptions, totals } from "@/lib/subscriptions";

export async function GET() {
  const denied = await denyUnlessOwner();
  if (denied) return denied;
  const subscriptions = listSubscriptions();
  return Response.json({ subscriptions, totals: totals(subscriptions), accounts: listAccounts() });
}
