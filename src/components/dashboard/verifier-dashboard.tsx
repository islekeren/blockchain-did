"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ShieldQuestion, XCircle } from "lucide-react";

import { JsonViewer } from "@/components/dashboard/json-viewer";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  CredentialRecord,
  VerificationCheck,
  VerificationResult
} from "@/lib/types";

type CredentialsResponse = {
  credentials: CredentialRecord[];
};

export function VerifierDashboard() {
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [credentialJson, setCredentialJson] = useState("");
  const [verifierName, setVerifierName] = useState("EduDiscounts Marketplace");
  const [result, setResult] = useState<VerificationResult | null>(null);
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

    setResult({
      result: data.result,
      checks: data.checks ?? []
    });
    setVerifying(false);
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Credential input</CardTitle>
            <CardDescription>
              Select a local credential or paste minimal credential JSON copied from the student wallet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={verify} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Verifier platform</label>
                <Input
                  value={verifierName}
                  onChange={(event) => setVerifierName(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
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

              <div className="space-y-2">
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
              The result is based only on local database and credential payload checks in this phase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <div className="space-y-4">
                <Alert variant={result.result === "APPROVED" ? "success" : "destructive"}>
                  <AlertTitle className="flex items-center gap-2">
                    {result.result === "APPROVED" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                    {result.result === "APPROVED" ? "Approved" : "Rejected"}
                  </AlertTitle>
                  <AlertDescription>
                    {result.result === "APPROVED"
                      ? "All local verification checks passed."
                      : "One or more local verification checks failed."}
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  {result.checks.map((check) => (
                    <div
                      key={check.label}
                      className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted p-4"
                    >
                      <div>
                        <p className="font-medium">{check.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {check.detail}
                        </p>
                      </div>
                      <StatusBadge value={check.passed ? "Approved" : "Rejected"} />
                    </div>
                  ))}
                </div>
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

      <PlaceholderCard
        title="Future Blockchain and Presentation Checks"
        description="These checks are intentionally disabled until the smart contracts, wallet signatures, and DID resolver are added."
        actions={
          <>
            {/* TODO: Wire to isTrustedIssuerOnChain(). */}
            <Button disabled variant="outline">
              Issuer trusted on-chain
            </Button>
            {/* TODO: Wire to registryClient.isCredentialRevokedOnChain(). */}
            <Button disabled variant="outline">
              Credential not revoked on-chain
            </Button>
            {/* TODO: Wire to credential hash registry reads. */}
            <Button disabled variant="outline">
              Credential hash registered on-chain
            </Button>
            {/* TODO: Verify holder presentation signature after wallet integration. */}
            <Button disabled variant="outline">
              Student presentation signature valid
            </Button>
          </>
        }
      />
    </div>
  );
}
