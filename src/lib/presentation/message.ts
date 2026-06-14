import { getAddress, isHexString, verifyMessage } from "ethers";

import { requestSigner } from "@/lib/blockchain/provider";

export type PresentationMessageInput = {
  credentialId: string;
  credentialHash: string;
  studentWalletAddress: string;
  nonce: string;
  verifierName: string;
  requestId: string;
};

export type PresentationProofPayload = PresentationMessageInput & {
  message: string;
  signature: string;
};

function normalizeCredentialHash(value: string) {
  const trimmed = value.trim();

  if (!isHexString(trimmed, 32)) {
    throw new Error("Credential hash must be a 0x-prefixed bytes32 value.");
  }

  return trimmed.toLowerCase();
}

export function normalizePresentationInput(
  input: PresentationMessageInput
): PresentationMessageInput {
  return {
    credentialId: input.credentialId.trim(),
    credentialHash: normalizeCredentialHash(input.credentialHash),
    studentWalletAddress: getAddress(input.studentWalletAddress.trim()),
    verifierName: input.verifierName.trim(),
    requestId: input.requestId.trim(),
    nonce: input.nonce.trim()
  };
}

export function createPresentationMessage(input: PresentationMessageInput) {
  const normalized = normalizePresentationInput(input);

  return [
    "Student Verification Presentation",
    "",
    `Credential ID: ${normalized.credentialId}`,
    `Credential Hash: ${normalized.credentialHash}`,
    `Student Wallet: ${normalized.studentWalletAddress}`,
    `Verifier: ${normalized.verifierName}`,
    `Request ID: ${normalized.requestId}`,
    `Nonce: ${normalized.nonce}`
  ].join("\n");
}

export async function signPresentation(input: PresentationMessageInput) {
  const signer = await requestSigner();
  const message = createPresentationMessage(input);
  const signature = await signer.signMessage(message);

  return { message, signature };
}

export function verifyPresentationSignature(input: PresentationProofPayload) {
  const expectedMessage = createPresentationMessage(input);
  const messageMatches = input.message === expectedMessage;
  const recoveredAddress = getAddress(verifyMessage(input.message, input.signature));
  const expectedAddress = getAddress(input.studentWalletAddress);

  return {
    recoveredAddress,
    expectedMessage,
    messageMatches,
    valid: messageMatches && recoveredAddress === expectedAddress
  };
}

export function isPresentationProofPayload(
  value: unknown
): value is PresentationProofPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const proof = value as PresentationProofPayload;

  return (
    typeof proof.credentialId === "string" &&
    typeof proof.credentialHash === "string" &&
    typeof proof.studentWalletAddress === "string" &&
    typeof proof.requestId === "string" &&
    typeof proof.nonce === "string" &&
    typeof proof.verifierName === "string" &&
    typeof proof.message === "string" &&
    typeof proof.signature === "string"
  );
}

export function parsePresentationProof(value?: string) {
  if (!value?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return isPresentationProofPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
