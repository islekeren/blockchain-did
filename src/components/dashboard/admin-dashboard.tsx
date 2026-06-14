"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, FileCheck2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useWallet } from "@/hooks/useWallet";
import {
  getIssuerDidOnChain,
  isSchemaValidOnChain,
  isTrustedIssuerOnChain,
  registerIssuerOnChain,
  registerSchemaOnChain,
  removeIssuerOnChain
} from "@/lib/blockchain/registryClient";
import {
  STUDENT_CREDENTIAL_SCHEMA,
  STUDENT_CREDENTIAL_SCHEMA_HASH
} from "@/lib/credential/schema";
import type { AuditLogRecord, IssuerRecord } from "@/lib/types";

type IssuerResponse = {
  issuers: IssuerRecord[];
};

type AuditResponse = {
  logs: AuditLogRecord[];
};

type TxState = {
  status: "idle" | "pending" | "success" | "error";
  txHash?: string;
  error?: string;
};

type OnChainIssuerStatus = {
  loading: boolean;
  trusted?: boolean;
  did?: string;
  error?: string;
};

type SchemaStatus = {
  loading: boolean;
  valid?: boolean;
  error?: string;
};

const emptyForm = {
  name: "",
  did: "",
  walletAddress: "",
  trusted: false
};

const idleTx: TxState = {
  status: "idle"
};

