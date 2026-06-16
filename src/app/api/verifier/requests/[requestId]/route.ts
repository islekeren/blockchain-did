import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { serializeVerificationRequest } from "@/lib/verification/requests";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { requestId } = await context.params;
  const verificationRequest = await prisma.verificationRequest.findUnique({
    where: { id: requestId }
  });

  if (!verificationRequest) {
    return NextResponse.json(
      { error: "Verification request not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    request: serializeVerificationRequest(verificationRequest)
  });
}
