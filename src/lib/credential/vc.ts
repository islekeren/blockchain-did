import type { Issuer, Student } from "@prisma/client";

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
      id: issuer.did,
      name: issuer.name,
      walletAddress: issuer.walletAddress
    },
    credentialSubject: {
      id: `did:ethr:${student.walletAddress}`,
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
  return JSON.parse(value) as StudentCredentialPayload;
}
