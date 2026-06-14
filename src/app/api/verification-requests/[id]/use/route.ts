import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { hashCredentialPayload } from "@/lib/credential/hash";
import { isStudentCredentialPayload } from "@/lib/credential/vc";
import { prisma } from "@/lib/db/prisma";
import { parsePresentationProof } from "@/lib/presentation/message";
import { buildPresentationProofChecks } from "@/lib/presentation/verify";
import { useVerificationRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const data = useVerificationRequestSchema.parse(await request.json());
    const proof = parsePresentationProof(data.presentationProofJson);

    if (!proof || proof.requestId !== id) {
      return NextResponse.json(
        { error: "Presentation proof does not match the verification request." },
        { status: 400 }
      );
    }

    if (
      proof.credentialId !== data.credentialId ||
      proof.credentialHash.toLowerCase() !== data.credentialHash.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Presentation proof does not match the verified credential." },
        { status: 400 }
      );
    }

    const verificationRequest = await prisma.verificationRequest.findUnique({
      where: { id }
    });
    const credential = await prisma.credential.findFirst({
      where: {
        OR: [{ id: data.credentialId }, { credentialId: data.credentialId }]
      }
    });
    const credentialPayload = credential
      ? (JSON.parse(credential.credentialJson) as unknown)
      : null;
    const parsedCredentialPayload = isStudentCredentialPayload(credentialPayload)
      ? credentialPayload
      : null;
    const computedCredentialHash = parsedCredentialPayload
      ? hashCredentialPayload(parsedCredentialPayload)
      : data.credentialHash;

    const validation = buildPresentationProofChecks({
      proofJson: data.presentationProofJson,
      credentialPayload: parsedCredentialPayload,
      credentialHash: computedCredentialHash,
      request: verificationRequest
    });

    if (
      !credential ||
      computedCredentialHash.toLowerCase() !== data.credentialHash.toLowerCase() ||
      !validation.checks.every((check) => check.passed)
    ) {
      return NextResponse.json(
        {
          error: "Verification request cannot be marked used.",
          checks: validation.checks
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.verificationRequest.updateMany({
        where: {
          id,
          used: false
        },
        data: {
          used: true,
          credentialId: data.credentialId,
          result: "APPROVED",
          reasons: JSON.stringify({
            presentationChecks: validation.checks
          })
        }
      });

      if (updated.count !== 1) {
        throw new Error("Verification request has already been used.");
      }

      const presentationProof = await tx.presentationProof.create({
        data: {
          credentialId: proof.credentialId,
          credentialHash: proof.credentialHash,
          studentWalletAddress: proof.studentWalletAddress,
          requestId: id,
          nonce: proof.nonce,
          verifierName: proof.verifierName,
          message: proof.message,
          signature: proof.signature
        }
      });

      return { presentationProof };
    });

    return NextResponse.json({
      ok: true,
      presentationProof: result.presentationProof
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to mark verification request used"
      },
      { status: 400 }
    );
  }
}
