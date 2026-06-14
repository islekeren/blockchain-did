import { z } from "zod";

import { CREDENTIAL_STATUSES } from "@/lib/domain/status";

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
  walletAddress: walletAddressSchema,
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
  status: z.enum(CREDENTIAL_STATUSES)
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

export const useVerificationRequestSchema = z.object({
  credentialId: z.string().trim().min(1),
  credentialHash: z.string().trim().min(1),
  presentationProofJson: z.string().trim().min(1)
});
