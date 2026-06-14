import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import { authErrorResponse, requireRole, requireUser } from "@/lib/auth/session";
import { normalizeWalletAddress } from "@/lib/blockchain/address";
import { prisma } from "@/lib/db/prisma";
import { createStudentSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const students = await prisma.student.findMany({
      where:
        user.role === "ADMIN"
          ? undefined
          : user.role === "ISSUER" && user.issuerId
            ? { universityId: user.issuerId }
            : user.role === "STUDENT" && user.studentId
              ? { id: user.studentId }
              : { id: "__none__" },
      orderBy: { createdAt: "asc" },
      include: {
        university: true,
        _count: {
          select: {
            credentials: true
          }
        }
      }
    });

    return NextResponse.json({ students });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unable to load students" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(request, ["ADMIN", "ISSUER"]);
    const data = createStudentSchema.parse(await request.json());

    if (user.role === "ISSUER" && data.universityId !== user.issuerId) {
      return NextResponse.json(
        { error: "Issuer wallets can only create students for their own university." },
        { status: 403 }
      );
    }

    const student = await prisma.student.create({
      data: {
        ...data,
        walletAddress: normalizeWalletAddress(data.walletAddress),
        active: data.active ?? true
      },
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
      action: "student.create",
      targetType: "Student",
      targetId: student.id,
      metadata: {
        universityId: student.universityId,
        walletAddress: student.walletAddress
      }
    });

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Unable to create student. Check university and wallet details." },
      { status: 400 }
    );
  }
}
