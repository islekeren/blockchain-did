import { getAddress, verifyMessage } from "ethers";

export type WalletAuthMessageInput = {
  walletAddress: string;
  nonce: string;
  issuedAt: Date;
};

export function createWalletAuthMessage({
  walletAddress,
  nonce,
  issuedAt
}: WalletAuthMessageInput) {
  const normalizedAddress = getAddress(walletAddress);

  return [
    "Student Verification Wallet Sign-In",
    "",
    `Wallet: ${normalizedAddress}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    "",
    "Sign this message to create a demo session. This does not send a blockchain transaction."
  ].join("\n");
}

export function recoverWalletAuthSigner(message: string, signature: string) {
  return getAddress(verifyMessage(message, signature));
}
