import { getAddress, isHexString, ZeroAddress } from "ethers";

import {
  getReadOnlyRegistryContract,
  getSignerRegistryContract,
  toBlockchainErrorMessage
} from "./provider";

export type ChainWriteResult = {
  txHash: string;
};

type IssuerAddressInput = {
  issuerAddress: string;
};

type SchemaHashInput = {
  schemaHash: string;
};

type CredentialHashInput = {
  credentialHash: string;
};

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

async function sendTransaction(action: () => Promise<{ hash: string; wait: () => Promise<unknown> }>) {
  try {
    const tx = await action();
    await tx.wait();

    return { txHash: tx.hash };
  } catch (error) {
    throw new Error(toBlockchainErrorMessage(error));
  }
}

async function readContract<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    throw new Error(toBlockchainErrorMessage(error));
  }
}

export async function isTrustedIssuerOnChain(input: IssuerAddressInput) {
  const issuerAddress = normalizeAddress(input.issuerAddress, "Issuer address");

  return readContract(async () => {
    const contract = await getReadOnlyRegistryContract();
    return Boolean(await contract.isTrustedIssuer(issuerAddress));
  });
}

export async function getIssuerDidOnChain(input: IssuerAddressInput) {
  const issuerAddress = normalizeAddress(input.issuerAddress, "Issuer address");

  return readContract(async () => {
    const contract = await getReadOnlyRegistryContract();
    return String(await contract.getIssuerDid(issuerAddress));
  });
}

export async function isSchemaValidOnChain(input: SchemaHashInput) {
  const schemaHash = normalizeBytes32(input.schemaHash, "Schema hash");

  return readContract(async () => {
    const contract = await getReadOnlyRegistryContract();
    return Boolean(await contract.isValidSchema(schemaHash));
  });
}

export async function getSchemaNameOnChain(input: SchemaHashInput) {
  const schemaHash = normalizeBytes32(input.schemaHash, "Schema hash");

  return readContract(async () => {
    const contract = await getReadOnlyRegistryContract();
    return String(await contract.getSchemaName(schemaHash));
  });
}

export async function isCredentialRegisteredOnChain(input: CredentialHashInput) {
  const credentialHash = normalizeBytes32(
    input.credentialHash,
    "Credential hash"
  );

  return readContract(async () => {
    const contract = await getReadOnlyRegistryContract();
    return Boolean(await contract.isRegisteredCredential(credentialHash));
  });
}

export async function getCredentialIssuerOnChain(input: CredentialHashInput) {
  const credentialHash = normalizeBytes32(
    input.credentialHash,
    "Credential hash"
  );

  return readContract(async () => {
    const contract = await getReadOnlyRegistryContract();
    const issuer = String(await contract.getCredentialIssuer(credentialHash));

    return issuer === ZeroAddress ? ZeroAddress : getAddress(issuer);
  });
}

export async function isCredentialRevokedOnChain(input: CredentialHashInput) {
  const credentialHash = normalizeBytes32(
    input.credentialHash,
    "Credential hash"
  );

  return readContract(async () => {
    const contract = await getReadOnlyRegistryContract();
    return Boolean(await contract.isRevoked(credentialHash));
  });
}

export async function registerIssuerOnChain(input: {
  issuerAddress: string;
  issuerDid: string;
}): Promise<ChainWriteResult> {
  const issuerAddress = normalizeAddress(input.issuerAddress, "Issuer address");
  const issuerDid = input.issuerDid.trim();

  if (!issuerDid) {
    throw new Error("Issuer DID cannot be empty.");
  }

  return sendTransaction(async () => {
    const contract = await getSignerRegistryContract();
    return contract.addIssuer(issuerAddress, issuerDid);
  });
}

export async function removeIssuerOnChain(input: IssuerAddressInput) {
  const issuerAddress = normalizeAddress(input.issuerAddress, "Issuer address");

  return sendTransaction(async () => {
    const contract = await getSignerRegistryContract();
    return contract.removeIssuer(issuerAddress);
  });
}

export async function registerSchemaOnChain(input: {
  schemaHash: string;
  schemaName: string;
}): Promise<ChainWriteResult> {
  const schemaHash = normalizeBytes32(input.schemaHash, "Schema hash");
  const schemaName = input.schemaName.trim();

  if (!schemaName) {
    throw new Error("Schema name cannot be empty.");
  }

  return sendTransaction(async () => {
    const contract = await getSignerRegistryContract();
    return contract.registerSchema(schemaHash, schemaName);
  });
}

export async function registerCredentialHashOnChain(input: CredentialHashInput) {
  const credentialHash = normalizeBytes32(
    input.credentialHash,
    "Credential hash"
  );

  return sendTransaction(async () => {
    const contract = await getSignerRegistryContract();
    return contract.registerCredential(credentialHash);
  });
}

export async function revokeCredentialOnChain(input: CredentialHashInput) {
  const credentialHash = normalizeBytes32(
    input.credentialHash,
    "Credential hash"
  );

  return sendTransaction(async () => {
    const contract = await getSignerRegistryContract();
    return contract.revokeCredential(credentialHash);
  });
}

export const addIssuerOnChain = registerIssuerOnChain;
