import { PageShell } from "@/components/dashboard/page-shell";
import { WalletDashboard } from "@/components/dashboard/wallet-dashboard";

export default function WalletPage() {
  return (
    <PageShell
      role="Student / Holder"
      title="Student Credential Wallet"
      description="The wallet role lets a student view credentials and sign a verifier challenge with the wallet that owns the credential subject DID."
    >
      <WalletDashboard />
    </PageShell>
  );
}
