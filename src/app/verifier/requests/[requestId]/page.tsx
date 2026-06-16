import { PageShell } from "@/components/dashboard/page-shell";
import { VerifierRequestDetail } from "@/components/verifier/verifier-request-detail";
import { requirePageRole } from "@/lib/auth/page-guard";

type VerifierRequestPageProps = {
  params: Promise<{ requestId: string }>;
};

export default async function VerifierRequestPage({
  params
}: VerifierRequestPageProps) {
  const { requestId } = await params;
  await requirePageRole(["VERIFIER"], `/verifier/requests/${requestId}`);

  return (
    <PageShell
      role="Discount Platform / Verifier"
      roleKey="VERIFIER"
      title="Verification Request"
      description="Inspect the final request status, wallet redirect URL, and stored verification checks."
    >
      <VerifierRequestDetail requestId={requestId} />
    </PageShell>
  );
}
