import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import { authErrorResponse, requireRole } from "@/lib/auth/session";
import {
  getAuditAction,
  getVerifierName,
  runCredentialVerification
} from "@/lib/verification/service";
import { verifyCredentialSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireRole(request, ["VERIFIER"]);
    const data = verifyCredentialSchema.parse(await request.json());
    const verifierName = getVerifierName(user, data.verifierName);
    const verificationResult = await runCredentialVerification({
      credentialId: data.credentialId,
      credentialJson: data.credentialJson,
      presentationProofJson: data.presentationProofJson,
      verifierName
    });

    await writeAuditLog({
      actor: user,
      action: getAuditAction(verificationResult.result),
      targetType: "VerificationRequest",
      targetId: verificationResult.verification?.id ?? null,
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
          error instanceof Error ? error.message : "Unable to verify credential"
      },
      { status: 400 }
    );
  }
}
