import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, KeyRound } from "lucide-react";

import { LoginPanel } from "@/components/auth/login-panel";
import { Button } from "@/components/ui/button";
import {
  normalizeLoginTarget,
  ROLE_DESTINATIONS
} from "@/lib/auth/navigation";
import { isUserRole } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Wallet Login | Decentralized Student Verification Wallet"
};

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const target = normalizeLoginTarget({
    role: firstParam(params.role),
    next: firstParam(params.next)
  });
  const denied = firstParam(params.denied);
  const deniedRole = denied && isUserRole(denied) ? denied : null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="container flex min-h-screen flex-col py-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                Decentralized Student Verification Wallet
              </p>
              <p className="text-xs text-muted-foreground">
                {ROLE_DESTINATIONS[target.role].label}
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/">
              <ArrowLeft />
              Home
            </Link>
          </Button>
        </header>

        <div className="grid flex-1 gap-8 py-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div className="max-w-xl space-y-5">
            <p className="text-sm font-medium uppercase text-muted-foreground">
              Secure entry
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-normal md:text-5xl">
              Sign in before opening the role workspace.
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              The selected wallet signs a short nonce, the server creates a role
              session, and the app redirects to the matching dashboard.
            </p>
          </div>

          <LoginPanel
            initialRole={target.role}
            initialNext={target.next}
            deniedRole={deniedRole}
          />
        </div>
      </section>
    </main>
  );
}
