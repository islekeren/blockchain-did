import { getAddress } from "ethers";

export function normalizeWalletAddress(address: string) {
  return getAddress(address.trim());
}

export function didForWalletAddress(address: string) {
  return `did:ethr:${normalizeWalletAddress(address)}`;
}

export function normalizeEthrDid(did: string, expectedWalletAddress?: string) {
  const trimmed = did.trim();
  const match = /^did:ethr:(0x[a-fA-F0-9]{40})$/.exec(trimmed);

  if (!match) {
    throw new Error("Use a did:ethr:0x... DID");
  }

  const didAddress = normalizeWalletAddress(match[1]);
  const expectedAddress = expectedWalletAddress
    ? normalizeWalletAddress(expectedWalletAddress)
    : undefined;

  if (expectedAddress && didAddress !== expectedAddress) {
    throw new Error("Issuer DID address must match issuer wallet address");
  }

  return `did:ethr:${didAddress}`;
}
