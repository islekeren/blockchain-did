"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAddress } from "ethers";
import { Check, Copy, ExternalLink, Signature } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toBlockchainErrorMessage } from "@/lib/blockchain/provider";
import { signPresentation } from "@/lib/presentation/message";
import type {
  CredentialRecord,
  VerificationCheck,
  VerificationRequestRecord
} from "@/lib/types";

type RequestResponse = {
  request?: VerificationRequestRecord;
  error?: string;
};

type CredentialsResponse = {
  credentials: CredentialRecord[];
  error?: string;
};

type PresentationResult = {
  result: "APPROVED" | "REJECTED";
  offChainChecks: VerificationCheck[];
  onChainChecks: VerificationCheck[];
  presentationChecks: VerificationCheck[];
  error?: string;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not set";
}

function walletFromCredentialSubject(credential: CredentialRecord) {
  const subjectDid = credential.credentialJson.credentialSubject.id;
  const match = /^did:ethr:(0x[a-fA-F0-9]{40})$/.exec(subjectDid);
  const walletAddress = match?.[1] ?? credential.student?.walletAddress;

  return walletAddress ? getAddress(walletAddress) : null;
}

function CheckSummary({
  title,
  checks
}: {
  title: string;
  checks: VerificationCheck[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {checks.map((check) => (
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
      ))}
    </div>
  );
}

export function WalletPresentationApproval({
  requestId
}: {
  requestId: string;
}) {
  const wallet = useWalletConnection();
  const [request, setRequest] = useState<VerificationRequestRecord | null>(null);
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [result, setResult] = useState<PresentationResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [requestResponse, credentialsResponse] = await Promise.all([
      fetch(`/api/verifier/requests/${requestId}`, { cache: "no-store" }),
      fetch("/api/credentials", { cache: "no-store" })
    ]);
    const requestData = (await requestResponse.json()) as RequestResponse;
    const credentialsData = (await credentialsResponse.json()) as CredentialsResponse;

    if (!requestResponse.ok || !requestData.request) {
      setMessage(requestData.error ?? "Unable to load verification request");
      setLoading(false);
      return;
    }

    if (!credentialsResponse.ok) {
      setMessage(credentialsData.error ?? "Unable to load wallet credentials");
      setLoading(false);
      return;
    }

    setRequest(requestData.request);
    setCredentials(credentialsData.credentials ?? []);
    setSelectedCredentialId((current) => {
      if (current) {
        return current;
      }

      const eligible = (credentialsData.credentials ?? []).find(
        (credential) =>
          credential.status === "ISSUED" &&
          credential.type === requestData.request?.requestedCredentialType
      );

      return eligible?.credentialId ?? "";
    });
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const eligibleCredentials = useMemo(() => {
    if (!request) {
      return [];
    }

    return credentials.filter(
      (credential) =>
        credential.status === "ISSUED" &&
        credential.type === request.requestedCredentialType
    );
  }, [credentials, request]);

  const selectedCredential = useMemo(
    () =>
      credentials.find(
        (credential) => credential.credentialId === selectedCredentialId
      ) ?? null,
    [credentials, selectedCredentialId]
  );

  const selectedWalletAddress = selectedCredential
    ? walletFromCredentialSubject(selectedCredential)
    : null;
  const wrongWallet =
    Boolean(wallet.address && selectedWalletAddress) &&
    wallet.address !== selectedWalletAddress;
  const challenge = request
    ? {
        requestId: request.requestId,
        nonce: request.nonce,
        verifierName: request.verifierName,
        expiresAt: request.expiresAt,
        requestedCredentialType: request.requestedCredentialType
      }
    : null;

  async function copyValue(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1500);
  }

  async function approveWithWallet() {
    if (!request || !selectedCredential || !selectedWalletAddress) {
      setMessage("Select an eligible credential before approving.");
      return;
    }

    if (!request.nonce) {
      setMessage("Verification request nonce is missing.");
      return;
    }

    if (!selectedCredential.credentialHash) {
      setMessage("Credential hash is missing.");
      return;
    }

    setApproving(true);
    setMessage(null);
    setResult(null);

    try {
      const signed = await signPresentation({
        credentialId: selectedCredential.credentialId,
        credentialHash: selectedCredential.credentialHash,
        studentWalletAddress: selectedWalletAddress,
        verifierName: request.verifierName,
        requestId: request.requestId,
        nonce: request.nonce
      });
      const presentationProof = {
        credentialId: selectedCredential.credentialId,
        credentialHash: selectedCredential.credentialHash.toLowerCase(),
        studentWalletAddress: selectedWalletAddress,
        requestId: request.requestId,
        nonce: request.nonce,
        verifierName: request.verifierName,
        message: signed.message,
        signature: signed.signature
      };
      const response = await fetch(
        `/api/verifier/requests/${request.requestId}/presentation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credentialId: selectedCredential.credentialId,
            presentationProof
          })
        }
      );
      const data = (await response.json()) as PresentationResult;

      if (!response.ok) {
        setMessage(data.error ?? "Presentation was rejected before verification.");
        setApproving(false);
        await load();
        return;
      }

      setResult(data);
      await load();
      setApproving(false);
    } catch (error) {
      setMessage(toBlockchainErrorMessage(error));
      setApproving(false);
    }
  }

  if (loading && !request) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Loading verification request...
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
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-3">
              Wallet Approval
              <StatusBadge value={request.status} />
            </CardTitle>
            <CardDescription>
              Review what the verifier requested before signing with MetaMask.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href={`/verifier/requests/${request.requestId}`}>
              <ExternalLink />
              Return to Verifier Result
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Verifier
            </p>
            <p className="mt-2 text-sm">{request.verifierName}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Requested credential
            </p>
            <p className="mt-2 text-sm">{request.requestedCredentialType}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Expires
            </p>
            <p className="mt-2 text-sm">{formatDate(request.expiresAt)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Connected wallet
            </p>
            <p className="mt-2 break-all font-mono text-sm">
              {wallet.address ?? "No wallet connected"}
            </p>
          </div>
        </CardContent>
      </Card>

      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Approval failed</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Shared student status</CardTitle>
          <CardDescription>
            The verifier receives eligibility facts from the selected credential.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">Eligible credential</label>
            <Select
              value={selectedCredentialId}
              onValueChange={setSelectedCredentialId}
              disabled={request.status !== "PENDING"}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select eligible credential" />
              </SelectTrigger>
              <SelectContent>
                {eligibleCredentials.map((credential) => (
                  <SelectItem
                    key={credential.id}
                    value={credential.credentialId}
                  >
                    {credential.issuer?.name ?? "Issuer"} · expires{" "}
                    {new Date(credential.expiresAt).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {eligibleCredentials.length === 0 ? (
              <Alert variant="warning">
                <AlertTitle>No eligible credential</AlertTitle>
                <AlertDescription>
                  This wallet does not have an issued credential matching the request.
                </AlertDescription>
              </Alert>
            ) : null}
            {wrongWallet ? (
              <Alert variant="warning">
                <AlertTitle>Wallet mismatch</AlertTitle>
                <AlertDescription>
                  Connected wallet {wallet.address} does not match the selected credential subject wallet.
                </AlertDescription>
              </Alert>
            ) : null}
            <Button
              onClick={() => void approveWithWallet()}
              disabled={
                approving ||
                request.status !== "PENDING" ||
                !selectedCredential ||
                !wallet.hasMetaMask ||
                !wallet.isLocalHardhat
              }
            >
              <Signature />
              {approving ? "Approving..." : "Approve with Wallet"}
            </Button>
          </div>
          <div className="grid gap-3">
            {[
              [
                "Active student status",
                selectedCredential
                  ? String(
                      selectedCredential.credentialJson.credentialSubject.activeStudent
                    )
                  : "Select a credential"
              ],
              [
                "University",
                selectedCredential
                  ? selectedCredential.credentialJson.credentialSubject.university
                  : "Select a credential"
              ],
              [
                "Credential expiration",
                selectedCredential
                  ? formatDate(selectedCredential.expiresAt)
                  : "Select a credential"
              ]
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-muted p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 text-sm">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Challenge details</CardTitle>
          <CardDescription>
            Debug copy access for the same request the wallet approval page uses automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <details className="rounded-lg border border-border bg-muted p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Show challenge JSON
            </summary>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void copyValue("request", request.requestId)
                  }
                >
                  {copied === "request" ? <Check /> : <Copy />}
                  Copy request ID
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void copyValue("challenge", JSON.stringify(challenge, null, 2))
                  }
                >
                  {copied === "challenge" ? <Check /> : <Copy />}
                  Copy challenge JSON
                </Button>
              </div>
              <Textarea
                readOnly
                value={JSON.stringify(challenge, null, 2)}
                className="min-h-52 font-mono text-xs leading-5"
              />
            </div>
          </details>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3">
              Verification result
              <StatusBadge value={result.result} />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <CheckSummary title="Off-chain checks" checks={result.offChainChecks} />
            <Separator />
            <CheckSummary title="On-chain checks" checks={result.onChainChecks} />
            <Separator />
            <CheckSummary
              title="Holder presentation checks"
              checks={result.presentationChecks}
            />
            <Button asChild>
              <Link href={`/verifier/requests/${request.requestId}`}>
                Return to Verifier Result
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
