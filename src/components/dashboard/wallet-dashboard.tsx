"use client";

import { useEffect, useMemo, useState } from "react";
import { getAddress } from "ethers";
import { Check, Copy, Signature, WalletCards } from "lucide-react";

import { useWalletConnection } from "@/components/auth/wallet-provider";
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
import type { CredentialRecord, StudentRecord } from "@/lib/types";

type StudentsResponse = {
  students: StudentRecord[];
};

type CredentialsResponse = {
  credentials: CredentialRecord[];
};

type VerificationChallenge = {
  requestId: string;
  nonce: string;
  verifierName: string;
  createdAt: string;
  expiresAt: string;
};

type ProofState = {
  signing: boolean;
  proofJson?: string;
  error?: string;
};

function parseChallenge(value: string): VerificationChallenge | null {
  try {
    const parsed = JSON.parse(value) as Partial<VerificationChallenge>;

    if (
      typeof parsed.requestId === "string" &&
      typeof parsed.nonce === "string" &&
      typeof parsed.verifierName === "string" &&
      typeof parsed.createdAt === "string" &&
      typeof parsed.expiresAt === "string"
    ) {
      return parsed as VerificationChallenge;
    }

    return null;
  } catch {
    return null;
  }
}

function walletFromCredentialSubject(credential: CredentialRecord) {
  const subjectDid = credential.credentialJson.credentialSubject.id;
  const match = /^did:ethr:(0x[a-fA-F0-9]{40})$/.exec(subjectDid);
  const walletAddress = match?.[1] ?? credential.student?.walletAddress;

  return walletAddress ? getAddress(walletAddress) : null;
}

