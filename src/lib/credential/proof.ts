import { getAddress, verifyMessage } from "ethers";

import { didForWalletAddress, normalizeWalletAddress } from "@/lib/blockchain/address";
import type { StudentCredentialPayload } from "./vc";

export type IssuerCredentialProof = {
  type: "EthereumPersonalSignature2021";
  created: string;
  verificationMethod: string;
  proofPurpose: "assertionMethod";
  message: string;
  signature: string;
};

export function createCredentialProofMessage(input: {
  credential: StudentCredentialPayload;
  credentialHash: string;
}) {
  const issuerWallet = normalizeWalletAddress(input.credential.issuer.walletAddress);

  return [
    "Student Credential Issuance",
    "",
    `Credential ID: ${input.credential.id}`,
    `Credential Hash: ${input.credentialHash.toLowerCase()}`,
    `Issuer Wallet: ${issuerWallet}`,
    `Issuer DID: ${didForWalletAddress(issuerWallet)}`,
    `Subject DID: ${input.credential.credentialSubject.id}`,
    `Schema: ${input.credential.schema.name}@${input.credential.schema.version}`,
    `Issued At: ${input.credential.issuanceDate}`,
    `Expires At: ${input.credential.expirationDate}`
  ].join("\n");
}

export function buildIssuerCredentialProof(input: {
  credential: StudentCredentialPayload;
  credentialHash: string;
  signature: string;
  created?: Date;
}): IssuerCredentialProof {
  const created = input.created ?? new Date();

  return {
    type: "EthereumPersonalSignature2021",
    created: created.toISOString(),
    verificationMethod: didForWalletAddress(input.credential.issuer.walletAddress),
    proofPurpose: "assertionMethod",
    message: createCredentialProofMessage(input),
    signature: input.signature
  };
}

export function verifyIssuerCredentialProof(input: {
  credential: StudentCredentialPayload;
  credentialHash: string;
}) {
  const proof = input.credential.proof;

  if (!proof) {
    return {
      valid: false,
      recoveredAddress: null,
      expectedAddress: normalizeWalletAddress(input.credential.issuer.walletAddress),
      messageMatches: false,
      reason: "Credential does not include an issuer proof."
    };
  }

  const expectedAddress = normalizeWalletAddress(input.credential.issuer.walletAddress);
  const expectedMessage = createCredentialProofMessage(input);
  const messageMatches = proof.message === expectedMessage;

  try {
    const recoveredAddress = getAddress(verifyMessage(proof.message, proof.signature));
    const valid =
      proof.type === "EthereumPersonalSignature2021" &&
      proof.proofPurpose === "assertionMethod" &&
      proof.verificationMethod === didForWalletAddress(expectedAddress) &&
      messageMatches &&
      recoveredAddress === expectedAddress;

    return {
      valid,
      recoveredAddress,
      expectedAddress,
      messageMatches,
      reason: valid
        ? "Issuer proof recovered the credential issuer wallet."
        : "Issuer proof did not match the credential issuer or message."
    };
  } catch (error) {
    return {
      valid: false,
      recoveredAddress: null,
      expectedAddress,
      messageMatches,
      reason:
        error instanceof Error
          ? error.message
          : "Unable to recover issuer proof signer."
    };
  }
}
