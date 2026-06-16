import { z } from "zod";

import { CREDENTIAL_STATUSES } from "@/lib/domain/status";
import { USER_ROLES } from "@/lib/auth/roles";

export const walletAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Use a 0x-prefixed 20 byte address");

export const didEthrSchema = z
  .string()
  .trim()
  .regex(/^did:ethr:0x[a-fA-F0-9]{40}$/, "Use a did:ethr:0x... DID");

export const createIssuerSchema = z.object({
  name: z.string().trim().min(2),
  did: didEthrSchema,
  walletAddress: walletAddressSchema,
  trusted: z.boolean().optional()
});

export const updateIssuerSchema = z.object({
  trusted: z.boolean()
});

export const createStudentSchema = z.object({
  name: z.string().trim().min(2),
  studentNo: z.string().trim().min(2),
  department: z.string().trim().min(2),
  universityId: z.string().trim().min(1),
  walletAddress: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    walletAddressSchema.optional()
  ),
  active: z.boolean().optional()
});

export const updateStudentSchema = z.object({
  active: z.boolean()
});

export const issueCredentialSchema = z.object({
  studentId: z.string().trim().min(1),
  issuerId: z.string().trim().min(1).optional(),
  expiresAt: z.string().datetime().optional()
});

export const updateCredentialSchema = z.object({
  status: z.enum(CREDENTIAL_STATUSES).optional(),
  registeredTxHash: z.string().trim().regex(/^0x[a-fA-F0-9]+$/).optional(),
  revokedAt: z.string().datetime().optional(),
  revocationTxHash: z.string().trim().regex(/^0x[a-fA-F0-9]+$/).optional(),
  revocationReason: z.string().trim().max(500).optional(),
  issuerProof: z
    .object({
      type: z.string().trim().min(1),
      created: z.string().datetime(),
      verificationMethod: didEthrSchema,
      proofPurpose: z.string().trim().min(1),
      message: z.string().trim().min(1),
      signature: z.string().trim().regex(/^0x[a-fA-F0-9]+$/)
    })
    .optional()
});

export const verifyCredentialSchema = z
  .object({
    credentialId: z.string().trim().optional(),
    credentialJson: z.string().trim().optional(),
    presentationProofJson: z.string().trim().optional(),
    verifierName: z.string().trim().min(2).default("EduDiscounts Marketplace")
  })
  .refine((value) => value.credentialId || value.credentialJson, {
    message: "Select or paste a credential to verify"
  });

export const createVerificationChallengeSchema = z.object({
  verifierName: z.string().trim().min(2).default("EduDiscounts Marketplace")
});

export const createVerifierRequestSchema = z.object({
  verifierName: z.string().trim().min(2).default("EduDiscounts Marketplace"),
  callbackUrl: z.string().trim().optional(),
  requestedCredentialType: z
    .string()
    .trim()
    .min(1)
    .default("StudentCredential")
});

export const submitVerifierPresentationSchema = z.object({
  credentialId: z.string().trim().min(1),
  presentationProof: z.record(z.unknown())
});

export const useVerificationRequestSchema = z.object({
  credentialId: z.string().trim().min(1),
  credentialHash: z.string().trim().min(1),
  presentationProofJson: z.string().trim().min(1)
});

export const walletAuthNonceSchema = z.object({
  walletAddress: walletAddressSchema
});

export const walletAuthVerifySchema = z.object({
  walletAddress: walletAddressSchema,
  message: z.string().trim().min(1),
  signature: z.string().trim().regex(/^0x[a-fA-F0-9]+$/)
});

export const auditLogSchema = z.object({
  action: z.string().trim().min(2).max(80),
  targetType: z.string().trim().min(2).max(80),
  targetId: z.string().trim().max(120).optional(),
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]+$/).optional(),
  metadata: z.unknown().optional()
});

export const createUserSchema = z.object({
  walletAddress: walletAddressSchema,
  role: z.enum(USER_ROLES),
  issuerId: z.string().trim().min(1).optional(),
  studentId: z.string().trim().min(1).optional(),
  verifierName: z.string().trim().min(2).optional()
});
