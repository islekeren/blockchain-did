import { IssuerDashboard } from "@/components/dashboard/issuer-dashboard";
import { PageShell } from "@/components/dashboard/page-shell";
import { requirePageRole } from "@/lib/auth/page-guard";

export default async function IssuerPage() {
  await requirePageRole(["ISSUER"], "/issuer");

  return (
    <PageShell
      role="University / Issuer"
      roleKey="ISSUER"
      title="Student Credential Issuance"
      description="The issuer role manages student records, creates privacy-preserving credentials, and can register or revoke credential hashes in the local StudentVerificationRegistry contract."
    >
      <IssuerDashboard />
    </PageShell>
  );
}
