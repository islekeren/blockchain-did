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
      description="Review your student profile, credential status, and issued credential JSON. Normal verifier approvals open through /wallet/present?requestId=..."
    >
      <WalletDashboard />
    </PageShell>
  );
}
