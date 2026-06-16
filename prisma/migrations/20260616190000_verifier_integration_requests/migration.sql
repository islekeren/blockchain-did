-- AlterTable
ALTER TABLE "VerificationRequest" ADD COLUMN "callbackUrl" TEXT;
ALTER TABLE "VerificationRequest" ADD COLUMN "requestedCredentialType" TEXT NOT NULL DEFAULT 'StudentCredential';
ALTER TABLE "VerificationRequest" ADD COLUMN "checkResults" TEXT;
ALTER TABLE "VerificationRequest" ADD COLUMN "verifiedAt" DATETIME;

-- CreateIndex
CREATE INDEX "VerificationRequest_result_idx" ON "VerificationRequest"("result");

-- CreateIndex
CREATE INDEX "VerificationRequest_createdAt_idx" ON "VerificationRequest"("createdAt");
