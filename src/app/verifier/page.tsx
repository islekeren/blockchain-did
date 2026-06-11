import { PageShell } from "@/components/dashboard/page-shell";
import { VerifierDashboard } from "@/components/dashboard/verifier-dashboard";

export default function VerifierPage() {
  return (
    <PageShell
      role="Discount Platform / Verifier"
      title="Student Discount Verification"
      description="The verifier role approves or rejects a credential using both local off-chain checks and on-chain registry checks from the local StudentVerificationRegistry contract."
    >
      <VerifierDashboard />
    </PageShell>
  );
}
