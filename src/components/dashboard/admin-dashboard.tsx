"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

import { Field } from "@/components/dashboard/field";
import { PlaceholderCard } from "@/components/dashboard/placeholder-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type { IssuerRecord } from "@/lib/types";

type IssuerResponse = {
  issuers: IssuerRecord[];
};

const emptyForm = {
  name: "",
  did: "",
  walletAddress: "",
  trusted: false
};

export function AdminDashboard() {
  const [issuers, setIssuers] = useState<IssuerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);

  async function loadIssuers() {
    setLoading(true);
    const response = await fetch("/api/issuers", { cache: "no-store" });
    const data = (await response.json()) as IssuerResponse;
    setIssuers(data.issuers ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadIssuers();
  }, []);

  const trustedCount = useMemo(
    () => issuers.filter((issuer) => issuer.trusted).length,
    [issuers]
  );

  async function createIssuer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const response = await fetch("/api/issuers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Unable to create issuer");
      setSaving(false);
      return;
    }

    setForm(emptyForm);
    setDialogOpen(false);
    await loadIssuers();
    setSaving(false);
  }

  async function toggleTrusted(issuer: IssuerRecord) {
    await fetch(`/api/issuers/${issuer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trusted: !issuer.trusted })
    });
    await loadIssuers();
  }

  async function deleteIssuer(id: string) {
    await fetch(`/api/issuers/${id}`, { method: "DELETE" });
    await loadIssuers();
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Registered issuers</CardDescription>
            <CardTitle className="text-3xl">{issuers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Trusted locally</CardDescription>
            <CardTitle className="text-3xl">{trustedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Registry phase</CardDescription>
            <CardTitle className="text-3xl">Off-chain</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Issuer action failed</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Universities / Issuers</CardTitle>
            <CardDescription>
              These records are stored in SQLite and act as the trusted issuer registry for this phase.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadIssuers()}>
              <RefreshCw />
              Refresh
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus />
                  Add issuer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createIssuer} className="space-y-5">
                  <DialogHeader>
                    <DialogTitle>Add university issuer</DialogTitle>
                    <DialogDescription>
                      Create a local issuer record. On-chain registration will be added in a later phase.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4">
                    <Field label="University name">
                      <Input
                        value={form.name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            name: event.target.value
                          }))
                        }
                        placeholder="Example University"
                        required
                      />
                    </Field>
                    <Field label="DID">
                      <Input
                        value={form.did}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            did: event.target.value
                          }))
                        }
                        placeholder="did:ethr:0x..."
                        required
                      />
                    </Field>
                    <Field label="Issuer wallet address">
                      <Input
                        value={form.walletAddress}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            walletAddress: event.target.value
                          }))
                        }
                        placeholder="0x..."
                        required
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={form.trusted}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            trusted: event.target.checked
                          }))
                        }
                      />
                      Mark as trusted locally
                    </label>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      Create issuer
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issuer</TableHead>
                <TableHead>DID</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Credentials</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7}>Loading issuers...</TableCell>
                </TableRow>
              ) : issuers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>No issuers registered yet.</TableCell>
                </TableRow>
              ) : (
                issuers.map((issuer) => (
                  <TableRow key={issuer.id}>
                    <TableCell className="font-medium">{issuer.name}</TableCell>
                    <TableCell className="max-w-56 truncate font-mono text-xs">
                      {issuer.did}
                    </TableCell>
                    <TableCell className="max-w-44 truncate font-mono text-xs">
                      {issuer.walletAddress}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={issuer.trusted ? "Trusted" : "Untrusted"} />
                    </TableCell>
                    <TableCell>{issuer._count?.students ?? 0}</TableCell>
                    <TableCell>{issuer._count?.credentials ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void toggleTrusted(issuer)}
                        >
                          <ShieldCheck />
                          {issuer.trusted ? "Untrust" : "Trust"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => void deleteIssuer(issuer.id)}
                        >
                          <Trash2 />
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PlaceholderCard
        title="Blockchain Registry Status"
        description="Smart contract reads and writes are not connected yet. These controls mark the intended integration points for issuer registry contracts."
        actions={
          <>
            {/* TODO: Wire this to addIssuerOnChain() after the issuer registry contract exists. */}
            <Button disabled variant="outline">
              <Building2 />
              Register Issuer On-chain
            </Button>
            {/* TODO: Read issuer registry state from isTrustedIssuerOnChain(). */}
            <Button disabled variant="outline">
              <ShieldCheck />
              Check On-chain Trust
            </Button>
          </>
        }
      />
    </div>
  );
}
