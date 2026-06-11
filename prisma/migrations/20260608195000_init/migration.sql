-- CreateTable
CREATE TABLE "Issuer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "Issuer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "credentialId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'StudentCredential',
    "schemaName" TEXT NOT NULL DEFAULT 'StudentCredential',
    "credentialJson" TEXT NOT NULL,
    "credentialHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issuedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Credential_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Credential_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "Issuer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "credentialId" TEXT,
    "verifierName" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "reasons" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Issuer_did_key" ON "Issuer"("did");

-- CreateIndex
CREATE UNIQUE INDEX "Issuer_walletAddress_key" ON "Issuer"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentNo_key" ON "Student"("studentNo");

-- CreateIndex
CREATE UNIQUE INDEX "Student_walletAddress_key" ON "Student"("walletAddress");

-- CreateIndex
CREATE INDEX "Student_universityId_idx" ON "Student"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_credentialId_key" ON "Credential"("credentialId");

-- CreateIndex
CREATE INDEX "Credential_studentId_idx" ON "Credential"("studentId");

-- CreateIndex
CREATE INDEX "Credential_issuerId_idx" ON "Credential"("issuerId");

-- CreateIndex
CREATE INDEX "Credential_credentialId_idx" ON "Credential"("credentialId");

-- CreateIndex
CREATE INDEX "VerificationRequest_credentialId_idx" ON "VerificationRequest"("credentialId");
