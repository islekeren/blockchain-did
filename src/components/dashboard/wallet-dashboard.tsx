"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, WalletCards } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { CredentialRecord, StudentRecord } from "@/lib/types";

type StudentsResponse = {
  students: StudentRecord[];
};

type CredentialsResponse = {
  credentials: CredentialRecord[];
};

export function WalletDashboard() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
          <CardContent className="space-y-4">
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
              <p className="text-xs text-muted-foreground">Wallet phase</p>
              <p className="mt-2 text-3xl font-semibold">Local</p>
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

      <div className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="p-5">Loading credentials...</CardContent>
          </Card>
        ) : credentials.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-5 text-muted-foreground">
              <WalletCards className="h-5 w-5" />
              No credentials found for this student.
            </CardContent>
          </Card>
        ) : (
          credentials.map((credential) => (
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
              <CardContent>
                <JsonViewer value={credential.credentialJson} />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <PlaceholderCard
        title="Sign Presentation With Wallet Later"
        description="This section will eventually request a wallet signature over a verifiable presentation. MetaMask and DID resolver support are intentionally not required in this phase."
        actions={
          <>
            {/* TODO: Build verifiable presentation signing after wallet integration exists. */}
            <Button disabled variant="outline">
              Sign presentation with wallet later
            </Button>
          </>
        }
      />
    </div>
  );
}
