import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  buildRoleLoginPath,
  getRoleDestination
} from "@/lib/auth/navigation";
import {
  getCurrentUserFromToken,
  SESSION_COOKIE_NAME
} from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/roles";

export async function requirePageRole(
  allowedRoles: readonly UserRole[],
  currentPath: string
) {
  const primaryRole = allowedRoles[0] ?? "VERIFIER";
  const loginPath = buildRoleLoginPath(primaryRole, currentPath);
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  const user = await getCurrentUserFromToken(token);

  if (!user) {
    redirect(loginPath);
  }

  if (!allowedRoles.includes(user.role)) {
    const params = new URLSearchParams({
      role: primaryRole,
      next: currentPath,
      denied: user.role
    });

    redirect(`/login?${params.toString()}`);
  }

  return {
    ...user,
    destination: getRoleDestination(user.role)
  };
}
