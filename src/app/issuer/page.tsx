import { IssuerDashboard } from "@/components/dashboard/issuer-dashboard";
import { PageShell } from "@/components/dashboard/page-shell";

export default function IssuerPage() {
  return (
    <PageShell
      role="University / Issuer"
      title="Student Credential Issuance"
      description="The issuer role manages student records and creates privacy-preserving student credentials for active students. Issued credentials are stored locally with a deterministic hash placeholder for future on-chain registration."
    >
      <IssuerDashboard />
    </PageShell>
  );
}