function shortHash(value?: string | null) {
  if (!value) {
    return "Unavailable";
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

  return <p className="max-w-64 text-xs text-destructive">{state.error}</p>;
}

async function writeClientAudit(input: {
  action: string;
  targetType: string;
  targetId?: string;
  txHash?: string;
  metadata?: unknown;
}) {
  await fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export function AdminDashboard() {
  const wallet = useWallet();
  const [issuers, setIssuers] = useState<IssuerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [onChainIssuers, setOnChainIssuers] = useState<
    Record<string, OnChainIssuerStatus>
  >({});
  const [issuerTx, setIssuerTx] = useState<Record<string, TxState>>({});
  const [schemaStatus, setSchemaStatus] = useState<SchemaStatus>({
    loading: false
  });
  const [schemaTx, setSchemaTx] = useState<TxState>(idleTx);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  async function loadIssuers() {
    setLoading(true);
    const response = await fetch("/api/issuers", { cache: "no-store" });
    const data = (await response.json()) as IssuerResponse;
    setIssuers(data.issuers ?? []);
    setLoading(false);
  }

  async function loadAuditLogs() {
    const response = await fetch("/api/audit", { cache: "no-store" });
    const data = (await response.json()) as AuditResponse;
    setAuditLogs(data.logs ?? []);
  }

  useEffect(() => {
    void loadIssuers();
    void loadAuditLogs();

    const handleAuthChanged = () => {
      void loadIssuers();
      void loadAuditLogs();
    };

    window.addEventListener("wallet-auth-changed", handleAuthChanged);

    return () => {
      window.removeEventListener("wallet-auth-changed", handleAuthChanged);
    };
  }, []);

  const trustedCount = useMemo(
    () => issuers.filter((issuer) => issuer.trusted).length,
    [issuers]
  );

  const onChainTrustedCount = useMemo(
    () =>
      issuers.filter((issuer) => onChainIssuers[issuer.id]?.trusted === true)
        .length,
    [issuers, onChainIssuers]
  );

  const loadOnChainIssuer = useCallback(async (issuer: IssuerRecord) => {
    setOnChainIssuers((current) => ({
      ...current,
      [issuer.id]: { loading: true }
    }));

    try {
      const [trusted, did] = await Promise.all([
        isTrustedIssuerOnChain({ issuerAddress: issuer.walletAddress }),
        getIssuerDidOnChain({ issuerAddress: issuer.walletAddress })
      ]);

      setOnChainIssuers((current) => ({
        ...current,
        [issuer.id]: { loading: false, trusted, did }
      }));
    } catch (error) {
      setOnChainIssuers((current) => ({
        ...current,
        [issuer.id]: {
          loading: false,
          error: error instanceof Error ? error.message : "On-chain read failed"
        }
      }));
    }
  }, []);

  const loadSchemaStatus = useCallback(async () => {
    setSchemaStatus({ loading: true });

    try {
      const valid = await isSchemaValidOnChain({
        schemaHash: STUDENT_CREDENTIAL_SCHEMA_HASH
      });
      setSchemaStatus({ loading: false, valid });
    } catch (error) {
      setSchemaStatus({
        loading: false,
        error: error instanceof Error ? error.message : "Schema read failed"
      });
    }
  }, []);

  const refreshOnChainState = useCallback(async () => {
    if (!wallet.hasMetaMask || !wallet.isLocalHardhat) {
      return;
    }

    await Promise.all([
      ...issuers.map((issuer) => loadOnChainIssuer(issuer)),
      loadSchemaStatus()
    ]);
  }, [
    issuers,
    loadOnChainIssuer,
    loadSchemaStatus,
    wallet.hasMetaMask,
    wallet.isLocalHardhat
  ]);

  useEffect(() => {
    void refreshOnChainState();
  }, [refreshOnChainState]);

  async function createIssuer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const response = await fetch("/api/issuers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Unable to create issuer");
      setSaving(false);
      return;
    }

    setForm(emptyForm);
    setDialogOpen(false);
    await loadIssuers();
    setSaving(false);
  }

  async function toggleTrusted(issuer: IssuerRecord) {
    await fetch(`/api/issuers/${issuer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trusted: !issuer.trusted })
    });
    await loadIssuers();
  }

  async function deleteIssuer(id: string) {
    await fetch(`/api/issuers/${id}`, { method: "DELETE" });
    await loadIssuers();
  }

  function setIssuerTxState(issuerId: string, nextState: TxState) {
    setIssuerTx((current) => ({
      ...current,
      [issuerId]: nextState
    }));
  }

  async function registerIssuer(issuer: IssuerRecord) {
    setIssuerTxState(issuer.id, { status: "pending" });

    try {
      const result = await registerIssuerOnChain({
        issuerAddress: issuer.walletAddress,
        issuerDid: issuer.did
      });
      setIssuerTxState(issuer.id, {
        status: "success",
        txHash: result.txHash
      });
      await writeClientAudit({
        action: "issuer.registerOnChain",
        targetType: "Issuer",
        targetId: issuer.id,
        txHash: result.txHash,
        metadata: {
          walletAddress: issuer.walletAddress
        }
      });
      await loadOnChainIssuer(issuer);
      await wallet.refresh();
    } catch (error) {
      setIssuerTxState(issuer.id, {
        status: "error",
        error: error instanceof Error ? error.message : "Issuer registration failed"
      });
    }
  }

  async function removeIssuer(issuer: IssuerRecord) {
    setIssuerTxState(issuer.id, { status: "pending" });

    try {
      const result = await removeIssuerOnChain({
        issuerAddress: issuer.walletAddress
      });
      setIssuerTxState(issuer.id, {
        status: "success",
        txHash: result.txHash
      });
      await writeClientAudit({
        action: "issuer.removeOnChain",
        targetType: "Issuer",
        targetId: issuer.id,
        txHash: result.txHash,
        metadata: {
          walletAddress: issuer.walletAddress
        }
      });
      await loadOnChainIssuer(issuer);
      await wallet.refresh();
    } catch (error) {
      setIssuerTxState(issuer.id, {
        status: "error",
        error: error instanceof Error ? error.message : "Issuer removal failed"
      });
    }
  }

  async function registerSchema() {
    setSchemaTx({ status: "pending" });

    try {
      const result = await registerSchemaOnChain({
        schemaHash: STUDENT_CREDENTIAL_SCHEMA_HASH,
        schemaName: STUDENT_CREDENTIAL_SCHEMA.name
      });
      setSchemaTx({ status: "success", txHash: result.txHash });
      await writeClientAudit({
        action: "schema.registerOnChain",
        targetType: "CredentialSchema",
        targetId: STUDENT_CREDENTIAL_SCHEMA_HASH,
        txHash: result.txHash,
        metadata: STUDENT_CREDENTIAL_SCHEMA
      });
      await loadSchemaStatus();
      await wallet.refresh();
    } catch (error) {
      setSchemaTx({
        status: "error",
        error: error instanceof Error ? error.message : "Schema registration failed"
      });
    }
  }

  const blockchainActionsDisabled = !wallet.hasMetaMask || !wallet.isLocalHardhat;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Registered issuers</CardDescription>
            <CardTitle className="text-3xl">{issuers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>DB trusted</CardDescription>
            <CardTitle className="text-3xl">{trustedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>On-chain trusted</CardDescription>
            <CardTitle className="text-3xl">{onChainTrustedCount}</CardTitle>
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

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Universities / Issuers</CardTitle>
            <CardDescription>
              DB trust controls the current local app flow. On-chain trust is stored in StudentVerificationRegistry.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadIssuers()}>
              <RefreshCw />
              Refresh DB
            </Button>
            <Button
              variant="outline"
              onClick={() => void refreshOnChainState()}
              disabled={blockchainActionsDisabled}
            >
              <ShieldCheck />
              Refresh On-chain
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus />
                  Add issuer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createIssuer} className="flex flex-col gap-5">
                  <DialogHeader>
                    <DialogTitle>Add university issuer</DialogTitle>
                    <DialogDescription>
                      Create a local issuer record. Register it on-chain from the table with the contract owner wallet.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4">
                    <Field label="University name">
                      <Input
                        value={form.name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            name: event.target.value
                          }))
                        }
                        placeholder="Example University"
                        required
                      />
                    </Field>
                    <Field label="DID">
                      <Input
                        value={form.did}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            did: event.target.value
                          }))
                        }
                        placeholder="did:ethr:0x..."
                        required
                      />
                    </Field>
                    <Field label="Issuer wallet address">
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
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={form.trusted}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            trusted: event.target.checked
                          }))
                        }
                      />
                      Mark as trusted locally
                    </label>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      Create issuer
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issuer</TableHead>
                <TableHead>DID</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>DB Trusted</TableHead>
                <TableHead>On-chain Trusted</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Credentials</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8}>Loading issuers...</TableCell>
                </TableRow>
              ) : issuers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>No issuers registered yet.</TableCell>
                </TableRow>
              ) : (
                issuers.map((issuer) => {
                  const chainStatus = onChainIssuers[issuer.id];
                  const txState = issuerTx[issuer.id];

                  return (
                    <TableRow key={issuer.id}>
                      <TableCell className="font-medium">{issuer.name}</TableCell>
                      <TableCell className="max-w-56 truncate font-mono text-xs" title={issuer.did}>
                        {issuer.did}
                      </TableCell>
                      <TableCell
                        className="max-w-44 truncate font-mono text-xs"
                        title={issuer.walletAddress}
                      >
                        {issuer.walletAddress}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={issuer.trusted ? "Trusted" : "Untrusted"} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {chainStatus?.loading ? (
                            <Badge variant="warning">Checking</Badge>
                          ) : chainStatus?.error ? (
                            <Badge variant="destructive">Unavailable</Badge>
                          ) : typeof chainStatus?.trusted === "boolean" ? (
                            <StatusBadge
                              value={chainStatus.trusted ? "Trusted" : "Untrusted"}
                            />
                          ) : (
                            <Badge variant="neutral">Not checked</Badge>
                          )}
                          {chainStatus?.error ? (
                            <span className="max-w-48 text-xs text-muted-foreground">
                              {chainStatus.error}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{issuer._count?.students ?? 0}</TableCell>
                      <TableCell>{issuer._count?.credentials ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void toggleTrusted(issuer)}
                            >
                              <ShieldCheck />
                              {issuer.trusted ? "Untrust DB" : "Trust DB"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void registerIssuer(issuer)}
                              disabled={
                                blockchainActionsDisabled ||
                                txState?.status === "pending"
                              }
                            >
                              <Building2 />
                              Register On-chain
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void removeIssuer(issuer)}
                              disabled={
                                blockchainActionsDisabled ||
                                txState?.status === "pending"
                              }
                            >
                              <Trash2 />
                              Remove On-chain
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void deleteIssuer(issuer.id)}
                            >
                              <Trash2 />
                              Remove DB
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

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Schema Registry</CardTitle>
            <CardDescription>
              Register the StudentCredential schema hash on-chain with the contract owner wallet.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void loadSchemaStatus()}
              disabled={blockchainActionsDisabled || schemaStatus.loading}
            >
              <RefreshCw />
              Check Schema
            </Button>
            <Button
              onClick={() => void registerSchema()}
              disabled={blockchainActionsDisabled || schemaTx.status === "pending"}
            >
              <FileCheck2 />
              Register Schema
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Name</p>
              <p className="font-medium">{STUDENT_CREDENTIAL_SCHEMA.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Version</p>
              <p className="font-medium">{STUDENT_CREDENTIAL_SCHEMA.version}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Schema Valid On-chain
              </p>
              {schemaStatus.loading ? (
                <Badge variant="warning">Checking</Badge>
              ) : schemaStatus.error ? (
                <Badge variant="destructive">Unavailable</Badge>
              ) : typeof schemaStatus.valid === "boolean" ? (
                <StatusBadge value={schemaStatus.valid ? "Approved" : "Rejected"} />
              ) : (
                <Badge variant="neutral">Not checked</Badge>
              )}
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Deterministic schema hash
            </p>
            <p className="break-all font-mono text-xs">
              {STUDENT_CREDENTIAL_SCHEMA_HASH}
            </p>
          </div>
          {schemaStatus.error ? (
            <Alert variant="destructive">
              <AlertTitle>Schema check failed</AlertTitle>
              <AlertDescription>{schemaStatus.error}</AlertDescription>
            </Alert>
          ) : null}
          <TxFeedback state={schemaTx} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Audit Trail</CardTitle>
            <CardDescription>
              Recent authenticated actions, blockchain transaction callbacks, and verification decisions.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => void loadAuditLogs()}>
            <RefreshCw />
            Refresh Logs
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Tx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>No audit logs visible for this session.</TableCell>
                </TableRow>
              ) : (
                auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{log.actorRole ?? "System"}</span>
                        <span className="max-w-44 truncate font-mono text-xs text-muted-foreground">
                          {log.actorWallet ?? "n/a"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.action}</TableCell>
                    <TableCell className="text-xs">
                      {log.targetType}
                      {log.targetId ? (
                        <span className="ml-1 font-mono text-muted-foreground">
                          {shortHash(log.targetId)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.txHash ? shortHash(log.txHash) : "n/a"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
