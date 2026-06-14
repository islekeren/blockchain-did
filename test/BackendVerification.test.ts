import { expect } from "chai";

import "./helpers/module";
import { clearModule, installModuleMocks } from "./helpers/module";
import {
  buildCredentialRecord,
  buildPresentationProof,
  buildSignedCredential,
  buildVerificationRequest,
  issuerWallet
} from "./helpers/fixtures";

type VerifyRoute = typeof import("../src/app/api/verify/route");

type Check = {
  label: string;
  passed: boolean;
  detail: string;
};

function findCheck(checks: Check[], label: string) {
  const check = checks.find((item) => item.label === label);

  expect(check, `Missing check: ${label}`).to.not.equal(undefined);

  return check!;
}

function installVerifyRoute(input: {
  credentialRecord: unknown;
  issuerRecord: unknown;
  verificationRequest: Record<string, unknown> | null;
  onChain?: Partial<Record<string, unknown>>;
}) {
  let verificationRequest = input.verificationRequest;
  const presentationProofs: unknown[] = [];
  const tx = {
    verificationRequest: {
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        if (!verificationRequest || verificationRequest.used) {
          return { count: 0 };
        }

        verificationRequest = {
          ...verificationRequest,
          ...data,
          updatedAt: new Date()
        };

        return { count: 1 };
      }
    },
    presentationProof: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const proof = {
          id: `presentation-proof-${presentationProofs.length + 1}`,
          createdAt: new Date(),
          ...data
        };

        presentationProofs.push(proof);

        return proof;
      }
    }
  };
  const prisma = {
    credential: {
      findFirst: async () => input.credentialRecord
    },
    issuer: {
      findFirst: async () => input.issuerRecord
    },
    verificationRequest: {
      findUnique: async () => verificationRequest,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        verificationRequest = {
          ...verificationRequest,
          ...data,
          updatedAt: new Date()
        };

        return verificationRequest;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        verificationRequest = {
          id: "verification-request-created",
          nonce: null,
          challengeMessage: null,
          used: false,
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data
        };

        return verificationRequest;
      }
    },
    $transaction: async (callback: (txClient: typeof tx) => Promise<unknown>) =>
      callback(tx)
  };
  const restore = installModuleMocks({
    "@/lib/db/prisma": { prisma },
    "@/lib/audit/log": {
      writeAuditLog: async () => ({ id: "audit-log-1" })
    },
    "@/lib/auth/session": {
      requireRole: async () => ({
        id: "verifier-user-1",
        walletAddress: "0x0000000000000000000000000000000000000001",
        role: "VERIFIER",
        issuerId: null,
        studentId: null,
        verifierName: "EduDiscounts Marketplace"
      }),
      authErrorResponse: () => null
    },
    "@/lib/blockchain/serverRegistry": {
      isTrustedIssuerOnChainServer: async () => true,
      isSchemaValidOnChainServer: async () => true,
      getSchemaNameOnChainServer: async () => "StudentCredential",
      isCredentialRegisteredOnChainServer: async () => true,
      isCredentialRevokedOnChainServer: async () => false,
      getCredentialIssuerOnChainServer: async () => issuerWallet.address,
      ...input.onChain
    }
  });

  clearModule("./src/app/api/verify/route");

  const route = require("../src/app/api/verify/route") as VerifyRoute;

  return {
    POST: route.POST,
    restore,
    getVerificationRequest: () => verificationRequest,
    getPresentationProofs: () => presentationProofs
  };
}

