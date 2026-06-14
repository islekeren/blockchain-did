import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import { authErrorResponse, requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { updateStudentSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireRole(request, ["ADMIN", "ISSUER"]);
    const { id } = await context.params;
    const data = updateStudentSchema.parse(await request.json());
    const existing = await prisma.student.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (user.role === "ISSUER" && existing.universityId !== user.issuerId) {
      return NextResponse.json(
        { error: "Issuer wallets can only update their own students." },
        { status: 403 }
      );
    }

    const student = await prisma.student.update({
      where: { id },
      data,
      include: {
        university: true,
        _count: {
          select: {
            credentials: true
          }
        }
      }
    });
    await writeAuditLog({
      actor: user,
      action: "student.updateStatus",
      targetType: "Student",
      targetId: student.id,
      metadata: data
    });

    return NextResponse.json({ student });
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
}
