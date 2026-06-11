import { PageShell } from "@/components/dashboard/page-shell";
import { VerifierDashboard } from "@/components/dashboard/verifier-dashboard";

export default function VerifierPage() {
  return (
    <PageShell
      role="Discount Platform / Verifier"
      title="Student Discount Verification"
      description="The verifier role approves or rejects a credential using local off-chain checks: credential existence, issued status, active student flag, expiration, and trusted issuer status."
    >
      <VerifierDashboard />
    </PageShell>
  );
}
