import { IssuerDashboard } from "@/components/dashboard/issuer-dashboard";
import { PageShell } from "@/components/dashboard/page-shell";

export default function IssuerPage() {
  return (
    <PageShell
      role="University / Issuer"
      title="Student Credential Issuance"
      description="The issuer role manages student records, creates privacy-preserving credentials, and can register or revoke credential hashes in the local StudentVerificationRegistry contract."
    >
      <IssuerDashboard />
    </PageShell>
  );
}
