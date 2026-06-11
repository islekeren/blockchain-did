import { AbiCoder, keccak256 } from "ethers";

import { normalizeWalletAddress } from "../blockchain/address";
import type { StudentCredentialPayload } from "./vc";

export type CredentialHashInput = {
  credentialId: string;
  issuerDid: string;
  issuerWalletAddress: string;
  subjectDid: string;
  studentId: string;
  activeStudent: boolean;
  schemaName: string;
  schemaVersion: string;
  issuanceTimestamp: bigint;
  expirationTimestamp: bigint;
};

const credentialHashTypes = [
  "string",
  "string",
  "address",
  "string",
  "string",
  "bool",
  "string",
  "string",
  "uint256",
  "uint256"
] as const;

function toUnixSeconds(value: string, fieldName: string) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw new Error(`${fieldName} must be a valid ISO date`);
  }

  return BigInt(Math.floor(timestamp / 1000));
}

export function credentialHashInputFromPayload(
  payload: StudentCredentialPayload
): CredentialHashInput {
  return {
    credentialId: payload.id,
    issuerDid: payload.issuer.id,
    issuerWalletAddress: normalizeWalletAddress(payload.issuer.walletAddress),
    subjectDid: payload.credentialSubject.id,
    studentId: payload.credentialSubject.studentId,
    activeStudent: payload.credentialSubject.activeStudent,
    schemaName: payload.schema.name,
    schemaVersion: payload.schema.version,
    issuanceTimestamp: toUnixSeconds(payload.issuanceDate, "issuanceDate"),
    expirationTimestamp: toUnixSeconds(payload.expirationDate, "expirationDate")
  };
}

export function hashCredentialCanonicalInput(input: CredentialHashInput) {
  const encoded = AbiCoder.defaultAbiCoder().encode(credentialHashTypes, [
    input.credentialId,
    input.issuerDid,
    normalizeWalletAddress(input.issuerWalletAddress),
    input.subjectDid,
    input.studentId,
    input.activeStudent,
    input.schemaName,
    input.schemaVersion,
    input.issuanceTimestamp,
    input.expirationTimestamp
  ]);

  return keccak256(encoded);
}

/**
 * Deterministic credential hash for DB storage and on-chain registry writes.
 * This intentionally hashes ABI-encoded canonical fields, not raw JSON.
 */
export function hashCredentialPayload(payload: StudentCredentialPayload) {
  return hashCredentialCanonicalInput(credentialHashInputFromPayload(payload));
}
