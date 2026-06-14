-- AlterTable
ALTER TABLE "VerificationRequest" ADD COLUMN "nonce" TEXT;
ALTER TABLE "VerificationRequest" ADD COLUMN "challengeMessage" TEXT;
ALTER TABLE "VerificationRequest" ADD COLUMN "used" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VerificationRequest" ADD COLUMN "expiresAt" DATETIME;

-- CreateTable
CREATE TABLE "PresentationProof" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "credentialId" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "studentWalletAddress" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "verifierName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PresentationProof_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationRequest_nonce_key" ON "VerificationRequest"("nonce");

-- CreateIndex
CREATE INDEX "VerificationRequest_used_idx" ON "VerificationRequest"("used");

-- CreateIndex
CREATE INDEX "PresentationProof_credentialId_idx" ON "PresentationProof"("credentialId");

-- CreateIndex
CREATE INDEX "PresentationProof_requestId_idx" ON "PresentationProof"("requestId");
