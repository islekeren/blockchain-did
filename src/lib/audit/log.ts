import type { CurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

type AuditLogInput = {
  actor?: CurrentUser | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  txHash?: string | null;
  metadata?: unknown;
};

export async function writeAuditLog({
  actor,
  action,
  targetType,
  targetId,
  txHash,
  metadata
}: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorUserId: actor?.id ?? null,
      actorWallet: actor?.walletAddress ?? null,
      actorRole: actor?.role ?? null,
      action,
      targetType,
      targetId: targetId ?? null,
      txHash: txHash ?? null,
      metadata: JSON.stringify(metadata ?? {})
    }
  });
}

export function serializeAuditLog(record: {
  id: string;
  actorUserId: string | null;
  actorWallet: string | null;
  actorRole: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  txHash: string | null;
  metadata: string;
  createdAt: Date;
}) {
  let metadata: unknown = {};

  try {
    metadata = JSON.parse(record.metadata);
  } catch {
    metadata = record.metadata;
  }

  return {
    ...record,
    metadata,
    createdAt: record.createdAt.toISOString()
  };
}
