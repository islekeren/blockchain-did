export const blockchainConfig = {
  chainId: process.env.CHAIN_ID ?? "",
  rpcUrl: process.env.RPC_URL ?? "",
  issuerRegistryAddress: process.env.ISSUER_REGISTRY_ADDRESS ?? "",
  credentialRegistryAddress: process.env.CREDENTIAL_REGISTRY_ADDRESS ?? ""
};

export function assertBlockchainReady(): never {
  throw new Error("Blockchain integration not implemented yet");
}
