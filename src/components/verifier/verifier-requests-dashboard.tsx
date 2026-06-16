"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  RefreshCw,
  ShieldCheck
} from "lucide-react";

import { useWalletConnection } from "@/components/auth/wallet-provider";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type {
  VerificationRequestRecord,
  VerificationRequestStatus
} from "@/lib/types";

type RequestsResponse = {
  requests: VerificationRequestRecord[];
  error?: string;
};

type CreatedRequest = {
  requestId: string;
  nonce: string;
  verifierName: string;
  requestedCredentialType: string;
  expiresAt: string;
  walletRedirectUrl: string;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not set";
}

function shortId(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function emptySummary() {
  return {
    total: 0,
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    EXPIRED: 0
  } satisfies Record<"total" | VerificationRequestStatus, number>;
}

export function VerifierRequestsDashboard() {
  const wallet = useWalletConnection();
  const [requests, setRequests] = useState<VerificationRequestRecord[]>([]);
  const [verifierName, setVerifierName] = useState("Spotify Student Discount");
  const [createdRequest, setCreatedRequest] = useState<CreatedRequest | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/verifier/requests", { cache: "no-store" });
    const data = (await response.json()) as RequestsResponse;

    if (!response.ok) {
      setMessage(data.error ?? "Unable to load verification requests");
      setLoading(false);
      return;
    }

    setRequests(data.requests ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRequests();

    const handleAuthChanged = () => {
      void loadRequests();
    };

    window.addEventListener("wallet-auth-changed", handleAuthChanged);

    return () => {
      window.removeEventListener("wallet-auth-changed", handleAuthChanged);
    };
  }, [loadRequests]);

  const summary = useMemo(() => {
    return requests.reduce((accumulator, request) => {
      accumulator.total += 1;
      accumulator[request.status] += 1;
      return accumulator;
    }, emptySummary());
  }, [requests]);

  async function copyValue(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1500);
  }

  async function createDemoRequest() {
    setCreating(true);
    setMessage(null);

    const response = await fetch("/api/verifier/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verifierName,
        requestedCredentialType: "StudentCredential"
      })
    });
    const data = (await response.json()) as CreatedRequest & { error?: string };

    if (!response.ok) {
      setMessage(data.error ?? "Unable to create verification request");
      setCreating(false);
      return;
    }

    setCreatedRequest(data);
    await loadRequests();
    setCreating(false);
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Verifier Integration Dashboard</CardTitle>
            <CardDescription>
              Track request statuses and send students to the wallet approval page.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void loadRequests()}
              disabled={loading}
            >
              <RefreshCw />
              Refresh
            </Button>
            <Button asChild variant="outline">
              <Link href="/verifier/debug">
                <FileText />
                Advanced Debug Mode
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-border bg-muted p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Connected verifier wallet
            </p>
            <p className="mt-2 break-all font-mono text-sm">
              {wallet.address ?? "No wallet connected"}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Demo verifier name</label>
              <Input
                value={verifierName}
                onChange={(event) => setVerifierName(event.target.value)}
              />
            </div>
            <Button
              className="self-end"
              onClick={() => void createDemoRequest()}
              disabled={creating}
            >
              <ShieldCheck />
              {creating ? "Creating..." : "Create Demo Verification Request"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Request dashboard error</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {createdRequest ? (
        <Card>
          <CardHeader>
            <CardTitle>Demo request ready</CardTitle>
            <CardDescription>
              Send this redirect URL to the student wallet approval flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Request ID
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="break-all font-mono text-sm">
                    {createdRequest.requestId}
                  </p>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Copy request ID"
                    onClick={() =>
                      void copyValue("created-request", createdRequest.requestId)
                    }
                  >
                    {copied === "created-request" ? <Check /> : <Copy />}
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Wallet redirect URL
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="break-all font-mono text-sm">
                    {createdRequest.walletRedirectUrl}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Copy redirect URL"
                      onClick={() =>
                        void copyValue("created-url", createdRequest.walletRedirectUrl)
                      }
                    >
                      {copied === "created-url" ? <Check /> : <Copy />}
                    </Button>
                    <Button asChild size="icon" variant="outline">
                      <Link
                        href={createdRequest.walletRedirectUrl}
                        aria-label="Open redirect URL"
                      >
                        <ExternalLink />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ["Total", summary.total],
          ["Pending", summary.PENDING],
          ["Approved", summary.APPROVED],
          ["Rejected", summary.REJECTED],
          ["Expired", summary.EXPIRED]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent verification requests</CardTitle>
          <CardDescription>
            Requests are ordered by creation time and reflect computed expiry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No verification requests yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Verifier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.requestId}>
                    <TableCell className="font-mono text-xs">
                      {shortId(request.requestId)}
                    </TableCell>
                    <TableCell>{request.verifierName}</TableCell>
                    <TableCell>
                      <StatusBadge value={request.status} />
                    </TableCell>
                    <TableCell>{formatDate(request.createdAt)}</TableCell>
                    <TableCell>{formatDate(request.expiresAt)}</TableCell>
                    <TableCell>{formatDate(request.verifiedAt)}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/verifier/requests/${request.requestId}`}>
                          View result
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Separator />
    </div>
  );
}
