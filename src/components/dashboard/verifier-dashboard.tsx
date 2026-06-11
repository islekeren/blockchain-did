"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAddress } from "ethers";
import { CheckCircle2, ShieldQuestion, XCircle } from "lucide-react";

import { JsonViewer } from "@/components/dashboard/json-viewer";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { WalletConnect } from "@/components/wallet-connect";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useWallet } from "@/hooks/useWallet";
import {
  getCredentialIssuerOnChain,
  getSchemaNameOnChain,
  isCredentialRegisteredOnChain,
  isCredentialRevokedOnChain,
  isSchemaValidOnChain,
  isTrustedIssuerOnChain
} from "@/lib/blockchain/registryClient";
import { hashCredentialPayload } from "@/lib/credential/hash";
import { hashCredentialSchema } from "@/lib/credential/schema";
import {
  isStudentCredentialPayload,
  type StudentCredentialPayload
} from "@/lib/credential/vc";
import type {
  CredentialRecord,
  VerificationCheck,
  VerificationResult
} from "@/lib/types";

type CredentialsResponse = {
  credentials: CredentialRecord[];
};

type SplitVerificationResult = {
  result: VerificationResult["result"];
  offChainChecks: VerificationCheck[];
  onChainChecks: VerificationCheck[];
};

const onChainCheckLabels = [
  "Issuer trusted on-chain",
  "Schema valid on-chain",
  "Credential hash registered on-chain",
  "Credential not revoked on-chain",
  "Credential issuer matches on-chain"
];

