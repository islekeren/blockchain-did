export const blockchainConfig = {
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID ?? "",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "",
  issuerRegistryAddress: process.env.NEXT_PUBLIC_ISSUER_REGISTRY_ADDRESS ?? "",
  credentialRegistryAddress:
    process.env.NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS ?? ""
};

export function assertBlockchainReady() {
  throw new Error("Blockchain integration not implemented yet");
}
