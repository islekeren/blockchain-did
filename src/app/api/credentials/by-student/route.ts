import { NextResponse } from "next/server";

import { authErrorResponse, requireUser } from "@/lib/auth/session";
import { serializeCredentials } from "@/lib/credential/serialize";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    if (user.role === "STUDENT" && studentId !== user.studentId) {
      return NextResponse.json(
        { error: "Student wallets can only read their own credentials." },
        { status: 403 }
      );
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });

    if (user.role === "ISSUER" && student?.universityId !== user.issuerId) {
      return NextResponse.json(
        { error: "Issuer wallets can only read credentials for their own students." },
        { status: 403 }
      );
    }

    const credentials = await prisma.credential.findMany({
      where: { studentId },
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