async function postJson(
  POST: VerifyRoute["POST"],
  body: Record<string, unknown>
) {
  const response = await POST(
    new Request("http://localhost/api/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    })
  );

  return {
    status: response.status,
    body: (await response.json()) as {
      result: string;
      offChainChecks: Check[];
      onChainChecks: Check[];
      presentationChecks: Check[];
      verification?: unknown;
    }
  };
}

async function buildVerificationCase(options: {
  credentialOverrides?: Parameters<typeof buildSignedCredential>[0];
  requestOverrides?: Record<string, unknown>;
  expiresAt?: Date;
  status?: string;
} = {}) {
  const { credential, credentialHash } = await buildSignedCredential(
    options.credentialOverrides
  );
  const verificationRequest = buildVerificationRequest(options.requestOverrides);
  const presentationProof = await buildPresentationProof({
    credentialId: credential.id,
    credentialHash,
    requestId: String(verificationRequest.id),
    nonce: String(verificationRequest.nonce),
    verifierName: String(verificationRequest.verifierName)
  });
  const credentialRecord = buildCredentialRecord({
    credential,
    credentialHash,
    expiresAt: options.expiresAt,
    status: options.status
  });

  return {
    credential,
    credentialHash,
    credentialRecord,
    verificationRequest,
    presentationProof
  };
}

describe("backend verification route", function () {
  it("approves a valid credential with issuer proof, presentation proof, and on-chain checks", async function () {
    const verificationCase = await buildVerificationCase();
    const route = installVerifyRoute({
      credentialRecord: verificationCase.credentialRecord,
      issuerRecord: verificationCase.credentialRecord.issuer,
      verificationRequest: verificationCase.verificationRequest
    });

    try {
      const { status, body } = await postJson(route.POST, {
        credentialJson: JSON.stringify(verificationCase.credential),
        presentationProofJson: JSON.stringify(verificationCase.presentationProof)
      });

      expect(status).to.equal(200);
      expect(body.result).to.equal("APPROVED");
      expect(body.offChainChecks.every((check) => check.passed)).to.equal(true);
      expect(body.onChainChecks.every((check) => check.passed)).to.equal(true);
      expect(body.presentationChecks.every((check) => check.passed)).to.equal(true);
      expect(route.getPresentationProofs()).to.have.lengthOf(1);
      expect(route.getVerificationRequest()?.used).to.equal(true);
    } finally {
      route.restore();
    }
  });

  it("rejects a credential that is expired off-chain", async function () {
    const expiredAt = new Date("2000-01-01T00:00:00.000Z");
    const verificationCase = await buildVerificationCase({
      credentialOverrides: {
        expirationDate: expiredAt.toISOString()
      },
      expiresAt: expiredAt
    });
    const route = installVerifyRoute({
      credentialRecord: verificationCase.credentialRecord,
      issuerRecord: verificationCase.credentialRecord.issuer,
      verificationRequest: verificationCase.verificationRequest
    });

    try {
      const { body } = await postJson(route.POST, {
        credentialJson: JSON.stringify(verificationCase.credential),
        presentationProofJson: JSON.stringify(verificationCase.presentationProof)
      });

      expect(body.result).to.equal("REJECTED");
      expect(findCheck(body.offChainChecks, "Credential is not expired").passed).to.equal(
        false
      );
      expect(route.getPresentationProofs()).to.have.lengthOf(0);
    } finally {
      route.restore();
    }
  });

  it("rejects a credential hash that is revoked on-chain", async function () {
    const verificationCase = await buildVerificationCase();
    const route = installVerifyRoute({
      credentialRecord: verificationCase.credentialRecord,
      issuerRecord: verificationCase.credentialRecord.issuer,
      verificationRequest: verificationCase.verificationRequest,
      onChain: {
        isCredentialRevokedOnChainServer: async () => true
      }
    });

    try {
      const { body } = await postJson(route.POST, {
        credentialJson: JSON.stringify(verificationCase.credential),
        presentationProofJson: JSON.stringify(verificationCase.presentationProof)
      });

      expect(body.result).to.equal("REJECTED");
      expect(
        findCheck(body.onChainChecks, "Credential not revoked on-chain").passed
      ).to.equal(false);
      expect(route.getPresentationProofs()).to.have.lengthOf(0);
    } finally {
      route.restore();
    }
  });

  it("rejects an expired presentation challenge", async function () {
    const verificationCase = await buildVerificationCase({
      requestOverrides: {
        expiresAt: new Date("2000-01-01T00:00:00.000Z")
      }
    });
    const route = installVerifyRoute({
      credentialRecord: verificationCase.credentialRecord,
      issuerRecord: verificationCase.credentialRecord.issuer,
      verificationRequest: verificationCase.verificationRequest
    });

    try {
      const { body } = await postJson(route.POST, {
        credentialJson: JSON.stringify(verificationCase.credential),
        presentationProofJson: JSON.stringify(verificationCase.presentationProof)
      });

      expect(body.result).to.equal("REJECTED");
      expect(
        findCheck(body.presentationChecks, "Verification request is not expired")
          .passed
      ).to.equal(false);
    } finally {
      route.restore();
    }
  });

  it("rejects an already-used presentation challenge as replay", async function () {
    const verificationCase = await buildVerificationCase({
      requestOverrides: {
        used: true
      }
    });
    const route = installVerifyRoute({
      credentialRecord: verificationCase.credentialRecord,
      issuerRecord: verificationCase.credentialRecord.issuer,
      verificationRequest: verificationCase.verificationRequest
    });

    try {
      const { body } = await postJson(route.POST, {
        credentialJson: JSON.stringify(verificationCase.credential),
        presentationProofJson: JSON.stringify(verificationCase.presentationProof)
      });

      expect(body.result).to.equal("REJECTED");
      expect(
        findCheck(body.presentationChecks, "Verification request is unused").passed
      ).to.equal(false);
      expect(route.getPresentationProofs()).to.have.lengthOf(0);
    } finally {
      route.restore();
    }
  });
});
