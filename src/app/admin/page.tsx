import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { PageShell } from "@/components/dashboard/page-shell";

export default function AdminPage() {
  return (
    <PageShell
      role="Admin"
      title="Issuer Registry Control"
      description="The admin role manages trusted university issuers in the local database and can register issuers and schemas in the local StudentVerificationRegistry contract."
    >
      <AdminDashboard />
    </PageShell>
  );
}
