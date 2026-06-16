import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import { authErrorResponse, requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  getAuditAction,
  runCredentialVerification
} from "@/lib/verification/service";
import { getRequestStatus } from "@/lib/verification/requests";
import { submitVerifierPresentationSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireRole(request, ["STUDENT"]);
    const { requestId } = await context.params;
    const data = submitVerifierPresentationSchema.parse(await request.json());
    const verificationRequest = await prisma.verificationRequest.findUnique({
      where: { id: requestId }
    });

    if (!verificationRequest) {
      return NextResponse.json(
        { error: "Verification request not found" },
        { status: 404 }
      );
    }

    const status = getRequestStatus(verificationRequest);

    if (status !== "PENDING") {
      return NextResponse.json(
        {
          error:
            status === "EXPIRED"
              ? "Verification request has expired."
              : "Verification request is no longer accepting presentations.",
          status
        },
        { status: 400 }
      );
    }

    if (verificationRequest.used) {
      return NextResponse.json(
        { error: "Verification request has already been used.", status },
        { status: 400 }
      );
    }

    if (!user.studentId) {
      return NextResponse.json(
        { error: "Student session is not linked to a student record." },
        { status: 403 }
      );
    }

    const submittedCredential = await prisma.credential.findFirst({
      where: {
        OR: [{ id: data.credentialId }, { credentialId: data.credentialId }]
      },
      select: {
        studentId: true
      }
    });

    if (submittedCredential && submittedCredential.studentId !== user.studentId) {
      return NextResponse.json(
        { error: "Student wallets can only submit their own credentials." },
        { status: 403 }
      );
    }

    const presentationProofJson = JSON.stringify(data.presentationProof);
    const verificationResult = await runCredentialVerification({
      credentialId: data.credentialId,
      presentationProofJson,
      verifierName: verificationRequest.verifierName,
      requestId
    });

    await writeAuditLog({
      actor: user,
      action: getAuditAction(verificationResult.result),
      targetType: "VerificationRequest",
      targetId: verificationResult.verification?.id ?? requestId,
      metadata: {
        credentialId: verificationResult.credentialId,
        credentialHash: verificationResult.credentialHash,
        offChainPassed: verificationResult.offChainPassed,
        onChainPassed: verificationResult.onChainPassed,
        presentationPassed: verificationResult.presentationPassed
      }
    });

    return NextResponse.json(verificationResult);
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to submit presentation"
      },
      { status: 400 }
    );
  }
}
