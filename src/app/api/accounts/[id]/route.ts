import { denyUnlessOwner } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { revokeToken } from "@/lib/google";

/**
 * Disconnect a mailbox: Google's access is revoked and the stored token is erased, so it is never read again.
 * The subscriptions and charges already found stay on the list; connecting the same address again resumes it.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessOwner();
  if (denied) return denied;
  const id = Number((await params).id);
  const account = db()
    .prepare("SELECT refresh_token_enc FROM accounts WHERE id = ? AND status <> 'disconnected'")
    .get(id) as { refresh_token_enc: string } | undefined;
  if (!account) return Response.json({ error: "החשבון לא נמצא" }, { status: 404 });
  if (account.refresh_token_enc) {
    try {
      await revokeToken(decrypt(account.refresh_token_enc));
    } catch (err) {
      console.error("could not read the token to revoke it", err);
    }
  }
  db()
    .prepare("UPDATE accounts SET status = 'disconnected', refresh_token_enc = '' WHERE id = ?")
    .run(id);
  db().prepare("DELETE FROM emails WHERE account_id = ? AND state = 'pending'").run(id);
  return Response.json({ ok: true });
}
