import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/db/prisma";
import { createVerificationChallengeSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

function tenMinutesFromNow() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

function createNonce() {
  return crypto.randomUUID();
}

export async function POST(request: Request) {
  try {
    const data = createVerificationChallengeSchema.parse(await request.json());
    const requestId = crypto.randomUUID();
    const nonce = createNonce();
    const expiresAt = tenMinutesFromNow();

    const verificationRequest = await prisma.verificationRequest.create({
      data: {
        id: requestId,
        verifierName: data.verifierName,
        nonce,
        result: "PENDING",
        reasons: "[]",
        used: false,
        expiresAt
      }
    });

    const challenge = {
      requestId: verificationRequest.id,
      nonce: verificationRequest.nonce,
      verifierName: verificationRequest.verifierName,
      createdAt: verificationRequest.createdAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    const updatedRequest = await prisma.verificationRequest.update({
      where: { id: verificationRequest.id },
      data: {
        challengeMessage: JSON.stringify(challenge, null, 2)
      }
    });

    return NextResponse.json({
      challenge: {
        ...challenge,
        createdAt: updatedRequest.createdAt.toISOString()
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Unable to create verification challenge" },
      { status: 400 }
    );
  }
}
