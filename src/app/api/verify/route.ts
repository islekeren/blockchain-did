import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/db/prisma";
import { verifyCredentialSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

type VerificationCheck = {
  label: string;
  passed: boolean;
  detail: string;
};

function parseCredentialInput(value?: string) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as {
      id?: string;
      issuer?: {
        id?: string;
        walletAddress?: string;
      };
      credentialSubject?: {
        activeStudent?: boolean;
      };
      expirationDate?: string;
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const data = verifyCredentialSchema.parse(await request.json());
    const pastedCredential = parseCredentialInput(data.credentialJson);
    const lookupId = pastedCredential?.id ?? data.credentialId;

    const credential = lookupId
      ? await prisma.credential.findFirst({
          where: {
            OR: [{ id: lookupId }, { credentialId: lookupId }]
          },
          include: {
            student: true,
            issuer: true
          }
        })
      : null;

    const issuerFromPayload = pastedCredential?.issuer
      ? await prisma.issuer.findFirst({
          where: {
            OR: [
              { did: pastedCredential.issuer.id ?? "" },
              { walletAddress: pastedCredential.issuer.walletAddress ?? "" }
            ]
          }
        })
      : null;

    const issuer = credential?.issuer ?? issuerFromPayload;
    const credentialPayload = credential
      ? parseCredentialInput(credential.credentialJson)
      : pastedCredential;
    const payloadExpiry = credentialPayload?.expirationDate
      ? new Date(credentialPayload.expirationDate)
      : null;
    const now = new Date();

    const checks: VerificationCheck[] = [
      {
        label: "Credential exists",
        passed: Boolean(credential),
        detail: credential
          ? `Matched database credential ${credential.credentialId}`
          : "No matching credential record was found"
      },
      {
        label: "Credential status is ISSUED",
        passed: credential?.status === "ISSUED",
        detail: credential
          ? `Current status is ${credential.status}`
          : "Status cannot be checked without a database credential"
      },
      {
        label: "Student is active",
        passed:
          Boolean(credential?.student.active) &&
          credentialPayload?.credentialSubject?.activeStudent === true,
        detail: credential
          ? `Database active=${credential.student.active}, credential activeStudent=${String(
              credentialPayload?.credentialSubject?.activeStudent
            )}`
          : "Student activity cannot be checked without a database credential"
      },
      {
        label: "Credential is not expired",
        passed:
          Boolean(credential?.expiresAt && credential.expiresAt > now) &&
          Boolean(payloadExpiry && payloadExpiry > now),
        detail: credential
          ? `Expires at ${credential.expiresAt.toISOString()}`
          : "Expiration cannot be checked without a database credential"
      },
      {
        label: "Issuer exists and is trusted",
        passed: Boolean(issuer?.trusted),
        detail: issuer
          ? `${issuer.name} is ${issuer.trusted ? "trusted" : "untrusted"}`
          : "Issuer was not found in the local registry"
      }
    ];

    const approved = checks.every((check) => check.passed);
    const verification = await prisma.verificationRequest.create({
      data: {
        credentialId: credential?.credentialId ?? lookupId ?? null,
        verifierName: data.verifierName,
        result: approved ? "APPROVED" : "REJECTED",
        reasons: JSON.stringify(checks)
      }
    });

    return NextResponse.json({
      result: approved ? "APPROVED" : "REJECTED",
      checks,
      verification
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to verify credential" }, { status: 400 });
  }
}
