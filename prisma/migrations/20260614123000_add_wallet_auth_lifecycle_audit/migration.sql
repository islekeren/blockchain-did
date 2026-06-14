PRAGMA foreign_keys=OFF;

CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "role" TEXT NOT NULL CHECK ("role" IN ('ADMIN', 'ISSUER', 'STUDENT', 'VERIFIER')),
    "issuerId" TEXT,
    "studentId" TEXT,
    "verifierName" TEXT,
    "nonce" TEXT,
    "nonceExpiresAt" DATETIME,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "Issuer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_issuerId_idx" ON "User"("issuerId");
CREATE INDEX "User_studentId_idx" ON "User"("studentId");

CREATE TABLE "new_Credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "credentialId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'StudentCredential',
    "schemaName" TEXT NOT NULL DEFAULT 'StudentCredential',
    "credentialJson" TEXT NOT NULL,
    "credentialHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_ONCHAIN' CHECK ("status" IN ('PENDING_ONCHAIN', 'ISSUED', 'REVOKED', 'EXPIRED', 'FAILED')),
    "issuedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "registeredAt" DATETIME,
    "registeredTxHash" TEXT,
    "revokedAt" DATETIME,
    "revocationTxHash" TEXT,
    "revocationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Credential_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Credential_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "Issuer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Credential" (
    "id",
    "credentialId",
    "studentId",
    "issuerId",
    "type",
    "schemaName",
    "credentialJson",
    "credentialHash",
    "status",
    "issuedAt",
    "expiresAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "credentialId",
    "studentId",
    "issuerId",
    "type",
    "schemaName",
    "credentialJson",
    "credentialHash",
    "status",
    "issuedAt",
    "expiresAt",
    "createdAt",
    "updatedAt"
FROM "Credential";

DROP TABLE "Credential";
ALTER TABLE "new_Credential" RENAME TO "Credential";

CREATE UNIQUE INDEX "Credential_credentialId_key" ON "Credential"("credentialId");
CREATE INDEX "Credential_studentId_idx" ON "Credential"("studentId");
CREATE INDEX "Credential_issuerId_idx" ON "Credential"("issuerId");
CREATE INDEX "Credential_credentialId_idx" ON "Credential"("credentialId");

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "actorWallet" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "txHash" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

PRAGMA foreign_keys=ON;
