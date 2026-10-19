import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { getSubscription, listAccounts } from "@/lib/subscriptions";
import { AppShell } from "@/components/AppShell";
import { SubDetail } from "@/components/SubDetail";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const found = getSubscription(Number((await params).id));
  if (!found) notFound();
  return (
    <AppShell screen="sub" title={found.subscription.name}>
      <SubDetail
        key={found.subscription.id}
        initial={found.subscription}
        charges={found.charges}
        accounts={listAccounts().map((a) => a.email)}
      />
    </AppShell>
  );
}
