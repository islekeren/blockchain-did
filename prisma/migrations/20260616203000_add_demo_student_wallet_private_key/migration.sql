-- Demo-only storage for auto-generated student wallets.
-- Do not store student private keys in a production identity wallet system.
ALTER TABLE "Student" ADD COLUMN "walletPrivateKey" TEXT;
