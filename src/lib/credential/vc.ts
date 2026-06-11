import type { Issuer, Student } from "@prisma/client";

import {
  didForWalletAddress,
  normalizeWalletAddress
} from "../blockchain/address";

export type StudentCredentialPayload = {
  id: string;
  type: ["VerifiableCredential", "StudentCredential"];
  issuer: {
    id: string;
    name: string;
    walletAddress: string;
  };
  credentialSubject: {
    id: string;
    studentId: string;
    activeStudent: boolean;
    university: string;
  };
  schema: {
    name: "StudentCredential";
    version: "1.0";
  };
  issuanceDate: string;
  expirationDate: string;
};

type BuildCredentialInput = {
  student: Student;
  issuer: Issuer;
  issuedAt?: Date;
  expiresAt: Date;
};

export function buildStudentCredential({
  student,
  issuer,
  issuedAt = new Date(),
  expiresAt
}: BuildCredentialInput): StudentCredentialPayload {
  const credentialId = `credential-${crypto.randomUUID()}`;

  return {
    id: credentialId,
    type: ["VerifiableCredential", "StudentCredential"],
    issuer: {
      id: didForWalletAddress(issuer.walletAddress),
      name: issuer.name,
      walletAddress: normalizeWalletAddress(issuer.walletAddress)
    },
    credentialSubject: {
      id: didForWalletAddress(student.walletAddress),
      studentId: student.id,
      activeStudent: student.active,
      university: issuer.name
    },
    schema: {
      name: "StudentCredential",
      version: "1.0"
    },
    issuanceDate: issuedAt.toISOString(),
    expirationDate: expiresAt.toISOString()
  };
}

export function parseCredentialJson(value: string) {
  const parsed = JSON.parse(value) as unknown;

  if (!isStudentCredentialPayload(parsed)) {
    throw new Error("Invalid StudentCredential payload");
  }

  return parsed;
}

export function isStudentCredentialPayload(
  value: unknown
): value is StudentCredentialPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as StudentCredentialPayload;

  return (
    typeof payload.id === "string" &&
    Array.isArray(payload.type) &&
    payload.type.includes("VerifiableCredential") &&
    payload.type.includes("StudentCredential") &&
    typeof payload.issuer?.id === "string" &&
    typeof payload.issuer?.name === "string" &&
    typeof payload.issuer?.walletAddress === "string" &&
    typeof payload.credentialSubject?.id === "string" &&
    typeof payload.credentialSubject?.studentId === "string" &&
    typeof payload.credentialSubject?.activeStudent === "boolean" &&
    typeof payload.credentialSubject?.university === "string" &&
    payload.schema?.name === "StudentCredential" &&
    payload.schema?.version === "1.0" &&
    typeof payload.issuanceDate === "string" &&
    typeof payload.expirationDate === "string"
  );
}
