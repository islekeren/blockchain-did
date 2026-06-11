import deployment from "./deployment.json";

export const blockchainConfig = {
  chainId: String(deployment.chainId),
  rpcUrl: "http://127.0.0.1:8545",
  issuerRegistryAddress: deployment.address,
  credentialRegistryAddress: deployment.address,
  contractName: deployment.contractName
};

export function assertBlockchainReady() {
  if (!deployment.address) {
    throw new Error(
      "Contract deployment is missing. Run npm run hardhat:deploy:local first."
    );
  }

  return blockchainConfig;
}
