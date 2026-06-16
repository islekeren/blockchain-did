"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Landmark,
  Loader2,
  LogIn,
  RefreshCw,
  ShieldCheck,
  TicketCheck,
  Wallet,
  WalletCards,
  type LucideIcon
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { useWallet } from "@/hooks/useWallet";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import {
  buildRoleLoginPath,
  getRoleDestination,
  roleForPath
} from "@/lib/auth/navigation";
import type { UserRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

type LoginPanelProps = {
  initialRole: UserRole;
  initialNext: string;
  deniedRole?: UserRole | null;
};

type RoleOption = {
  role: UserRole;
  icon: LucideIcon;
  description: string;
};

const roleOptions: RoleOption[] = [
  {
    role: "ADMIN",
    icon: ShieldCheck,
    description: "Manage issuers, users, audit records, and contract registry setup."
  },
  {
    role: "ISSUER",
    icon: Landmark,
    description: "Create students, issue credentials, and anchor credential hashes."
  },
  {
    role: "STUDENT",
    icon: WalletCards,
    description: "Open the holder wallet and sign verifier presentation challenges."
  },
  {
    role: "VERIFIER",
    icon: TicketCheck,
    description: "Create challenges and verify student eligibility proofs."
  }
];

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function LoginPanel({
  initialRole,
  initialNext,
  deniedRole
}: LoginPanelProps) {
  const router = useRouter();
  const wallet = useWallet();
  const auth = useWalletAuth(wallet);
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);

  const targetPath = useMemo(() => {
    const targetRole = roleForPath(initialNext);

    return targetRole === selectedRole
      ? initialNext
      : getRoleDestination(selectedRole).href;
  }, [initialNext, selectedRole]);

  const selectedDestination = getRoleDestination(selectedRole);
  const signedInDestination = auth.user
    ? getRoleDestination(auth.user.role)
    : null;
  const roleMismatch = Boolean(auth.user && auth.user.role !== selectedRole);
  const busy = auth.loading || auth.signingIn || wallet.connecting;

  useEffect(() => {
    if (!auth.loading && auth.user?.role === selectedRole) {
      router.replace(targetPath);
    }
  }, [auth.loading, auth.user, router, selectedRole, targetPath]);

  async function signIn() {
    await auth.signIn();
  }

  async function signOut() {
    await auth.signOut();
    window.location.replace(buildRoleLoginPath(selectedRole, targetPath));
  }

  return (
    <Card className="bg-card/90">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Wallet Login</CardTitle>
            <CardDescription>
              Continue to {selectedDestination.label}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {roleOptions.map((option) => {
            const Icon = option.icon;
            const destination = getRoleDestination(option.role);
            const active = selectedRole === option.role;

            return (
              <button
                key={option.role}
                type="button"
                onClick={() => setSelectedRole(option.role)}
                className={cn(
                  "flex min-h-32 flex-col items-start gap-3 rounded-md border p-4 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                )}
                aria-pressed={active}
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <Icon className="h-5 w-5 text-primary" />
                  {active ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                </div>
                <div>
                  <p className="font-medium text-foreground">{destination.label}</p>
                  <p className="mt-2 text-xs leading-5">{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={wallet.isConnected ? "success" : "neutral"}>
            {wallet.address ? shortAddress(wallet.address) : "Wallet not connected"}
          </Badge>
          <Badge variant={auth.isSignedIn ? "success" : "neutral"}>
            {auth.user ? `${auth.user.role} session` : "No active session"}
          </Badge>
        </div>

        {!wallet.hasMetaMask ? (
          <Alert variant="warning">
            <AlertTitle>MetaMask not detected</AlertTitle>
            <AlertDescription>
              Open this app in a browser where MetaMask is enabled.
            </AlertDescription>
          </Alert>
        ) : null}

        {deniedRole ? (
          <Alert variant="warning">
            <AlertTitle>Role access required</AlertTitle>
            <AlertDescription>
              The active {getRoleDestination(deniedRole).shortLabel} session cannot
              open {selectedDestination.shortLabel}.
            </AlertDescription>
          </Alert>
        ) : null}

        {roleMismatch && signedInDestination ? (
          <Alert variant="warning">
            <AlertTitle>Different wallet role</AlertTitle>
            <AlertDescription>
              You are signed in as {signedInDestination.label}. Sign out or open that
              dashboard instead.
            </AlertDescription>
          </Alert>
        ) : null}

        {auth.error ? (
          <Alert variant="destructive">
            <AlertTitle>Sign-in error</AlertTitle>
            <AlertDescription>{auth.error}</AlertDescription>
          </Alert>
        ) : null}

        {wallet.error ? (
          <Alert variant="destructive">
            <AlertTitle>Wallet error</AlertTitle>
            <AlertDescription>{wallet.error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          {roleMismatch && signedInDestination ? (
            <>
              <Button
                type="button"
                className="flex-1"
                onClick={() => router.replace(signedInDestination.href)}
              >
                <LogIn />
                Open {signedInDestination.shortLabel}
              </Button>
              <Button
                type="button"
                className="flex-1"
                variant="outline"
                onClick={() => void signOut()}
              >
                Sign out
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="flex-1"
              onClick={() => void signIn()}
              disabled={busy || !wallet.hasMetaMask}
            >
              {auth.loading || auth.signingIn ? (
                <Loader2 className="animate-spin" />
              ) : (
                <LogIn />
              )}
              {auth.signingIn ? "Signing..." : "Sign in with MetaMask"}
            </Button>
          )}
          <Button
            asChild
            type="button"
            className="flex-1"
            variant="outline"
          >
            <Link href="/">
              <RefreshCw />
              Change entry
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
