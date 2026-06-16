import { getAddress } from "ethers";

import type { CurrentUser } from "@/lib/auth/session";
import {
  getCredentialIssuerOnChainServer,
  getSchemaNameOnChainServer,
  isCredentialRegisteredOnChainServer,
  isCredentialRevokedOnChainServer,
  isSchemaValidOnChainServer,
  isTrustedIssuerOnChainServer
} from "@/lib/blockchain/serverRegistry";
import { hashCredentialPayload } from "@/lib/credential/hash";
import { verifyIssuerCredentialProof } from "@/lib/credential/proof";
import { hashCredentialSchema } from "@/lib/credential/schema";
import {
  isStudentCredentialPayload,
  type StudentCredentialPayload
} from "@/lib/credential/vc";
import { prisma } from "@/lib/db/prisma";
import { parsePresentationProof } from "@/lib/presentation/message";
import { buildPresentationProofChecks } from "@/lib/presentation/verify";
import type { VerificationCheck } from "@/lib/types";

type RunVerificationInput = {
  credentialId?: string;
  credentialJson?: string;
  presentationProofJson?: string;
  verifierName: string;
  requestId?: string;
};

const onChainCheckLabels = [
  "Issuer trusted on-chain",
  "Schema valid on-chain",
  "Credential hash registered on-chain",
  "Credential not revoked on-chain",
  "Credential issuer matches on-chain"
];

function parseCredentialInput(value?: string): StudentCredentialPayload | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return isStudentCredentialPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function safeHashCredential(payload: StudentCredentialPayload | null) {
  if (!payload) {
    return null;
  }

  try {
    return hashCredentialPayload(payload);
  } catch {
    return null;
  }
}

function skippedOnChainChecks(reason: string): VerificationCheck[] {
  return onChainCheckLabels.map((label) => ({
    label,
    passed: false,
    detail: reason
  }));
}

async function runOnChainChecks(
  offChainChecks: VerificationCheck[],
  payload: StudentCredentialPayload | null,
  credentialHash: string | null
) {
  const integrityCheck = offChainChecks.find(
    (check) => check.label === "Presented credential hash matches stored hash"
  );

  if (!integrityCheck?.passed) {
    return skippedOnChainChecks(
      "Skipped because the presented credential failed the local integrity check."
    );
  }

  if (!payload || !credentialHash) {
    return skippedOnChainChecks(
      "Skipped because the credential payload or hash is unavailable."
    );
  }

  try {
    const issuerAddress = getAddress(payload.issuer.walletAddress);
    const schemaHash = hashCredentialSchema({
      name: payload.schema.name,
      version: payload.schema.version
    });
    const [
      issuerTrusted,
      schemaValid,
      schemaName,
      credentialRegistered,
      credentialRevoked,
      credentialIssuer
    ] = await Promise.all([
      isTrustedIssuerOnChainServer(issuerAddress),
      isSchemaValidOnChainServer(schemaHash),
      getSchemaNameOnChainServer(schemaHash),
      isCredentialRegisteredOnChainServer(credentialHash),
      isCredentialRevokedOnChainServer(credentialHash),
      getCredentialIssuerOnChainServer(credentialHash)
    ]);
    const normalizedCredentialIssuer = getAddress(credentialIssuer);
    const issuerMatches =
      credentialRegistered && normalizedCredentialIssuer === issuerAddress;

    return [
      {
        label: "Issuer trusted on-chain",
        passed: issuerTrusted,
        detail: `${payload.issuer.name} (${issuerAddress}) is ${
          issuerTrusted ? "trusted" : "not trusted"
        } on-chain`
      },
      {
        label: "Schema valid on-chain",
        passed: schemaValid,
        detail: schemaValid
          ? `${schemaName || payload.schema.name} is registered for hash ${schemaHash}`
          : `Schema hash ${schemaHash} is not registered`
      },
      {
        label: "Credential hash registered on-chain",
        passed: credentialRegistered,
        detail: credentialRegistered
          ? `Credential hash ${credentialHash} is registered`
          : `Credential hash ${credentialHash} is not registered`
      },
      {
        label: "Credential not revoked on-chain",
        passed: !credentialRevoked,
        detail: credentialRevoked
          ? "Credential hash is revoked on-chain"
          : "Credential hash is not revoked on-chain"
      },
      {
        label: "Credential issuer matches on-chain",
        passed: issuerMatches,
        detail: `On-chain issuer ${normalizedCredentialIssuer}; credential issuer ${issuerAddress}`
      }
    ];
  } catch (error) {
    return skippedOnChainChecks(
      error instanceof Error ? error.message : "On-chain verification failed."
    );
  }
}

