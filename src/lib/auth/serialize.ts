import { normalizeWalletAddress } from "@/lib/blockchain/address";
import { isUserRole } from "./roles";

type UserRecord = {
  id: string;
  walletAddress: string;
  role: string;
  issuerId: string | null;
  studentId: string | null;
  verifierName: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  issuer?: unknown;
  student?: unknown;
};

export function serializeUser(user: UserRecord) {
  return {
    ...user,
    walletAddress: normalizeWalletAddress(user.walletAddress),
    role: isUserRole(user.role) ? user.role : "VERIFIER",
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}
