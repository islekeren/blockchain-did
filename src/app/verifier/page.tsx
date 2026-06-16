import { PageShell } from "@/components/dashboard/page-shell";
import { VerifierRequestsDashboard } from "@/components/verifier/verifier-requests-dashboard";
import { requirePageRole } from "@/lib/auth/page-guard";

export default async function VerifierPage() {
  await requirePageRole(["VERIFIER"], "/verifier");

  return (
    <PageShell
      role="Discount Platform / Verifier"
      roleKey="VERIFIER"
      title="Verifier Requests"
      description="Create wallet redirect requests, track pending approvals, and inspect final verification results for student discount integrations."
    >
      <VerifierRequestsDashboard />
    </PageShell>
  );
}
