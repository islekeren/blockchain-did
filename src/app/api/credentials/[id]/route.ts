import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import { authErrorResponse, requireRole } from "@/lib/auth/session";
import { verifyIssuerCredentialProof } from "@/lib/credential/proof";
import { serializeCredential } from "@/lib/credential/serialize";
import { isStudentCredentialPayload } from "@/lib/credential/vc";
import { prisma } from "@/lib/db/prisma";
import { updateCredentialSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireRole(request, ["ADMIN", "ISSUER"]);
    const { id } = await context.params;
    const data = updateCredentialSchema.parse(await request.json());
    const existing = await prisma.credential.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            university: true
          }
        },
        issuer: true
      }
    });

    if (!existing) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    if (user.role === "ISSUER" && existing.issuerId !== user.issuerId) {
      return NextResponse.json(
        { error: "Issuer wallets can only update their own credentials." },
        { status: 403 }
      );
    }

    const updateData: {
      status?: string;
      credentialJson?: string;
      registeredAt?: Date;
      registeredTxHash?: string;
      revokedAt?: Date;
      revocationTxHash?: string;
      revocationReason?: string;
    } = {};
    const parsedCredential = JSON.parse(existing.credentialJson) as unknown;

    if (!isStudentCredentialPayload(parsedCredential)) {
      return NextResponse.json(
        { error: "Stored credential JSON is invalid." },
        { status: 400 }
      );
    }

    let nextCredentialPayload = parsedCredential;

    if (data.issuerProof) {
      nextCredentialPayload = {
        ...parsedCredential,
        proof: data.issuerProof
      };
      const proofResult = verifyIssuerCredentialProof({
        credential: nextCredentialPayload,
        credentialHash: existing.credentialHash ?? ""
      });

      if (!proofResult.valid) {
        return NextResponse.json(
          { error: proofResult.reason },
          { status: 400 }
        );
      }

      updateData.credentialJson = JSON.stringify(nextCredentialPayload, null, 2);
    }

    if (data.status === "ISSUED") {
      if (!data.registeredTxHash) {
        return NextResponse.json(
          { error: "registeredTxHash is required when marking a credential ISSUED." },
          { status: 400 }
        );
      }

      updateData.status = "ISSUED";
      updateData.registeredAt = new Date();
      updateData.registeredTxHash = data.registeredTxHash;
    }

    if (data.status === "REVOKED") {
      updateData.status = "REVOKED";
      updateData.revokedAt = data.revokedAt ? new Date(data.revokedAt) : new Date();
      updateData.revocationTxHash = data.revocationTxHash;
      updateData.revocationReason = data.revocationReason ?? "Revoked by issuer";
    }

    if (data.status === "FAILED" || data.status === "EXPIRED") {
      updateData.status = data.status;
    }

    const credential = await prisma.credential.update({
      where: { id },
      data: updateData,
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
      action:
        data.status === "REVOKED"
          ? "credential.revoke"
          : data.status === "ISSUED"
            ? "credential.registerOnChain"
            : data.issuerProof
              ? "credential.signIssuerProof"
              : "credential.update",
      targetType: "Credential",
      targetId: credential.id,
      txHash: data.registeredTxHash ?? data.revocationTxHash,
      metadata: {
        credentialId: credential.credentialId,
        status: credential.status,
        hasIssuerProof: Boolean(nextCredentialPayload.proof)
      }
    });

    return NextResponse.json({ credential: serializeCredential(credential) });
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }
}
