import deployment from "./deployment.json";

const registryAddress =
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ||
  process.env.REGISTRY_CONTRACT_ADDRESS ||
  deployment.address;

export const blockchainConfig = {
  chainId: String(process.env.NEXT_PUBLIC_CHAIN_ID ?? deployment.chainId),
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545",
  issuerRegistryAddress: registryAddress,
  credentialRegistryAddress: registryAddress,
  contractName: deployment.contractName
};

export function assertBlockchainReady() {
  if (!registryAddress) {
    throw new Error(
      "Contract deployment is missing. Run npm run hardhat:deploy:local first."
    );
  }

  return blockchainConfig;
}
