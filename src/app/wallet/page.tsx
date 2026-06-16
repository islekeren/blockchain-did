import { PageShell } from "@/components/dashboard/page-shell";
import { WalletDashboard } from "@/components/dashboard/wallet-dashboard";
import { requirePageRole } from "@/lib/auth/page-guard";

export default async function WalletPage() {
  await requirePageRole(["STUDENT"], "/wallet");

  return (
    <PageShell
      role="Student / Holder"
      roleKey="STUDENT"
      title="Student Credential Wallet"
      description="The wallet role lets a student view credentials and sign a verifier challenge with the wallet that owns the credential subject DID."
    >
      <WalletDashboard />
    </PageShell>
  );
}
