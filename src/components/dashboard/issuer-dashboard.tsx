"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  FileBadge,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserX
} from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CredentialRecord, IssuerRecord, StudentRecord } from "@/lib/types";

type IssuersResponse = {
  issuers: IssuerRecord[];
};

type StudentsResponse = {
  students: StudentRecord[];
};

type CredentialsResponse = {
  credentials: CredentialRecord[];
};

const emptyStudentForm = {
  name: "",
  studentNo: "",
  department: "",
  universityId: "",
  walletAddress: "",
  active: true
};

function shortHash(value?: string | null) {
  if (!value) {
    return "Pending";
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export function IssuerDashboard() {
  const [issuers, setIssuers] = useState<IssuerRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyStudentForm);
  const [message, setMessage] = useState<string | null>(null);
  const [lastIssued, setLastIssued] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [issuerResponse, studentResponse, credentialResponse] = await Promise.all([
      fetch("/api/issuers", { cache: "no-store" }),
      fetch("/api/students", { cache: "no-store" }),
      fetch("/api/credentials", { cache: "no-store" })
    ]);
    const issuerData = (await issuerResponse.json()) as IssuersResponse;
    const studentData = (await studentResponse.json()) as StudentsResponse;
    const credentialData = (await credentialResponse.json()) as CredentialsResponse;
    setIssuers(issuerData.issuers ?? []);
    setStudents(studentData.students ?? []);
    setCredentials(credentialData.credentials ?? []);
    setForm((current) => ({
      ...current,
      universityId: current.universityId || issuerData.issuers?.[0]?.id || ""
    }));
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const activeStudents = useMemo(
    () => students.filter((student) => student.active).length,
    [students]
  );

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const response = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Unable to create student");
      setSaving(false);
      return;
    }

    setDialogOpen(false);
    setForm((current) => ({
      ...emptyStudentForm,
      universityId: current.universityId
    }));
    await loadData();
    setSaving(false);
  }

  async function toggleStudent(student: StudentRecord) {
    await fetch(`/api/students/${student.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !student.active })
    });
    await loadData();
  }

  async function issueCredential(student: StudentRecord) {
    setMessage(null);
    setLastIssued(null);

    const response = await fetch("/api/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: student.id,
        issuerId: student.universityId
      })
    });

    const data = (await response.json()) as {
      credential?: CredentialRecord;
      error?: string;
    };

    if (!response.ok) {
      setMessage(data.error ?? "Unable to issue credential");
      return;
    }

    setLastIssued(data.credential?.credentialId ?? "Credential issued");
    await loadData();
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Students</CardDescription>
            <CardTitle className="text-3xl">{students.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active students</CardDescription>
            <CardTitle className="text-3xl">{activeStudents}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Credentials issued</CardDescription>
            <CardTitle className="text-3xl">{credentials.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Issuer action failed</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {lastIssued ? (
        <Alert variant="success">
          <AlertTitle>Credential issued</AlertTitle>
          <AlertDescription>
            Stored locally as {lastIssued}. The hash is ready for future on-chain registration.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="students">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <TabsList>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadData()}>
              <RefreshCw />
              Refresh
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus />
                  Add student
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createStudent} className="space-y-5">
                  <DialogHeader>
                    <DialogTitle>Add student</DialogTitle>
                    <DialogDescription>
                      Student details stay in the issuer database. Credentials shown to verifiers omit private fields by default.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Name">
                      <Input
                        value={form.name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            name: event.target.value
                          }))
                        }
                        required
                      />
                    </Field>
                    <Field label="Student number">
                      <Input
                        value={form.studentNo}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            studentNo: event.target.value
                          }))
                        }
                        required
                      />
                    </Field>
                    <Field label="Department">
                      <Input
                        value={form.department}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            department: event.target.value
                          }))
                        }
                        required
                      />
                    </Field>
                    <Field label="University">
                      <Select
                        value={form.universityId}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            universityId: value
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select university" />
                        </SelectTrigger>
                        <SelectContent>
                          {issuers.map((issuer) => (
                            <SelectItem key={issuer.id} value={issuer.id}>
                              {issuer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Wallet address">
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
                    </div>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={form.active}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            active: event.target.checked
                          }))
                        }
                      />
                      Active student
                    </label>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving || !form.universityId}>
                      Create student
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>Student roster</CardTitle>
              <CardDescription>
                Active students can receive a new StudentCredential. Inactive students remain visible for rejection demos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>University</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Credentials</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7}>Loading students...</TableCell>
                    </TableRow>
                  ) : students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>No students available.</TableCell>
                    </TableRow>
                  ) : (
                    students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{student.studentNo}</TableCell>
                        <TableCell>{student.department}</TableCell>
                        <TableCell>{student.university?.name ?? "Unknown"}</TableCell>
                        <TableCell>
                          <StatusBadge value={student.active ? "Active" : "Inactive"} />
                        </TableCell>
                        <TableCell>{student._count?.credentials ?? 0}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void toggleStudent(student)}
                            >
                              {student.active ? <UserX /> : <UserCheck />}
                              {student.active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              size="sm"
                              disabled={!student.active}
                              onClick={() => void issueCredential(student)}
                            >
                              <FileBadge />
                              Issue VC
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
        </TabsContent>

        <TabsContent value="credentials">
          <Card>
            <CardHeader>
              <CardTitle>Issued credentials</CardTitle>
              <CardDescription>
                Each credential stores minimal presentation JSON and a deterministic hash placeholder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Credential</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Issuer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Hash</TableHead>
                    <TableHead className="text-right">On-chain</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credentials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>No credentials issued yet.</TableCell>
                    </TableRow>
                  ) : (
                    credentials.map((credential) => (
                      <TableRow key={credential.id}>
                        <TableCell className="max-w-48 truncate font-mono text-xs">
                          {credential.credentialId}
                        </TableCell>
                        <TableCell>{credential.student?.name ?? "Unknown"}</TableCell>
                        <TableCell>{credential.issuer?.name ?? "Unknown"}</TableCell>
                        <TableCell>
                          <StatusBadge value={credential.status} />
                        </TableCell>
                        <TableCell>
                          {new Date(credential.expiresAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {shortHash(credential.credentialHash)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            {/* TODO: Wire this to registerCredentialHashOnChain() after credential registry contracts exist. */}
                            <Button size="sm" variant="outline" disabled>
                              <ShieldCheck />
                              Register hash later
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
        </TabsContent>
      </Tabs>

      <PlaceholderCard
        title="Credential Registry Integration"
        description="This phase only stores credential hashes locally. Future smart contracts can register hashes, revoke credentials, and expose trusted issuer reads."
        actions={
          <>
            {/* TODO: Wire to registerCredentialHashOnChain(). */}
            <Button disabled variant="outline">
              Register credential hash on-chain later
            </Button>
            {/* TODO: Wire to revokeCredentialOnChain(). */}
            <Button disabled variant="outline">
              Revoke credential on-chain later
            </Button>
          </>
        }
      />
    </div>
  );
}
