import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

type PageShellProps = {
  title: string;
  description: string;
  role: string;
  children: ReactNode;
};

export function PageShell({ title, description, role, children }: PageShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/40">
        <div className="container flex min-h-16 flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {role}
              </p>
              <h1 className="text-xl font-semibold tracking-normal md:text-2xl">
                {title}
              </h1>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <ArrowLeft />
              Home
            </Link>
          </Button>
        </div>
      </div>
      <div className="container py-8">
        <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {children}
      </div>
    </main>
  );
}
