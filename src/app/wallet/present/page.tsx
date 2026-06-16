import { PageShell } from "@/components/dashboard/page-shell";
import { WalletPresentationApproval } from "@/components/wallet/wallet-presentation-approval";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requirePageRole } from "@/lib/auth/page-guard";

type WalletPresentPageProps = {
  searchParams: Promise<{ requestId?: string }>;
};

export default async function WalletPresentPage({
  searchParams
}: WalletPresentPageProps) {
  const { requestId } = await searchParams;
  const nextPath = requestId
    ? `/wallet/present?requestId=${encodeURIComponent(requestId)}`
    : "/wallet/present";

  await requirePageRole(["STUDENT"], nextPath);

  return (
    <PageShell
      role="Student / Holder"
      roleKey="STUDENT"
      title="Approve Verification Request"
      description="Review a verifier request, select an eligible student credential, and sign the existing holder presentation proof with MetaMask."
    >
      {requestId ? (
        <WalletPresentationApproval requestId={requestId} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>Missing request</AlertTitle>
          <AlertDescription>
            Open this page with a requestId query parameter.
          </AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
