import { PageShell } from "@/components/dashboard/page-shell";
import { VerifierDashboard } from "@/components/dashboard/verifier-dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requirePageRole } from "@/lib/auth/page-guard";

export default async function VerifierDebugPage() {
  await requirePageRole(["VERIFIER"], "/verifier/debug");

  return (
    <PageShell
      role="Discount Platform / Verifier"
      roleKey="VERIFIER"
      title="Advanced Debug Mode"
      description="Manual verification playground for development/testing only."
    >
      <div className="grid gap-6">
        <Alert variant="warning">
          <AlertTitle>Manual verification playground for development/testing only.</AlertTitle>
          <AlertDescription>
            The main verifier integration flow is available from the verifier dashboard.
          </AlertDescription>
        </Alert>
        <VerifierDashboard />
      </div>
    </PageShell>
  );
}
