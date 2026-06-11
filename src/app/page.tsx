import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  KeyRound,
  Landmark,
  ShieldCheck,
  TicketCheck,
  WalletCards
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const roles = [
  {
    title: "Admin",
    href: "/admin",
    icon: ShieldCheck,
    description:
      "Manage issuer records and prepare the trusted registry for future smart contracts.",
    cta: "Open admin"
  },
  {
    title: "University / Issuer",
    href: "/issuer",
    icon: Landmark,
    description:
      "Maintain students and issue minimal student credentials into the local database.",
    cta: "Open issuer"
  },
  {
    title: "Student / Holder",
    href: "/wallet",
    icon: WalletCards,
    description:
      "View credentials as a privacy-preserving wallet presentation payload.",
    cta: "Open wallet"
  },
  {
    title: "Discount Platform / Verifier",
    href: "/verifier",
    icon: TicketCheck,
    description:
      "Check credential status, issuer trust, student activity, and expiration off-chain.",
    cta: "Open verifier"
  }
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="container flex min-h-screen flex-col justify-between py-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                Decentralized Student Verification Wallet
              </p>
              <p className="text-xs text-muted-foreground">DID + VC course demo</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/admin">Admin</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/issuer">Start issuing</Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-3xl space-y-6">
            <h1 className="text-balance text-4xl font-semibold tracking-normal md:text-6xl">
              Verify student eligibility with DID-ready credentials.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              This app models a practical student verification flow across admin,
              issuer, holder, and verifier roles. It stores seed data and issued
              credentials in SQLite today, while keeping clear integration points
              for smart contracts and wallet signatures later.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/issuer">
                  <BadgeCheck />
                  Issue a credential
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/verifier">
                  <Building2 />
                  Verify a credential
                </Link>
              </Button>
            </div>
          </div>

          <Card className="bg-card/80">
            <CardHeader>
              <CardTitle>Demo flow</CardTitle>
              <CardDescription>
                Database-backed workflow for a live course presentation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "Admin trusts universities",
                "Issuer creates active students",
                "Issuer stores VC-like credential JSON",
                "Student wallet displays minimal credential",
                "Verifier approves or rejects with reasons"
              ].map((item, index) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs text-muted-foreground">
                    {index + 1}
                  </div>
                  <p className="text-sm">{item}</p>
                </div>
              ))}
              <Separator />
              <p className="text-xs leading-5 text-muted-foreground">
                Solidity contracts, real blockchain transactions, DID resolution,
                ZK proofs, and MetaMask are intentionally left as future phases.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 pb-8 md:grid-cols-2 xl:grid-cols-4">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <Card key={role.href} className="flex flex-col">
                <CardHeader>
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>{role.title}</CardTitle>
                  <CardDescription className="leading-6">
                    {role.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button asChild className="w-full" variant="secondary">
                    <Link href={role.href}>{role.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </main>
  );
}
