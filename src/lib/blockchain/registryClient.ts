import { assertBlockchainReady } from "./config";

export type ChainWriteResult = {
  txHash: string;
};

export type AddIssuerOnChainInput = {
  issuerId: string;
  name: string;
  did: string;
  walletAddress: string;
};

export type RegisterSchemaOnChainInput = {
  name: string;
  version: string;
  uri?: string;
};

export type RegisterCredentialHashOnChainInput = {
  credentialId: string;
  credentialHash: string;
  issuerWalletAddress: string;
};

export type RevokeCredentialOnChainInput = {
  credentialId: string;
  credentialHash: string;
};

export type TrustedIssuerOnChainInput = {
  issuerWalletAddress: string;
};

export type CredentialRevocationOnChainInput = {
  credentialHash: string;
};

export async function addIssuerOnChain(
  _input: AddIssuerOnChainInput
): Promise<ChainWriteResult> {
  // TODO: Call issuer registry smart contract after Solidity contracts exist.
  void _input;
  assertBlockchainReady();
}

export async function registerSchemaOnChain(
  _input: RegisterSchemaOnChainInput
): Promise<ChainWriteResult> {
  // TODO: Persist schema metadata on-chain or in a schema registry contract.
  void _input;
  assertBlockchainReady();
}

export async function registerCredentialHashOnChain(
  _input: RegisterCredentialHashOnChainInput
): Promise<ChainWriteResult> {
  // TODO: Register deterministic credential hash on-chain.
  void _input;
  assertBlockchainReady();
}

export async function revokeCredentialOnChain(
  _input: RevokeCredentialOnChainInput
): Promise<ChainWriteResult> {
  // TODO: Call credential registry revoke function once contracts are added.
  void _input;
  assertBlockchainReady();
}

export async function isTrustedIssuerOnChain(
  _input: TrustedIssuerOnChainInput
): Promise<boolean> {
  // TODO: Read issuer trust status from the on-chain registry.
  void _input;
  assertBlockchainReady();
}

export async function isCredentialRevokedOnChain(
  _input: CredentialRevocationOnChainInput
): Promise<boolean> {
  // TODO: Read credential revocation status from the on-chain registry.
  void _input;
  assertBlockchainReady();
}
