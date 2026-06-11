import { NextResponse } from "next/server";

import { serializeCredentials } from "@/lib/credential/serialize";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
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
}
