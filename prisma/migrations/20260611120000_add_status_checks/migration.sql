PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "credentialId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'StudentCredential',
    "schemaName" TEXT NOT NULL DEFAULT 'StudentCredential',
    "credentialJson" TEXT NOT NULL,
    "credentialHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED' CHECK ("status" IN ('ISSUED', 'REVOKED', 'EXPIRED')),
    "issuedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
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

CREATE TABLE "new_VerificationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "credentialId" TEXT,
    "verifierName" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("result" IN ('APPROVED', 'REJECTED', 'PENDING')),
    "reasons" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_VerificationRequest" (
    "id",
    "credentialId",
    "verifierName",
    "result",
    "reasons",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "credentialId",
    "verifierName",
    "result",
    "reasons",
    "createdAt",
    "updatedAt"
FROM "VerificationRequest";

DROP TABLE "VerificationRequest";
ALTER TABLE "new_VerificationRequest" RENAME TO "VerificationRequest";

CREATE INDEX "VerificationRequest_credentialId_idx" ON "VerificationRequest"("credentialId");

PRAGMA foreign_keys=ON;
