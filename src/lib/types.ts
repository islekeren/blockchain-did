import type { StudentCredentialPayload } from "@/lib/credential/vc";
import type { CredentialStatus } from "@/lib/domain/status";

export type UserRole = "ADMIN" | "ISSUER" | "STUDENT" | "VERIFIER";

export type UserRecord = {
  id: string;
  walletAddress: string;
  role: UserRole;
  issuerId: string | null;
  studentId: string | null;
  verifierName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  issuer?: IssuerRecord | null;
  student?: StudentRecord | null;
};

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
  registeredAt: string | null;
  registeredTxHash: string | null;
  revokedAt: string | null;
  revocationTxHash: string | null;
  revocationReason: string | null;
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
  checks?: VerificationCheck[];
  offChainChecks?: VerificationCheck[];
  onChainChecks?: VerificationCheck[];
  presentationChecks?: VerificationCheck[];
  verification?: unknown;
};

export type VerificationRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export type VerificationRequestRecord = {
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
  checkResults: {
    offChain: VerificationCheck[];
    onChain: VerificationCheck[];
    holderProof: VerificationCheck[];
  };
};

export type AuditLogRecord = {
  id: string;
  actorUserId: string | null;
  actorWallet: string | null;
  actorRole: UserRole | null;
  action: string;
  targetType: string;
  targetId: string | null;
  txHash: string | null;
  metadata: unknown;
  createdAt: string;
};
