import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import { authErrorResponse, requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { updateIssuerSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireRole(request, ["ADMIN"]);
    const { id } = await context.params;
    const data = updateIssuerSchema.parse(await request.json());
    const issuer = await prisma.issuer.update({
      where: { id },
      data
    });
    await writeAuditLog({
      actor: user,
      action: "issuer.updateTrust",
      targetType: "Issuer",
      targetId: issuer.id,
      metadata: data
    });

    return NextResponse.json({ issuer });
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Issuer not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireRole(_request, ["ADMIN"]);
    const { id } = await context.params;
    await prisma.$transaction([
      prisma.credential.deleteMany({ where: { issuerId: id } }),
      prisma.student.deleteMany({ where: { universityId: id } }),
      prisma.issuer.delete({ where: { id } })
    ]);
    await writeAuditLog({
      actor: user,
      action: "issuer.delete",
      targetType: "Issuer",
      targetId: id
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json({ error: "Issuer not found" }, { status: 404 });
  }
}