export function WalletDashboard() {
  const wallet = useWalletConnection();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedProofId, setCopiedProofId] = useState<string | null>(null);
  const [challengeInputs, setChallengeInputs] = useState<Record<string, string>>({});
  const [proofStates, setProofStates] = useState<Record<string, ProofState>>({});

  async function loadStudents() {
    const response = await fetch("/api/students", { cache: "no-store" });
    const data = (await response.json()) as StudentsResponse;
    const nextStudents = data.students ?? [];
    setStudents(nextStudents);
    setSelectedStudentId((current) => current || nextStudents[0]?.id || "");
  }

  async function loadCredentials(studentId: string) {
    if (!studentId) {
      setCredentials([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const response = await fetch(
      `/api/credentials/by-student?studentId=${encodeURIComponent(studentId)}`,
      { cache: "no-store" }
    );
    const data = (await response.json()) as CredentialsResponse;
    setCredentials(data.credentials ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadStudents();

    const handleAuthChanged = () => {
      void loadStudents();
    };

    window.addEventListener("wallet-auth-changed", handleAuthChanged);

    return () => {
      window.removeEventListener("wallet-auth-changed", handleAuthChanged);
    };
  }, []);

  useEffect(() => {
    void loadCredentials(selectedStudentId);
  }, [selectedStudentId]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId),
    [students, selectedStudentId]
  );

  async function copyCredential(credential: CredentialRecord) {
    await navigator.clipboard.writeText(
      JSON.stringify(credential.credentialJson, null, 2)
    );
    setCopiedId(credential.id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  async function copyProof(credential: CredentialRecord) {
    const proofJson = proofStates[credential.id]?.proofJson;

    if (!proofJson) {
      return;
    }

    await navigator.clipboard.writeText(proofJson);
    setCopiedProofId(credential.id);
    window.setTimeout(() => setCopiedProofId(null), 1500);
  }

  function setProofState(credentialId: string, nextState: ProofState) {
    setProofStates((current) => ({
      ...current,
      [credentialId]: nextState
    }));
  }

  async function createPresentationProof(credential: CredentialRecord) {
    const challenge = parseChallenge(challengeInputs[credential.id] ?? "");
    const studentWalletAddress = walletFromCredentialSubject(credential);

    if (!challenge) {
      setProofState(credential.id, {
        signing: false,
        error: "Paste a valid verifier challenge JSON first."
      });
      return;
    }

    if (!credential.credentialHash) {
      setProofState(credential.id, {
        signing: false,
        error: "Credential hash is missing."
      });
      return;
    }

    if (!studentWalletAddress) {
      setProofState(credential.id, {
        signing: false,
        error: "Credential subject wallet could not be read."
      });
      return;
    }

    setProofState(credential.id, { signing: true });

    try {
      const signed = await signPresentation({
        credentialId: credential.credentialId,
        credentialHash: credential.credentialHash,
        studentWalletAddress,
        verifierName: challenge.verifierName,
        requestId: challenge.requestId,
        nonce: challenge.nonce
      });
      const proof = {
        credentialId: credential.credentialId,
        credentialHash: credential.credentialHash.toLowerCase(),
        studentWalletAddress,
        requestId: challenge.requestId,
        nonce: challenge.nonce,
        verifierName: challenge.verifierName,
        message: signed.message,
        signature: signed.signature
      };

      setProofState(credential.id, {
        signing: false,
        proofJson: JSON.stringify(proof, null, 2)
      });
    } catch (error) {
      setProofState(credential.id, {
        signing: false,
        error: toBlockchainErrorMessage(error)
      });
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Select student</CardTitle>
            <CardDescription>
              Choose a seeded or newly created student to inspect their wallet contents.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name} · {student.studentNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedStudent ? (
              <div className="rounded-lg border border-border bg-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{selectedStudent.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedStudent.university?.name} · {selectedStudent.department}
                    </p>
                  </div>
                  <StatusBadge value={selectedStudent.active ? "Active" : "Inactive"} />
                </div>
                <Separator className="my-4" />
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {selectedStudent.walletAddress}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wallet summary</CardTitle>
            <CardDescription>
              Credential presentations omit student name, number, department, and national identity-like fields.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs text-muted-foreground">Credentials</p>
              <p className="mt-2 text-3xl font-semibold">{credentials.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs text-muted-foreground">Issued</p>
              <p className="mt-2 text-3xl font-semibold">
                {credentials.filter((item) => item.status === "ISSUED").length}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs text-muted-foreground">Proofs</p>
              <p className="mt-2 text-3xl font-semibold">
                {Object.values(proofStates).filter((state) => state.proofJson).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {copiedId ? (
        <Alert variant="success">
          <AlertTitle>Credential copied</AlertTitle>
          <AlertDescription>
            The minimal credential JSON is ready to paste into the verifier.
          </AlertDescription>
        </Alert>
      ) : null}

      {copiedProofId ? (
        <Alert variant="success">
          <AlertTitle>Presentation proof copied</AlertTitle>
          <AlertDescription>
            The signed proof JSON is ready to paste into the verifier.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="p-5">Loading credentials...</CardContent>
          </Card>
        ) : credentials.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-5 text-muted-foreground">
              <WalletCards />
              No credentials found for this student.
            </CardContent>
          </Card>
        ) : (
          credentials.map((credential) => {
            const proofState = proofStates[credential.id];
            const studentWalletAddress = walletFromCredentialSubject(credential);
            const wrongWallet =
              Boolean(wallet.address && studentWalletAddress) &&
              wallet.address !== studentWalletAddress;

            return (
              <Card key={credential.id}>
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="font-mono text-base">
                      {credential.credentialId}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Issued by {credential.issuer?.name ?? "Unknown issuer"} · Expires{" "}
                      {new Date(credential.expiresAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={credential.status} />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void copyCredential(credential)}
                    >
                      {copiedId === credential.id ? <Check /> : <Copy />}
                      Copy JSON
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <JsonViewer value={credential.credentialJson} />
                  <Separator />
                  <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="flex flex-col gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Create Presentation Proof
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Paste a verifier challenge, then sign a deterministic presentation message with the student wallet.
                        </p>
                      </div>
                      {studentWalletAddress ? (
                        <div className="rounded-md border border-border bg-muted p-3">
                          <p className="text-xs font-medium uppercase text-muted-foreground">
                            Credential subject wallet
                          </p>
                          <p className="break-all font-mono text-xs">
                            {studentWalletAddress}
                          </p>
                        </div>
                      ) : null}
                      {wrongWallet ? (
                        <Alert variant="warning">
                          <AlertTitle>Wallet mismatch</AlertTitle>
                          <AlertDescription>
                            Connected wallet {wallet.address} does not match the credential subject wallet. A signature from this wallet will be rejected.
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      {proofState?.error ? (
                        <Alert variant="destructive">
                          <AlertTitle>Proof signing failed</AlertTitle>
                          <AlertDescription>{proofState.error}</AlertDescription>
                        </Alert>
                      ) : null}
                      <Textarea
                        value={challengeInputs[credential.id] ?? ""}
                        onChange={(event) =>
                          setChallengeInputs((current) => ({
                            ...current,
                            [credential.id]: event.target.value
                          }))
                        }
                        className="min-h-40 font-mono text-xs leading-5"
                        placeholder='Paste {"requestId":"...","nonce":"..."} challenge JSON here'
                      />
                      <Button
                        onClick={() => void createPresentationProof(credential)}
                        disabled={
                          proofState?.signing ||
                          !wallet.hasMetaMask ||
                          !wallet.isLocalHardhat
                        }
                      >
                        <Signature />
                        {proofState?.signing
                          ? "Signing..."
                          : "Create Presentation Proof"}
                      </Button>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold">Presentation proof JSON</h3>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void copyProof(credential)}
                          disabled={!proofState?.proofJson}
                        >
                          {copiedProofId === credential.id ? <Check /> : <Copy />}
                          Copy Proof
                        </Button>
                      </div>
                      <Textarea
                        readOnly
                        value={proofState?.proofJson ?? ""}
                        className="min-h-64 font-mono text-xs leading-5"
                        placeholder="Signed presentation proof will appear here"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
