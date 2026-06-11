export const CREDENTIAL_STATUSES = ["ISSUED", "REVOKED", "EXPIRED"] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export const VERIFICATION_RESULTS = ["APPROVED", "REJECTED", "PENDING"] as const;
export type VerificationResultStatus = (typeof VERIFICATION_RESULTS)[number];

export function isCredentialStatus(value: string): value is CredentialStatus {
  return CREDENTIAL_STATUSES.includes(value as CredentialStatus);
}

export function isVerificationResultStatus(
  value: string
): value is VerificationResultStatus {
  return VERIFICATION_RESULTS.includes(value as VerificationResultStatus);
}
