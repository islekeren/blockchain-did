import type { StudentCredentialPayload } from "@/lib/credential/vc";
import type { CredentialStatus } from "@/lib/domain/status";

export type IssuerRecord = {
  id: string;
  name: string;
  did: string;
  walletAddress: string;
  trusted: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    students: number;
    credentials: number;
  };
};

export type StudentRecord = {
  id: string;
  name: string;
  studentNo: string;
  department: string;
  universityId: string;
  walletAddress: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  university?: IssuerRecord;
  _count?: {
    credentials: number;
  };
};

export type CredentialRecord = {
  id: string;
  credentialId: string;
  studentId: string;
  issuerId: string;
  type: string;
  schemaName: string;
  credentialJson: StudentCredentialPayload;
  credentialHash: string | null;
  status: CredentialStatus;
  issuedAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  student?: StudentRecord;
  issuer?: IssuerRecord;
};

export type VerificationCheck = {
  label: string;
  passed: boolean;
  detail: string;
};

export type VerificationResult = {
  result: "APPROVED" | "REJECTED";
  checks: VerificationCheck[];
};
