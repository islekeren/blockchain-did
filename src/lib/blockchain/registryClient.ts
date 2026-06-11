import { assertBlockchainReady } from "./config";

export async function addIssuerOnChain() {
  // TODO: Call issuer registry smart contract after Solidity contracts exist.
  assertBlockchainReady();
}

export async function registerSchemaOnChain() {
  // TODO: Persist schema metadata on-chain or in a schema registry contract.
  assertBlockchainReady();
}

export async function registerCredentialHashOnChain() {
  // TODO: Register deterministic credential hash on-chain.
  assertBlockchainReady();
}

export async function revokeCredentialOnChain() {
  // TODO: Call credential registry revoke function once contracts are added.
  assertBlockchainReady();
}

export async function isTrustedIssuerOnChain() {
  // TODO: Read issuer trust status from the on-chain registry.
  assertBlockchainReady();
}

export async function isCredentialRevokedOnChain() {
  // TODO: Read credential revocation status from the on-chain registry.
  assertBlockchainReady();
}
