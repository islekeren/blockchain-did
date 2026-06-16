import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { PageShell } from "@/components/dashboard/page-shell";
import { requirePageRole } from "@/lib/auth/page-guard";

export default async function AdminPage() {
  await requirePageRole(["ADMIN"], "/admin");

  return (
    <PageShell
      role="Admin"
      roleKey="ADMIN"
      title="Issuer Registry Control"
      description="The admin role manages trusted university issuers in the local database and can register issuers and schemas in the local StudentVerificationRegistry contract."
    >
      <AdminDashboard />
    </PageShell>
  );
}
