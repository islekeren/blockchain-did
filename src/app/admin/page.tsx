import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { PageShell } from "@/components/dashboard/page-shell";

export default function AdminPage() {
  return (
    <PageShell
      role="Admin"
      title="Issuer Registry Control"
      description="The admin role manages trusted university issuers in the local registry. The on-chain issuer registry is intentionally represented as a disabled placeholder for the smart contract phase."
    >
      <AdminDashboard />
    </PageShell>
  );
}
