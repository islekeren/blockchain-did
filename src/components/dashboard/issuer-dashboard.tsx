"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  FileBadge,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  UserCheck,
  UserX
} from "lucide-react";

import { Field } from "@/components/dashboard/field";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { WalletConnect } from "@/components/wallet-connect";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { useWallet } from "@/hooks/useWallet";
import {
  getCredentialIssuerOnChain,
  isCredentialRegisteredOnChain,
  isCredentialRevokedOnChain,
  registerCredentialHashOnChain,
  revokeCredentialOnChain
} from "@/lib/blockchain/registryClient";
import { requestSigner } from "@/lib/blockchain/provider";
import {
  buildIssuerCredentialProof,
  createCredentialProofMessage
} from "@/lib/credential/proof";
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

type TxState = {
  status: "idle" | "pending" | "success" | "error";
  txHash?: string;
  error?: string;
};

type OnChainCredentialStatus = {
  loading: boolean;
  registered?: boolean;
  revoked?: boolean;
  issuer?: string;
  error?: string;
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

function TxFeedback({ state }: { state?: TxState }) {
  if (!state || state.status === "idle") {
    return null;
  }

  if (state.status === "pending") {
    return <p className="text-xs text-muted-foreground">Transaction pending...</p>;
  }

  if (state.status === "success") {
    return (
      <p className="text-xs text-muted-foreground">
        Tx <span className="font-mono">{shortHash(state.txHash)}</span>
      </p>
    );
  }

  return <p className="max-w-72 text-xs text-destructive">{state.error}</p>;
}

export function IssuerDashboard() {
  const wallet = useWallet();
  const [issuers, setIssuers] = useState<IssuerRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyStudentForm);
  const [message, setMessage] = useState<string | null>(null);
  const [lastIssued, setLastIssued] = useState<string | null>(null);
  const [onChainCredentials, setOnChainCredentials] = useState<
    Record<string, OnChainCredentialStatus>
  >({});
  const [credentialTx, setCredentialTx] = useState<Record<string, TxState>>({});

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

    const handleAuthChanged = () => {
      void loadData();
    };

    window.addEventListener("wallet-auth-changed", handleAuthChanged);

    return () => {
      window.removeEventListener("wallet-auth-changed", handleAuthChanged);
    };
  }, []);

  const activeStudents = useMemo(
    () => students.filter((student) => student.active).length,
    [students]
  );

  const onChainRegisteredCount = useMemo(
    () =>
      credentials.filter(
        (credential) => onChainCredentials[credential.id]?.registered === true
      ).length,
    [credentials, onChainCredentials]
  );

  const loadOnChainCredential = useCallback(async (credential: CredentialRecord) => {
    if (!credential.credentialHash) {
      setOnChainCredentials((current) => ({
        ...current,
        [credential.id]: {
          loading: false,
          error: "Credential hash is missing"
        }
      }));
      return;
    }

    setOnChainCredentials((current) => ({
      ...current,
      [credential.id]: { loading: true }
    }));

    try {
      const [registered, revoked, issuer] = await Promise.all([
        isCredentialRegisteredOnChain({
          credentialHash: credential.credentialHash
        }),
        isCredentialRevokedOnChain({
          credentialHash: credential.credentialHash
        }),
        getCredentialIssuerOnChain({
          credentialHash: credential.credentialHash
        })
      ]);

      setOnChainCredentials((current) => ({
        ...current,
        [credential.id]: {
          loading: false,
          registered,
          revoked,
          issuer
        }
      }));
    } catch (error) {
      setOnChainCredentials((current) => ({
        ...current,
        [credential.id]: {
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Credential on-chain read failed"
        }
      }));
    }
  }, []);

  const refreshOnChainCredentials = useCallback(async () => {
    if (!wallet.hasMetaMask || !wallet.isLocalHardhat) {
      return;
    }

    await Promise.all(
      credentials.map((credential) => loadOnChainCredential(credential))
    );
  }, [
    credentials,
    loadOnChainCredential,
    wallet.hasMetaMask,
    wallet.isLocalHardhat
  ]);

  useEffect(() => {
    void refreshOnChainCredentials();
  }, [refreshOnChainCredentials]);

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

  function setCredentialTxState(credentialId: string, nextState: TxState) {
    setCredentialTx((current) => ({
      ...current,
      [credentialId]: nextState
    }));
  }

  async function registerCredentialHash(credential: CredentialRecord) {
    if (!credential.credentialHash) {
      setCredentialTxState(credential.id, {
        status: "error",
        error: "Credential hash is missing"
      });
      return;
    }

    setCredentialTxState(credential.id, { status: "pending" });

    try {
      let credentialForRegistration = credential;

      if (!credential.credentialJson.proof) {
        const signer = await requestSigner();
        const signerAddress = await signer.getAddress();
        const issuerAddress = credential.issuer?.walletAddress;

        if (!issuerAddress || signerAddress !== issuerAddress) {
          throw new Error(
            "Connected wallet must match the credential issuer before signing the VC proof."
          );
        }

        const signature = await signer.signMessage(
          createCredentialProofMessage({
            credential: credential.credentialJson,
            credentialHash: credential.credentialHash
          })
        );
        const issuerProof = buildIssuerCredentialProof({
          credential: credential.credentialJson,
          credentialHash: credential.credentialHash,
          signature
        });
        const proofResponse = await fetch(`/api/credentials/${credential.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issuerProof })
        });
        const proofData = (await proofResponse.json()) as {
          credential?: CredentialRecord;
          error?: string;
        };

        if (!proofResponse.ok || !proofData.credential) {
          throw new Error(proofData.error ?? "Issuer proof could not be saved.");
        }

        credentialForRegistration = proofData.credential;
      }

      const result = await registerCredentialHashOnChain({
        credentialHash: credential.credentialHash
      });
      const statusResponse = await fetch(`/api/credentials/${credential.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ISSUED",
          registeredTxHash: result.txHash
        })
      });
      const statusData = (await statusResponse.json()) as {
        error?: string;
      };

      if (!statusResponse.ok) {
        throw new Error(
          statusData.error ??
            "Credential was registered on-chain, but DB status update failed."
        );
      }

      setCredentialTxState(credential.id, {
        status: "success",
        txHash: result.txHash
      });
      await loadOnChainCredential(credentialForRegistration);
      await loadData();
      await wallet.refresh();
    } catch (error) {
      setCredentialTxState(credential.id, {
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Credential hash registration failed"
      });
    }
  }

  async function revokeCredential(credential: CredentialRecord) {
    if (!credential.credentialHash) {
      setCredentialTxState(credential.id, {
        status: "error",
        error: "Credential hash is missing"
      });
      return;
    }

    setCredentialTxState(credential.id, { status: "pending" });

    try {
      const result = await revokeCredentialOnChain({
        credentialHash: credential.credentialHash
      });

      const response = await fetch(`/api/credentials/${credential.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REVOKED",
          revocationTxHash: result.txHash,
          revocationReason: "Revoked by issuer from dashboard"
        })
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Credential was revoked on-chain, but DB status update failed.");
      }

      setCredentialTxState(credential.id, {
        status: "success",
        txHash: result.txHash
      });
      await loadData();
      await loadOnChainCredential(credential);
      await wallet.refresh();
    } catch (error) {
      setCredentialTxState(credential.id, {
        status: "error",
        error:
          error instanceof Error ? error.message : "Credential revocation failed"
      });
    }
  }

  const blockchainActionsDisabled = !wallet.hasMetaMask || !wallet.isLocalHardhat;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
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
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Registered on-chain</CardDescription>
            <CardTitle className="text-3xl">{onChainRegisteredCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <WalletConnect wallet={wallet} />

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
            Stored locally as {lastIssued}. Register its hash on-chain from the Credentials tab.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="students">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <TabsList>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadData()}>
              <RefreshCw />
              Refresh DB
            </Button>
            <Button
              variant="outline"
              onClick={() => void refreshOnChainCredentials()}
              disabled={blockchainActionsDisabled}
            >
              <ShieldCheck />
              Refresh On-chain
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus />
                  Add student
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createStudent} className="flex flex-col gap-5">
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
                Register credential hashes on-chain with a trusted issuer wallet, then revoke only from the original issuer wallet.
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
                    <TableHead>Credential Hash</TableHead>
                    <TableHead>Registered On-chain</TableHead>
                    <TableHead>Revoked On-chain</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credentials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>No credentials issued yet.</TableCell>
                    </TableRow>
                  ) : (
                    credentials.map((credential) => {
                      const chainStatus = onChainCredentials[credential.id];
                      const txState = credentialTx[credential.id];

                      return (
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
                          <TableCell
                            className="max-w-52 truncate font-mono text-xs"
                            title={credential.credentialHash ?? "Missing hash"}
                          >
                            {shortHash(credential.credentialHash)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {chainStatus?.loading ? (
                                <Badge variant="warning">Checking</Badge>
                              ) : chainStatus?.error ? (
                                <Badge variant="destructive">Unavailable</Badge>
                              ) : typeof chainStatus?.registered === "boolean" ? (
                                <StatusBadge
                                  value={
                                    chainStatus.registered
                                      ? "Registered"
                                      : "Rejected"
                                  }
                                />
                              ) : (
                                <Badge variant="neutral">Not checked</Badge>
                              )}
                              {chainStatus?.issuer ? (
                                <span
                                  className="max-w-44 truncate font-mono text-xs text-muted-foreground"
                                  title={chainStatus.issuer}
                                >
                                  {shortHash(chainStatus.issuer)}
                                </span>
                              ) : null}
                              {chainStatus?.error ? (
                                <span className="max-w-48 text-xs text-muted-foreground">
                                  {chainStatus.error}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            {chainStatus?.loading ? (
                              <Badge variant="warning">Checking</Badge>
                            ) : chainStatus?.error ? (
                              <Badge variant="destructive">Unavailable</Badge>
                            ) : typeof chainStatus?.revoked === "boolean" ? (
                              <StatusBadge
                                value={chainStatus.revoked ? "Revoked" : "Active"}
                              />
                            ) : (
                              <Badge variant="neutral">Not checked</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void registerCredentialHash(credential)}
                                  disabled={
                                    blockchainActionsDisabled ||
                                    txState?.status === "pending" ||
                                    !credential.credentialHash
                                  }
                                >
                                  <ShieldCheck />
                                  Register Hash On-chain
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void revokeCredential(credential)}
                                  disabled={
                                    blockchainActionsDisabled ||
                                    txState?.status === "pending" ||
                                    !credential.credentialHash
                                  }
                                >
                                  <ShieldX />
                                  Revoke On-chain
                                </Button>
                              </div>
                              <TxFeedback state={txState} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
