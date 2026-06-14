import { Wallet } from "ethers";

import "./module";
import {
  buildIssuerCredentialProof,
  createCredentialProofMessage
} from "../../src/lib/credential/proof";
import { hashCredentialPayload } from "../../src/lib/credential/hash";
import type { StudentCredentialPayload } from "../../src/lib/credential/vc";
import { didForWalletAddress } from "../../src/lib/blockchain/address";
import {
  createPresentationMessage,
  type PresentationProofPayload
} from "../../src/lib/presentation/message";

export const issuerWallet = new Wallet(
  "0x1111111111111111111111111111111111111111111111111111111111111111"
);

export const otherIssuerWallet = new Wallet(
  "0x2222222222222222222222222222222222222222222222222222222222222222"
);

export const studentWallet = new Wallet(
  "0x3333333333333333333333333333333333333333333333333333333333333333"
);

export const verifierName = "EduDiscounts Marketplace";

export function buildCredentialPayload(
  overrides: Partial<StudentCredentialPayload> = {}
): StudentCredentialPayload {
  const payload: StudentCredentialPayload = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    id: "credential-demo-1",
    type: ["VerifiableCredential", "StudentCredential"],
    issuer: {
      id: didForWalletAddress(issuerWallet.address),
      name: "Demo University",
      walletAddress: issuerWallet.address
    },
    credentialSubject: {
      id: didForWalletAddress(studentWallet.address),
      studentId: "student-1",
      activeStudent: true,
      university: "Demo University"
    },
    schema: {
      name: "StudentCredential",
      version: "1.0"
    },
    credentialSchema: {
      id: "urn:student-verification:schemas:student-credential:1.0",
      type: "JsonSchema",
      name: "StudentCredential",
      version: "1.0"
    },
    issuanceDate: "2026-01-01T00:00:00.000Z",
    expirationDate: "2099-01-01T00:00:00.000Z"
  };

  return {
    ...payload,
    ...overrides,
    issuer: {
      ...payload.issuer,
      ...overrides.issuer
    },
    credentialSubject: {
      ...payload.credentialSubject,
      ...overrides.credentialSubject
    },
    schema: {
      ...payload.schema,
      ...overrides.schema
    },
    credentialSchema: {
      ...payload.credentialSchema,
      ...overrides.credentialSchema
    }
  };
}

export async function buildSignedCredential(
  overrides: Partial<StudentCredentialPayload> = {}
) {
  const credential = buildCredentialPayload(overrides);
  const credentialHash = hashCredentialPayload(credential);
  const signature = await issuerWallet.signMessage(
    createCredentialProofMessage({
      credential,
      credentialHash
    })
  );

  return {
    credential: {
      ...credential,
      proof: buildIssuerCredentialProof({
        credential,
        credentialHash,
        signature,
        created: new Date("2026-01-01T00:00:00.000Z")
      })
    },
    credentialHash
  };
}

export async function buildPresentationProof(input: {
  credentialId: string;
  credentialHash: string;
  requestId?: string;
  nonce?: string;
  verifierName?: string;
  studentWalletAddress?: string;
}): Promise<PresentationProofPayload> {
  const proofInput = {
    credentialId: input.credentialId,
    credentialHash: input.credentialHash,
    studentWalletAddress: input.studentWalletAddress ?? studentWallet.address,
    requestId: input.requestId ?? "verification-request-1",
    nonce: input.nonce ?? "nonce-1",
    verifierName: input.verifierName ?? verifierName
  };
  const message = createPresentationMessage(proofInput);
  const signature = await studentWallet.signMessage(message);

  return {
    ...proofInput,
    message,
    signature
  };
}

export function buildVerificationRequest(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    id: "verification-request-1",
    credentialId: null,
    verifierName,
    nonce: "nonce-1",
    challengeMessage: "{}",
    result: "PENDING",
    reasons: "[]",
    used: false,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

export function buildCredentialRecord(input: {
  credential: StudentCredentialPayload;
  credentialHash: string;
  expiresAt?: Date;
  status?: string;
}) {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    id: "db-credential-1",
    credentialId: input.credential.id,
    studentId: "student-1",
    issuerId: "issuer-1",
    type: "StudentCredential",
    schemaName: "StudentCredential",
    credentialJson: JSON.stringify(input.credential),
    credentialHash: input.credentialHash,
    status: input.status ?? "ISSUED",
    issuedAt: new Date(input.credential.issuanceDate),
    expiresAt: input.expiresAt ?? new Date(input.credential.expirationDate),
    registeredAt: now,
    registeredTxHash: "0xabc",
    revokedAt: null,
    revocationTxHash: null,
    revocationReason: null,
    createdAt: now,
    updatedAt: now,
    student: {
      id: "student-1",
      name: "Ada Student",
      studentNo: "20260001",
      department: "Computer Engineering",
      universityId: "issuer-1",
      walletAddress: studentWallet.address,
      active: input.credential.credentialSubject.activeStudent,
      createdAt: now,
      updatedAt: now
    },
    issuer: buildIssuerRecord()
  };
}

export function buildIssuerRecord(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    id: "issuer-1",
    name: "Demo University",
    did: didForWalletAddress(issuerWallet.address),
    walletAddress: issuerWallet.address,
    trusted: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}
