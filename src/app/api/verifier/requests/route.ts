import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import { authErrorResponse, getCurrentUser, requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  buildChallengeDetails,
  getWalletRedirectUrl,
  serializeVerificationRequests
} from "@/lib/verification/requests";
import { createVerifierRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

function tenMinutesFromNow() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

export async function GET(request: Request) {
  try {
    await requireRole(request, ["VERIFIER"]);

    const requests = await prisma.verificationRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 25
    });

    return NextResponse.json({
      requests: serializeVerificationRequests(requests)
    });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unable to load verification requests" }, { status: 400 })
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const data = createVerifierRequestSchema.parse(await request.json());
    const verifierName = user?.verifierName ?? data.verifierName;
    const requestId = crypto.randomUUID();
    const expiresAt = tenMinutesFromNow();

    const created = await prisma.verificationRequest.create({
      data: {
        id: requestId,
        verifierName,
        callbackUrl: data.callbackUrl || null,
        requestedCredentialType: data.requestedCredentialType,
        nonce: crypto.randomUUID(),
        result: "PENDING",
        reasons: "[]",
        checkResults: null,
        used: false,
        expiresAt
      }
    });
    const challenge = buildChallengeDetails(created);
    const updated = await prisma.verificationRequest.update({
      where: { id: created.id },
      data: {
        challengeMessage: JSON.stringify(challenge, null, 2)
      }
    });

    if (user) {
      await writeAuditLog({
        actor: user,
        action: "verification.requestCreate",
        targetType: "VerificationRequest",
        targetId: updated.id,
        metadata: {
          verifierName,
          requestedCredentialType: data.requestedCredentialType,
          callbackUrl: data.callbackUrl ?? null
        }
      });
    }

    return NextResponse.json(
      {
        requestId: updated.id,
        nonce: updated.nonce,
        verifierName: updated.verifierName,
        requestedCredentialType: updated.requestedCredentialType,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
        walletRedirectUrl: getWalletRedirectUrl(updated.id)
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create verification request"
      },
      { status: 400 }
    );
  }
}
