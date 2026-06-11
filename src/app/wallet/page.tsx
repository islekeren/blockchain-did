import { PageShell } from "@/components/dashboard/page-shell";
import { WalletDashboard } from "@/components/dashboard/wallet-dashboard";

export default function WalletPage() {
  return (
    <PageShell
      role="Student / Holder"
      title="Student Credential Wallet"
      description="The wallet role lets a student select their local account and view credentials issued to them. Presentation signing and MetaMask are intentionally deferred to a later blockchain phase."
    >
      <WalletDashboard />
    </PageShell>
  );
}
