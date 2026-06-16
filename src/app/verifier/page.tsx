import { PageShell } from "@/components/dashboard/page-shell";
import { VerifierDashboard } from "@/components/dashboard/verifier-dashboard";
import { requirePageRole } from "@/lib/auth/page-guard";

export default async function VerifierPage() {
  await requirePageRole(["VERIFIER"], "/verifier");

  return (
    <PageShell
      role="Discount Platform / Verifier"
      roleKey="VERIFIER"
      title="Student Discount Verification"
      description="The verifier role approves or rejects a credential using both local off-chain checks and on-chain registry checks from the local StudentVerificationRegistry contract."
    >
      <VerifierDashboard />
    </PageShell>
  );
}
