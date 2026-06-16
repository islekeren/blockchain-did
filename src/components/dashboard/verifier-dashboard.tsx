"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Copy, KeyRound, ShieldQuestion, XCircle } from "lucide-react";

import { JsonViewer } from "@/components/dashboard/json-viewer";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
  presentationChecks: VerificationCheck[];
};

type VerificationChallenge = {
  requestId: string;
  nonce: string;
  verifierName: string;
  createdAt: string;
  expiresAt: string;
};

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
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [credentialJson, setCredentialJson] = useState("");
  const [presentationProofJson, setPresentationProofJson] = useState("");
  const [verifierName, setVerifierName] = useState("EduDiscounts Marketplace");
  const [result, setResult] = useState<SplitVerificationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [challengeMessage, setChallengeMessage] = useState<string | null>(null);
  const [challengeCopied, setChallengeCopied] = useState(false);

  async function loadCredentials() {
    const response = await fetch("/api/credentials", { cache: "no-store" });
    const data = (await response.json()) as CredentialsResponse;
    setCredentials(data.credentials ?? []);
  }

  useEffect(() => {
    void loadCredentials();

    const handleAuthChanged = () => {
      void loadCredentials();
    };

    window.addEventListener("wallet-auth-changed", handleAuthChanged);

    return () => {
      window.removeEventListener("wallet-auth-changed", handleAuthChanged);
    };
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

  async function createChallenge() {
    setCreatingChallenge(true);
    setChallengeMessage(null);

    const response = await fetch("/api/verification-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verifierName })
    });

    const data = (await response.json()) as {
      challenge?: VerificationChallenge;
      error?: string;
    };

    if (!response.ok || !data.challenge) {
      setChallengeMessage(data.error ?? "Unable to create verification challenge");
      setCreatingChallenge(false);
      return;
    }

    setChallenge(data.challenge);
    setChallengeMessage("Challenge created. Send it to the student wallet.");
    setCreatingChallenge(false);
  }

  async function copyChallenge() {
    if (!challenge) {
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(challenge, null, 2));
    setChallengeCopied(true);
    window.setTimeout(() => setChallengeCopied(false), 1500);
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifying(true);
    setMessage(null);
    setResult(null);

    const response = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentialId: selectedCredentialId || undefined,
        credentialJson: credentialJson || undefined,
        presentationProofJson: presentationProofJson || undefined,
        verifierName
      })
    });

    const data = (await response.json()) as VerificationResult & {
      error?: string;
      checks?: VerificationCheck[];
      offChainChecks?: VerificationCheck[];
      onChainChecks?: VerificationCheck[];
      presentationChecks?: VerificationCheck[];
    };

    if (!response.ok) {
      setMessage(data.error ?? "Unable to verify credential");
      setVerifying(false);
      return;
    }

    setResult({
      result: data.result,
      offChainChecks: data.offChainChecks ?? data.checks ?? [],
      onChainChecks: data.onChainChecks ?? [],
      presentationChecks: data.presentationChecks ?? []
    });
    setVerifying(false);
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Create Verification Challenge</CardTitle>
            <CardDescription>
              Generate a 10-minute nonce for the student to sign from their wallet.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void createChallenge()} disabled={creatingChallenge}>
              <KeyRound />
              {creatingChallenge ? "Creating..." : "Generate Challenge"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void copyChallenge()}
              disabled={!challenge}
            >
              {challengeCopied ? <Check /> : <Copy />}
              Copy Challenge
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Verifier name</label>
            <Input
              value={verifierName}
              onChange={(event) => setVerifierName(event.target.value)}
              required
            />
          </div>
          {challengeMessage ? (
            <Alert variant={challenge ? "success" : "destructive"}>
              <AlertTitle>{challenge ? "Challenge ready" : "Challenge failed"}</AlertTitle>
              <AlertDescription>{challengeMessage}</AlertDescription>
            </Alert>
          ) : null}
          <Textarea
            readOnly
            value={challenge ? JSON.stringify(challenge, null, 2) : ""}
            className="min-h-40 font-mono text-xs leading-5"
            placeholder="Generated challenge JSON will appear here"
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Credential input</CardTitle>
            <CardDescription>
              Select or paste credential JSON, then paste the signed presentation proof from the student wallet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={verify} className="flex flex-col gap-4">
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

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Presentation proof JSON</label>
                <Textarea
                  value={presentationProofJson}
                  onChange={(event) => {
                    setPresentationProofJson(event.target.value);
                    setResult(null);
                  }}
                  className="min-h-52 font-mono text-xs leading-5"
                  placeholder='Paste {"credentialId":"...","signature":"..."} proof JSON here'
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
              The final result requires off-chain checks, on-chain checks, and holder presentation proof checks to pass.
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
                      ? "All off-chain, on-chain, and holder proof checks passed."
                      : "One or more required credential, registry, or holder proof checks failed."}
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
                <Separator />
                <VerificationSection
                  title="Holder presentation proof checks"
                  checks={result.presentationChecks}
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
