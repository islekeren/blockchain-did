import { isUserRole, type UserRole } from "@/lib/auth/roles";

export const ROLE_DESTINATIONS: Record<
  UserRole,
  {
    href: string;
    label: string;
    shortLabel: string;
  }
> = {
  ADMIN: {
    href: "/admin",
    label: "Admin",
    shortLabel: "Admin"
  },
  ISSUER: {
    href: "/issuer",
    label: "University / Issuer",
    shortLabel: "Issuer"
  },
  STUDENT: {
    href: "/wallet",
    label: "Student / Holder",
    shortLabel: "Student"
  },
  VERIFIER: {
    href: "/verifier",
    label: "Discount Platform / Verifier",
    shortLabel: "Verifier"
  }
};

export function getRoleDestination(role: UserRole) {
  return ROLE_DESTINATIONS[role];
}

export function roleForPath(path: string): UserRole | null {
  const pathname = path.split(/[?#]/)[0];
  const match = Object.entries(ROLE_DESTINATIONS).find(
    ([, destination]) => destination.href === pathname
  );

  return match ? (match[0] as UserRole) : null;
}

export function sanitizeRedirectPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  if (value === "/login" || value.startsWith("/login?")) {
    return "/";
  }

  return value;
}

export function normalizeLoginTarget(input: {
  role?: string | null;
  next?: string | null;
}) {
  const next = sanitizeRedirectPath(input.next);
  const inferredRole = roleForPath(next);
  const role = input.role && isUserRole(input.role) ? input.role : inferredRole;
  const targetRole = role ?? "ISSUER";
  const destination = getRoleDestination(targetRole);
  const targetPath = inferredRole === targetRole ? next : destination.href;

  return {
    role: targetRole,
    next: targetPath
  };
}

export function buildRoleLoginPath(role: UserRole, next = ROLE_DESTINATIONS[role].href) {
  const params = new URLSearchParams({
    role,
    next: sanitizeRedirectPath(next)
  });

  return `/login?${params.toString()}`;
}
