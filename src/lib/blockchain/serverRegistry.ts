import { Contract, getAddress, isHexString, JsonRpcProvider, ZeroAddress } from "ethers";

import registryAbi from "./StudentVerificationRegistry.abi.json";
import deployment from "./deployment.json";
import { LOCAL_HARDHAT_CHAIN_ID, toBlockchainErrorMessage } from "./provider";

type RegistryDeployment = {
  chainId: number;
  address: string;
};

function getServerRpcUrl() {
  return (
    process.env.SERVER_RPC_URL ??
    process.env.RPC_URL ??
    process.env.NEXT_PUBLIC_RPC_URL ??
    "http://127.0.0.1:8545"
  );
}

function getRegistryAddress() {
  const registryDeployment = deployment as RegistryDeployment;
  const address =
    process.env.REGISTRY_CONTRACT_ADDRESS ??
    process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ??
    registryDeployment.address;

  if (!address) {
    throw new Error(
      "Registry contract address is missing. Deploy the contract and configure REGISTRY_CONTRACT_ADDRESS."
    );
  }

  return getAddress(address);
}

function normalizeAddress(address: string, label: string) {
  try {
    return getAddress(address.trim());
  } catch {
    throw new Error(`${label} must be a valid Ethereum address.`);
  }
}

function normalizeBytes32(value: string, label: string) {
  const trimmed = value.trim();

  if (!isHexString(trimmed, 32)) {
    throw new Error(`${label} must be a 0x-prefixed bytes32 value.`);
  }

  return trimmed;
}

export function getServerRegistryContract() {
  const provider = new JsonRpcProvider(
    getServerRpcUrl(),
    Number(process.env.SERVER_CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? LOCAL_HARDHAT_CHAIN_ID)
  );

  return new Contract(getRegistryAddress(), registryAbi, provider);
}

async function readContract<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    throw new Error(toBlockchainErrorMessage(error));
  }
}

export async function isTrustedIssuerOnChainServer(issuerAddress: string) {
  const normalizedIssuer = normalizeAddress(issuerAddress, "Issuer address");

  return readContract(async () => {
    const contract = getServerRegistryContract();
    return Boolean(await contract.isTrustedIssuer(normalizedIssuer));
  });
}

export async function isSchemaValidOnChainServer(schemaHash: string) {
  const normalizedSchemaHash = normalizeBytes32(schemaHash, "Schema hash");

  return readContract(async () => {
    const contract = getServerRegistryContract();
    return Boolean(await contract.isValidSchema(normalizedSchemaHash));
  });
}

export async function getSchemaNameOnChainServer(schemaHash: string) {
  const normalizedSchemaHash = normalizeBytes32(schemaHash, "Schema hash");

  return readContract(async () => {
    const contract = getServerRegistryContract();
    return String(await contract.getSchemaName(normalizedSchemaHash));
  });
}

export async function isCredentialRegisteredOnChainServer(credentialHash: string) {
  const normalizedCredentialHash = normalizeBytes32(
    credentialHash,
    "Credential hash"
  );

  return readContract(async () => {
    const contract = getServerRegistryContract();
    return Boolean(await contract.isRegisteredCredential(normalizedCredentialHash));
  });
}

export async function getCredentialIssuerOnChainServer(credentialHash: string) {
  const normalizedCredentialHash = normalizeBytes32(
    credentialHash,
    "Credential hash"
  );

  return readContract(async () => {
    const contract = getServerRegistryContract();
    const issuer = String(await contract.getCredentialIssuer(normalizedCredentialHash));

    return issuer === ZeroAddress ? ZeroAddress : getAddress(issuer);
  });
}

export async function isCredentialRevokedOnChainServer(credentialHash: string) {
  const normalizedCredentialHash = normalizeBytes32(
    credentialHash,
    "Credential hash"
  );

  return readContract(async () => {
    const contract = getServerRegistryContract();
    return Boolean(await contract.isRevoked(normalizedCredentialHash));
  });
}
