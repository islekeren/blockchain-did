import type { VerificationRequest } from "@prisma/client";

import { didForWalletAddress, normalizeWalletAddress } from "@/lib/blockchain/address";
import type { StudentCredentialPayload } from "@/lib/credential/vc";
import type { VerificationCheck } from "@/lib/types";
import {
  parsePresentationProof,
  verifyPresentationSignature,
  type PresentationProofPayload
} from "./message";

type PresentationValidationInput = {
  proofJson?: string;
  credentialPayload: StudentCredentialPayload | null;
  credentialHash: string | null;
  request: VerificationRequest | null;
  now?: Date;
};

export type PresentationValidationResult = {
  proof: PresentationProofPayload | null;
  checks: VerificationCheck[];
};

const presentationCheckLabels = [
  "Presentation proof exists",
  "Presentation credential ID matches",
  "Presentation credential hash matches",
  "Verification request exists",
  "Presentation nonce matches request",
  "Presentation verifier matches request",
  "Verification request is not expired",
  "Verification request is unused",
  "Student wallet matches credential subject",
  "Presentation signature recovers student wallet",
  "Presentation message matches deterministic message"
];

function failedChecks(reason: string): VerificationCheck[] {
  return presentationCheckLabels.map((label) => ({
    label,
    passed: false,
    detail: reason
  }));
}

export function buildPresentationProofChecks({
  proofJson,
  credentialPayload,
  credentialHash,
  request,
  now = new Date()
}: PresentationValidationInput): PresentationValidationResult {
  const proof = parsePresentationProof(proofJson);

  if (!proof) {
    return {
      proof: null,
      checks: failedChecks("Presentation proof JSON is missing or invalid.")
    };
  }

  const checks: VerificationCheck[] = [
    {
      label: "Presentation proof exists",
      passed: true,
      detail: "Presentation proof JSON was parsed successfully."
    }
  ];

  checks.push({
    label: "Presentation credential ID matches",
    passed: Boolean(credentialPayload && proof.credentialId === credentialPayload.id),
    detail: credentialPayload
      ? `Proof credential ${proof.credentialId}; credential payload ${credentialPayload.id}`
      : "Credential payload is unavailable."
  });

  checks.push({
    label: "Presentation credential hash matches",
    passed:
      Boolean(credentialHash) &&
      proof.credentialHash.toLowerCase() === credentialHash?.toLowerCase(),
    detail: `Proof hash ${proof.credentialHash}; credential hash ${
      credentialHash ?? "unavailable"
    }`
  });

  checks.push({
    label: "Verification request exists",
    passed: Boolean(request),
    detail: request
      ? `Matched request ${request.id}`
      : `Request ${proof.requestId} was not found.`
  });

  checks.push({
    label: "Presentation nonce matches request",
    passed: Boolean(request?.nonce && proof.nonce === request.nonce),
    detail: request
      ? `Proof nonce ${proof.nonce}; request nonce ${request.nonce ?? "missing"}`
      : "Nonce cannot be checked without a request."
  });

  checks.push({
    label: "Presentation verifier matches request",
    passed: Boolean(request && proof.verifierName === request.verifierName),
    detail: request
      ? `Proof verifier ${proof.verifierName}; request verifier ${request.verifierName}`
      : "Verifier name cannot be checked without a request."
  });

  checks.push({
    label: "Verification request is not expired",
    passed: Boolean(request?.expiresAt && request.expiresAt > now),
    detail: request?.expiresAt
      ? `Expires at ${request.expiresAt.toISOString()}`
      : "Request expiration is unavailable."
  });

  checks.push({
    label: "Verification request is unused",
    passed: Boolean(request && !request.used),
    detail: request
      ? request.used
        ? "This verification request has already been used."
        : "This verification request has not been used."
      : "Usage cannot be checked without a request."
  });

  let walletMatches = false;
  let normalizedWallet = proof.studentWalletAddress;
  try {
    normalizedWallet = normalizeWalletAddress(proof.studentWalletAddress);
    walletMatches =
      Boolean(credentialPayload?.credentialSubject.id) &&
      didForWalletAddress(normalizedWallet) === credentialPayload?.credentialSubject.id;
  } catch {
    walletMatches = false;
  }

  checks.push({
    label: "Student wallet matches credential subject",
    passed: walletMatches,
    detail: credentialPayload
      ? `Proof wallet ${proof.studentWalletAddress}; credential subject ${credentialPayload.credentialSubject.id}`
      : "Credential subject is unavailable."
  });

  try {
    const signatureResult = verifyPresentationSignature(proof);

    checks.push({
      label: "Presentation signature recovers student wallet",
      passed: signatureResult.recoveredAddress === normalizedWallet,
      detail: `Recovered ${signatureResult.recoveredAddress}; expected ${normalizedWallet}`
    });

    checks.push({
      label: "Presentation message matches deterministic message",
      passed: signatureResult.messageMatches,
      detail: signatureResult.messageMatches
        ? "Signed message exactly matches the reconstructed presentation message."
        : "Signed message differs from the reconstructed presentation message."
    });
  } catch (error) {
    checks.push({
      label: "Presentation signature recovers student wallet",
      passed: false,
      detail:
        error instanceof Error
          ? error.message
          : "Unable to recover signer from presentation signature."
    });
    checks.push({
      label: "Presentation message matches deterministic message",
      passed: false,
      detail: "Message cannot be trusted because signature recovery failed."
    });
  }

  return { proof, checks };
}
