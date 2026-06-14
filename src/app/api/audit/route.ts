import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { serializeAuditLog, writeAuditLog } from "@/lib/audit/log";
import { authErrorResponse, requireRole, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { auditLogSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireRole(request, ["ADMIN"]);
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 80
    });

    return NextResponse.json({ logs: logs.map(serializeAuditLog) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unable to load audit logs" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser(request);
    const data = auditLogSchema.parse(await request.json());
    const log = await writeAuditLog({
      actor,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      txHash: data.txHash,
      metadata: data.metadata
    });

    return NextResponse.json({ log: serializeAuditLog(log) }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to write audit log" }, { status: 400 });
  }
}