export async function runCredentialVerification(input: RunVerificationInput) {
  const pastedCredential = parseCredentialInput(input.credentialJson);
  const hasPastedCredentialJson = Boolean(input.credentialJson?.trim());
  const lookupId = pastedCredential?.id ?? input.credentialId;
  const presentationProof = parsePresentationProof(input.presentationProofJson);

  const [credential, requestFromInput] = await Promise.all([
    lookupId
      ? prisma.credential.findFirst({
          where: {
            OR: [{ id: lookupId }, { credentialId: lookupId }]
          },
          include: {
            student: true,
            issuer: true
          }
        })
      : null,
    input.requestId
      ? prisma.verificationRequest.findUnique({
          where: { id: input.requestId }
        })
      : null
  ]);

  const verificationRequest =
    requestFromInput ??
    (presentationProof
      ? await prisma.verificationRequest.findUnique({
          where: { id: presentationProof.requestId }
        })
      : null);
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
  const storedCredentialPayload = credential
    ? parseCredentialInput(credential.credentialJson)
    : null;
  const credentialPayload = pastedCredential ?? storedCredentialPayload;
  const presentedCredentialHash = safeHashCredential(
    pastedCredential ?? storedCredentialPayload
  );
  const payloadExpiry = credentialPayload?.expirationDate
    ? new Date(credentialPayload.expirationDate)
    : null;
  const now = new Date();
  const issuerProofResult =
    credentialPayload && presentedCredentialHash
      ? verifyIssuerCredentialProof({
          credential: credentialPayload,
          credentialHash: presentedCredentialHash
        })
      : null;

  const offChainChecks: VerificationCheck[] = [
    {
      label: "Credential exists",
      passed: Boolean(credential),
      detail: credential
        ? `Matched database credential ${credential.credentialId}`
        : "No matching credential record was found"
    },
    {
      label: "Presented credential hash matches stored hash",
      passed:
        Boolean(credential?.credentialHash) &&
        Boolean(presentedCredentialHash) &&
        credential?.credentialHash?.toLowerCase() ===
          presentedCredentialHash?.toLowerCase(),
      detail: credential
        ? hasPastedCredentialJson && !pastedCredential
          ? "Pasted credential JSON is invalid or does not match the StudentCredential schema"
          : `Stored hash ${credential.credentialHash ?? "missing"}, presented hash ${
              presentedCredentialHash ?? "unavailable"
            }`
        : "Hash cannot be checked without a database credential"
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
    },
    {
      label: "Issuer proof recovers issuer wallet",
      passed: Boolean(issuerProofResult?.valid),
      detail:
        issuerProofResult?.reason ??
        "Issuer proof cannot be checked without credential payload and hash."
    }
  ];
  const presentation = buildPresentationProofChecks({
    proofJson: input.presentationProofJson,
    credentialPayload,
    credentialHash: presentedCredentialHash,
    request: verificationRequest,
    now
  });
  const onChainChecks = await runOnChainChecks(
    offChainChecks,
    credentialPayload,
    presentedCredentialHash
  );
  const offChainPassed = offChainChecks.every((check) => check.passed);
  const presentationPassed = presentation.checks.every((check) => check.passed);
  const onChainPassed = onChainChecks.every((check) => check.passed);
  const approved = offChainPassed && presentationPassed && onChainPassed;
  const reasons = JSON.stringify({
    offChainChecks,
    onChainChecks,
    presentationChecks: presentation.checks
  });

  let verification = verificationRequest;

  if (approved && verificationRequest && presentationProof && credential) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.verificationRequest.updateMany({
        where: {
          id: verificationRequest.id,
          used: false
        },
        data: {
          used: true,
          credentialId: credential.credentialId,
          result: "APPROVED",
          reasons,
          checkResults: reasons,
          verifiedAt: now
        }
      });

      if (updated.count !== 1) {
        throw new Error("Verification request has already been used.");
      }

      await tx.presentationProof.create({
        data: {
          credentialId: presentationProof.credentialId,
          credentialHash: presentationProof.credentialHash,
          studentWalletAddress: presentationProof.studentWalletAddress,
          requestId: verificationRequest.id,
          nonce: presentationProof.nonce,
          verifierName: presentationProof.verifierName,
          message: presentationProof.message,
          signature: presentationProof.signature
        }
      });
    });
    verification = await prisma.verificationRequest.findUnique({
      where: { id: verificationRequest.id }
    });
  } else if (verificationRequest && !verificationRequest.used) {
    verification = await prisma.verificationRequest.update({
      where: { id: verificationRequest.id },
      data: {
        credentialId: credential?.credentialId ?? lookupId ?? null,
        verifierName: verificationRequest.verifierName,
        result: "REJECTED",
        reasons,
        checkResults: reasons,
        verifiedAt: now
      }
    });
  } else if (!verificationRequest) {
    verification = await prisma.verificationRequest.create({
      data: {
        credentialId: credential?.credentialId ?? lookupId ?? null,
        verifierName: input.verifierName,
        result: "REJECTED",
        reasons,
        checkResults: reasons,
        verifiedAt: now
      }
    });
  }

  return {
    result: approved ? "APPROVED" as const : "REJECTED" as const,
    checks: offChainChecks,
    offChainChecks,
    onChainChecks,
    presentationChecks: presentation.checks,
    verification,
    credentialId: credential?.credentialId ?? lookupId ?? null,
    credentialHash: presentedCredentialHash,
    offChainPassed,
    onChainPassed,
    presentationPassed
  };
}

export function getAuditAction(result: "APPROVED" | "REJECTED") {
  return result === "APPROVED" ? "verification.approve" : "verification.reject";
}

export function getVerifierName(user: CurrentUser, requestedName: string) {
  return user.verifierName ?? requestedName;
}
