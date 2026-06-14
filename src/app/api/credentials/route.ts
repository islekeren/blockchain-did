import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import { authErrorResponse, requireRole, requireUser } from "@/lib/auth/session";
import { hashCredentialPayload } from "@/lib/credential/hash";
import { serializeCredential, serializeCredentials } from "@/lib/credential/serialize";
import { buildStudentCredential } from "@/lib/credential/vc";
import { prisma } from "@/lib/db/prisma";
import { issueCredentialSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

function oneYearFromNow() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const filters: Prisma.CredentialWhereInput[] = [];

    if (studentId) {
      filters.push({ studentId });
    }

    if (user.role === "ISSUER") {
      filters.push({ issuerId: user.issuerId ?? "__none__" });
    }

    if (user.role === "STUDENT") {
      filters.push({ studentId: user.studentId ?? "__none__" });
    }

    const credentials = await prisma.credential.findMany({
      where: filters.length ? { AND: filters } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          include: {
            university: true
          }
        },
        issuer: true
      }
    });

    return NextResponse.json({ credentials: serializeCredentials(credentials) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unable to load credentials" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(request, ["ADMIN", "ISSUER"]);
    const data = issueCredentialSchema.parse(await request.json());
    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
      include: { university: true }
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (!student.active) {
      return NextResponse.json(
        { error: "Credentials can only be issued to active students" },
        { status: 400 }
      );
    }

    const issuerId = data.issuerId ?? student.universityId;
    if (user.role === "ISSUER" && issuerId !== user.issuerId) {
      return NextResponse.json(
        { error: "Issuer wallets can only issue credentials for their own university." },
        { status: 403 }
      );
    }

    if (issuerId !== student.universityId) {
      return NextResponse.json(
        { error: "Issuer must match the student's university" },
        { status: 400 }
      );
    }

    const issuer = student.university;
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : oneYearFromNow();
    const issuedAt = new Date();
    const payload = buildStudentCredential({
      student,
      issuer,
      issuedAt,
      expiresAt
    });
    const credentialHash = hashCredentialPayload(payload);

    const credential = await prisma.credential.create({
      data: {
        credentialId: payload.id,
        studentId: student.id,
        issuerId: issuer.id,
        type: "StudentCredential",
        schemaName: "StudentCredential",
        credentialJson: JSON.stringify(payload, null, 2),
        credentialHash,
        status: "PENDING_ONCHAIN",
        issuedAt,
        expiresAt
      },
      include: {
        student: {
          include: {
            university: true
          }
        },
        issuer: true
      }
    });
    await writeAuditLog({
      actor: user,
      action: "credential.create",
      targetType: "Credential",
      targetId: credential.id,
      metadata: {
        credentialId: credential.credentialId,
        credentialHash,
        status: credential.status
      }
    });

    return NextResponse.json({ credential: serializeCredential(credential) }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to issue credential" }, { status: 400 });
  }
}
