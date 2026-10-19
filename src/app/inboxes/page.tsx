import { Suspense } from "react";
import { requireOwner } from "@/lib/auth";
import { lastScanAt, listAccounts } from "@/lib/subscriptions";
import { AppShell } from "@/components/AppShell";
import { Inboxes } from "@/components/Inboxes";

export const dynamic = "force-dynamic";
export const metadata = { title: "תיבות Gmail · מנויומטר" };

export default async function InboxesPage() {
  await requireOwner();
  return (
    <AppShell screen="inboxes" title="תיבות Gmail">
      <Suspense>
        <Inboxes accounts={listAccounts()} lastScan={lastScanAt()} />
      </Suspense>
    </AppShell>
  );
}
