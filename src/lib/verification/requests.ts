import type { VerificationRequest } from "@prisma/client";

import type { VerificationCheck } from "@/lib/types";

export type VerificationRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export type VerificationCheckGroups = {
  offChain: VerificationCheck[];
  onChain: VerificationCheck[];
  holderProof: VerificationCheck[];
};

type StoredCheckResults = {
  offChainChecks?: VerificationCheck[];
  onChainChecks?: VerificationCheck[];
  presentationChecks?: VerificationCheck[];
};

export type SerializedVerificationRequest = {
  requestId: string;
  credentialId: string | null;
  verifierName: string;
  callbackUrl: string | null;
  requestedCredentialType: string;
  nonce: string | null;
  challengeMessage: string | null;
  status: VerificationRequestStatus;
  result: VerificationRequestStatus;
  used: boolean;
  expiresAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  walletRedirectUrl: string;
  checkResults: VerificationCheckGroups;
};

export function getWalletRedirectUrl(requestId: string) {
  return `/wallet/present?requestId=${encodeURIComponent(requestId)}`;
}

export function getRequestStatus(
  request: Pick<VerificationRequest, "result" | "expiresAt">,
  now = new Date()
): VerificationRequestStatus {
  if (
    request.result === "PENDING" &&
    request.expiresAt &&
    request.expiresAt <= now
  ) {
    return "EXPIRED";
  }

  if (["APPROVED", "REJECTED", "EXPIRED"].includes(request.result)) {
    return request.result as VerificationRequestStatus;
  }

  return "PENDING";
}

function parseStoredChecks(value: string | null | undefined): StoredCheckResults {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as StoredCheckResults;
  } catch {
    return {};
  }
}

export function getCheckGroups(request: VerificationRequest): VerificationCheckGroups {
  const parsed = parseStoredChecks(request.checkResults ?? request.reasons);

  return {
    offChain: parsed.offChainChecks ?? [],
    onChain: parsed.onChainChecks ?? [],
    holderProof: parsed.presentationChecks ?? []
  };
}

export function buildChallengeDetails(request: VerificationRequest) {
  return {
    requestId: request.id,
    nonce: request.nonce,
    verifierName: request.verifierName,
    requestedCredentialType: request.requestedCredentialType,
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt?.toISOString() ?? null
  };
}

export function serializeVerificationRequest(
  request: VerificationRequest,
  now = new Date()
): SerializedVerificationRequest {
  const status = getRequestStatus(request, now);

  return {
    requestId: request.id,
    credentialId: request.credentialId,
    verifierName: request.verifierName,
    callbackUrl: request.callbackUrl,
    requestedCredentialType: request.requestedCredentialType,
    nonce: request.nonce,
    challengeMessage: request.challengeMessage,
    status,
    result: status,
    used: request.used,
    expiresAt: request.expiresAt?.toISOString() ?? null,
    verifiedAt: request.verifiedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    walletRedirectUrl: getWalletRedirectUrl(request.id),
    checkResults: getCheckGroups(request)
  };
}

export function serializeVerificationRequests(
  requests: VerificationRequest[],
  now = new Date()
) {
  return requests.map((request) => serializeVerificationRequest(request, now));
}