function parseCredentialInput(value?: string) {
  if (!value?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isStudentCredentialPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function safeHashCredential(payload: StudentCredentialPayload | null) {
  if (!payload) {
    return null;
  }

  try {
    return hashCredentialPayload(payload);
  } catch {
    return null;
  }
}

function skippedOnChainChecks(reason: string): VerificationCheck[] {
  return onChainCheckLabels.map((label) => ({
    label,
    passed: false,
    detail: reason
  }));
}

function findMatchingCredential(
  credentials: CredentialRecord[],
  selectedCredential: CredentialRecord | undefined,
  payload: StudentCredentialPayload | null,
  credentialHash: string | null
) {
  if (selectedCredential) {
    return selectedCredential;
  }

  return credentials.find((credential) => {
    const hashMatches =
      Boolean(credentialHash && credential.credentialHash) &&
      credential.credentialHash?.toLowerCase() === credentialHash?.toLowerCase();

    return (
      credential.credentialId === payload?.id ||
      credential.id === payload?.id ||
      hashMatches
    );
  });
}

function getCheck(checks: VerificationCheck[], label: string) {
  return checks.find((check) => check.label === label);
}

function VerificationSection({
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

export function VerifierDashboard() {
  const wallet = useWallet();
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [credentialJson, setCredentialJson] = useState("");
  const [verifierName, setVerifierName] = useState("EduDiscounts Marketplace");
  const [result, setResult] = useState<SplitVerificationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function loadCredentials() {
    const response = await fetch("/api/credentials", { cache: "no-store" });
    const data = (await response.json()) as CredentialsResponse;
    setCredentials(data.credentials ?? []);
  }

  useEffect(() => {
    void loadCredentials();
  }, []);

  const selectedCredential = useMemo(
    () =>
      credentials.find(
        (credential) => credential.credentialId === selectedCredentialId
      ),
    [credentials, selectedCredentialId]
  );

  function selectCredential(credentialId: string) {
    setSelectedCredentialId(credentialId);
    const credential = credentials.find((item) => item.credentialId === credentialId);
    setCredentialJson(
      credential ? JSON.stringify(credential.credentialJson, null, 2) : ""
    );
    setResult(null);
  }

  async function runOnChainChecks(
    offChainChecks: VerificationCheck[],
    payload: StudentCredentialPayload | null,
    credentialHash: string | null
  ) {
    const integrityCheck = getCheck(
      offChainChecks,
      "Presented credential hash matches stored hash"
    );

    if (!wallet.hasMetaMask) {
      return skippedOnChainChecks("MetaMask is required for local on-chain reads.");
    }

    if (!wallet.isLocalHardhat) {
      return skippedOnChainChecks(
        "Switch MetaMask to local Hardhat chain 31337 before running on-chain checks."
      );
    }

    if (!integrityCheck?.passed) {
      return skippedOnChainChecks(
        "Skipped because the presented credential failed the local integrity check."
      );
    }

    if (!payload || !credentialHash) {
      return skippedOnChainChecks(
        "Skipped because the credential payload or hash is unavailable."
      );
    }

    try {
      const issuerAddress = getAddress(payload.issuer.walletAddress);
      const schemaHash = hashCredentialSchema({
        name: payload.schema.name,
        version: payload.schema.version
      });

      const [
        issuerTrusted,
        schemaValid,
        schemaName,
        credentialRegistered,
        credentialRevoked,
        credentialIssuer
      ] = await Promise.all([
        isTrustedIssuerOnChain({ issuerAddress }),
        isSchemaValidOnChain({ schemaHash }),
        getSchemaNameOnChain({ schemaHash }),
        isCredentialRegisteredOnChain({ credentialHash }),
        isCredentialRevokedOnChain({ credentialHash }),
        getCredentialIssuerOnChain({ credentialHash })
      ]);

      const normalizedCredentialIssuer = getAddress(credentialIssuer);
      const issuerMatches =
        credentialRegistered && normalizedCredentialIssuer === issuerAddress;

      return [
        {
          label: "Issuer trusted on-chain",
          passed: issuerTrusted,
          detail: `${payload.issuer.name} (${issuerAddress}) is ${
            issuerTrusted ? "trusted" : "not trusted"
          } on-chain`
        },
        {
          label: "Schema valid on-chain",
          passed: schemaValid,
          detail: schemaValid
            ? `${schemaName || payload.schema.name} is registered for hash ${schemaHash}`
            : `Schema hash ${schemaHash} is not registered`
        },
        {
          label: "Credential hash registered on-chain",
          passed: credentialRegistered,
          detail: credentialRegistered
            ? `Credential hash ${credentialHash} is registered`
            : `Credential hash ${credentialHash} is not registered`
        },
        {
          label: "Credential not revoked on-chain",
          passed: !credentialRevoked,
          detail: credentialRevoked
            ? "Credential hash is revoked on-chain"
            : "Credential hash is not revoked on-chain"
        },
        {
          label: "Credential issuer matches on-chain",
          passed: issuerMatches,
          detail: `On-chain issuer ${normalizedCredentialIssuer}; credential issuer ${issuerAddress}`
        }
      ];
    } catch (error) {
      return skippedOnChainChecks(
        error instanceof Error ? error.message : "On-chain verification failed."
      );
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifying(true);
    setMessage(null);
    setResult(null);

    const pastedCredential = parseCredentialInput(credentialJson);
    const selectedPayload = isStudentCredentialPayload(
      selectedCredential?.credentialJson
    )
      ? selectedCredential.credentialJson
      : null;
    const credentialPayload = pastedCredential ?? selectedPayload;
    const presentedCredentialHash =
      safeHashCredential(credentialPayload) ?? selectedCredential?.credentialHash ?? null;
    const matchingCredential = findMatchingCredential(
      credentials,
      selectedCredential,
      credentialPayload,
      presentedCredentialHash
    );

    const response = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentialId: selectedCredentialId || undefined,
        credentialJson: credentialJson || undefined,
        verifierName
      })
    });

    const data = (await response.json()) as VerificationResult & {
      error?: string;
      checks?: VerificationCheck[];
    };

    if (!response.ok) {
      setMessage(data.error ?? "Unable to verify credential");
      setVerifying(false);
      return;
    }

    const offChainChecks = data.checks ?? [];
    const onChainChecks = await runOnChainChecks(
      offChainChecks,
      credentialPayload,
      presentedCredentialHash ?? matchingCredential?.credentialHash ?? null
    );
    const approved =
      offChainChecks.every((check) => check.passed) &&
      onChainChecks.every((check) => check.passed);

    setResult({
      result: approved ? "APPROVED" : "REJECTED",
      offChainChecks,
      onChainChecks
    });
    setVerifying(false);
  }

  return (
    <div className="grid gap-6">
      <WalletConnect wallet={wallet} />

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Credential input</CardTitle>
            <CardDescription>
              Select a local credential or paste minimal credential JSON copied from the student wallet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={verify} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Verifier platform</label>
                <Input
                  value={verifierName}
                  onChange={(event) => setVerifierName(event.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Credential record</label>
                <Select
                  value={selectedCredentialId}
                  onValueChange={selectCredential}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select credential from database" />
                  </SelectTrigger>
                  <SelectContent>
                    {credentials.map((credential) => (
                      <SelectItem
                        key={credential.id}
                        value={credential.credentialId}
                      >
                        {credential.student?.name ?? "Student"} · {credential.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Credential JSON</label>
                <Textarea
                  value={credentialJson}
                  onChange={(event) => {
                    setCredentialJson(event.target.value);
                    setSelectedCredentialId("");
                    setResult(null);
                  }}
                  className="min-h-64 font-mono text-xs leading-5"
                  placeholder='Paste {"id":"credential-..."} here'
                />
              </div>

              <Button type="submit" disabled={verifying} className="w-full">
                <ShieldQuestion />
                {verifying ? "Verifying..." : "Verify credential"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verification result</CardTitle>
            <CardDescription>
              The final result requires both local off-chain checks and on-chain registry checks to pass.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {message ? (
              <Alert variant="destructive">
                <AlertTitle>Verification failed</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}

            {!result && !message ? (
              <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
                Select or paste a credential to see approval checks.
              </div>
            ) : null}

            {result ? (
              <div className="flex flex-col gap-4">
                <Alert variant={result.result === "APPROVED" ? "success" : "destructive"}>
                  <AlertTitle className="flex items-center gap-2">
                    {result.result === "APPROVED" ? (
                      <CheckCircle2 />
                    ) : (
                      <XCircle />
                    )}
                    {result.result === "APPROVED" ? "Approved" : "Rejected"}
                  </AlertTitle>
                  <AlertDescription>
                    {result.result === "APPROVED"
                      ? "All off-chain and on-chain verification checks passed."
                      : "One or more required off-chain or on-chain checks failed."}
                  </AlertDescription>
                </Alert>

                <VerificationSection
                  title="Off-chain checks"
                  checks={result.offChainChecks}
                />
                <Separator />
                <VerificationSection
                  title="On-chain checks"
                  checks={result.onChainChecks}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {selectedCredential ? (
        <Card>
          <CardHeader>
            <CardTitle>Selected credential preview</CardTitle>
            <CardDescription>
              The verifier sees a minimal credential payload, not private student profile data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JsonViewer value={selectedCredential.credentialJson} minHeight="min-h-56" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
