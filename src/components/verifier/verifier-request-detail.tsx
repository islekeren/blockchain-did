"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import type { VerificationCheck, VerificationRequestRecord } from "@/lib/types";

type RequestResponse = {
  request?: VerificationRequestRecord;
  error?: string;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not set";
}

function CheckGroup({
  title,
  checks
}: {
  title: string;
  checks: VerificationCheck[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {checks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No checks stored yet.
        </div>
      ) : (
        checks.map((check) => (
          <div
            key={check.label}
            className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted p-4"
          >
            <div>
              <p className="font-medium">{check.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{check.detail}</p>
            </div>
            <StatusBadge value={check.passed ? "Approved" : "Rejected"} />
          </div>
        ))
      )}
    </div>
  );
}

export function VerifierRequestDetail({ requestId }: { requestId: string }) {
  const [request, setRequest] = useState<VerificationRequestRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const loadRequest = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/verifier/requests/${requestId}`, {
      cache: "no-store"
    });
    const data = (await response.json()) as RequestResponse;

    if (!response.ok || !data.request) {
      setMessage(data.error ?? "Unable to load verification request");
      setLoading(false);
      return;
    }

    setRequest(data.request);
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  async function copyValue(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1500);
  }

  if (loading && !request) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Loading request...
        </CardContent>
      </Card>
    );
  }

  if (!request) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Request unavailable</AlertTitle>
        <AlertDescription>{message ?? "Request not found."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-6">
      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Request detail error</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-3">
              Verification Result
              <StatusBadge value={request.status} />
            </CardTitle>
            <CardDescription>
              Final state and stored verification checks for this request.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void loadRequest()}
              disabled={loading}
            >
              <RefreshCw />
              Refresh
            </Button>
            {request.status === "PENDING" ? (
              <Button asChild>
                <Link href={request.walletRedirectUrl}>
                  <ExternalLink />
                  Open wallet redirect
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Request ID
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="break-all font-mono text-sm">{request.requestId}</p>
              <Button
                size="icon"
                variant="outline"
                aria-label="Copy request ID"
                onClick={() => void copyValue("request", request.requestId)}
              >
                {copied === "request" ? <Check /> : <Copy />}
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Wallet redirect URL
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="break-all font-mono text-sm">
                {request.walletRedirectUrl}
              </p>
              <Button
                size="icon"
                variant="outline"
                aria-label="Copy wallet redirect URL"
                onClick={() => void copyValue("redirect", request.walletRedirectUrl)}
              >
                {copied === "redirect" ? <Check /> : <Copy />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            ["Verifier", request.verifierName],
            ["Credential type", request.requestedCredentialType],
            ["Status", request.status],
            ["Created", formatDate(request.createdAt)],
            ["Expires", formatDate(request.expiresAt)],
            ["Verified", formatDate(request.verifiedAt)]
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {label}
              </p>
              <p className="mt-2 break-words text-sm">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verification checks</CardTitle>
          <CardDescription>
            Off-chain, on-chain, and holder presentation proof checks are stored after submission.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <CheckGroup title="Off-chain checks" checks={request.checkResults.offChain} />
          <Separator />
          <CheckGroup title="On-chain checks" checks={request.checkResults.onChain} />
          <Separator />
          <CheckGroup
            title="Holder presentation checks"
            checks={request.checkResults.holderProof}
          />
        </CardContent>
      </Card>
    </div>
  );
}
