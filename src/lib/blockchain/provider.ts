import {
  BrowserProvider,
  Contract,
  getAddress,
  type Eip1193Provider,
  type InterfaceAbi,
  type JsonRpcSigner
} from "ethers";

import registryAbi from "./StudentVerificationRegistry.abi.json";
import deployment from "./deployment.json";

export const LOCAL_HARDHAT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337
);

type EthereumProvider = Eip1193Provider & {
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void
  ) => void;
};

type RegistryDeployment = {
  network: string;
  chainId: number;
  contractName: "StudentVerificationRegistry";
  address: string;
  deployedAt: string;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function getOptionalEthereumProvider() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const ethereum = window.ethereum;

  if (!ethereum) {
    return undefined;
  }

  return ethereum.providers?.find((provider) => provider.isMetaMask) ?? ethereum;
}

export function getEthereumProvider() {
  const ethereum = getOptionalEthereumProvider();

  if (!ethereum) {
    throw new Error("MetaMask is not available in this browser.");
  }

  return ethereum;
}

export function getRegistryDeployment() {
  const registryDeployment = deployment as RegistryDeployment;
  const configuredAddress =
    process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || registryDeployment.address;

  if (!configuredAddress) {
    throw new Error(
      "Contract deployment is missing. Run npm run hardhat:deploy:local first."
    );
  }

  return {
    ...registryDeployment,
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? registryDeployment.chainId),
    address: getAddress(configuredAddress)
  };
}

export function createBrowserProvider() {
  return new BrowserProvider(getEthereumProvider());
}

export async function requestSigner(): Promise<JsonRpcSigner> {
  const provider = createBrowserProvider();
  await provider.send("eth_requestAccounts", []);
  await assertLocalHardhatNetwork(provider);

  return provider.getSigner();
}

export async function assertLocalHardhatNetwork(provider: BrowserProvider) {
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  if (chainId !== LOCAL_HARDHAT_CHAIN_ID) {
    throw new Error(
      `Wrong network. Switch MetaMask to local Hardhat chain ${LOCAL_HARDHAT_CHAIN_ID}.`
    );
  }
}

export async function getReadOnlyRegistryContract() {
  const provider = createBrowserProvider();
  await assertLocalHardhatNetwork(provider);

  return new Contract(
    getRegistryDeployment().address,
    registryAbi as InterfaceAbi,
    provider
  );
}

export async function getSignerRegistryContract() {
  const signer = await requestSigner();

  return new Contract(
    getRegistryDeployment().address,
    registryAbi as InterfaceAbi,
    signer
  );
}

function extractErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const value = error as {
    code?: string | number;
    reason?: string;
    shortMessage?: string;
    message?: string;
    info?: {
      error?: {
        message?: string;
      };
    };
  };

  return [
    value.reason,
    value.shortMessage,
    value.info?.error?.message,
    value.message,
    value.code ? String(value.code) : undefined
  ]
    .filter(Boolean)
    .join(" ");
}

export function toBlockchainErrorMessage(error: unknown) {
  const message = extractErrorMessage(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("user rejected") || normalized.includes("4001")) {
    return "Transaction was rejected in MetaMask.";
  }

  if (normalized.includes("metamask is not available")) {
    return "MetaMask is not available in this browser.";
  }

  if (normalized.includes("wrong network")) {
    return `Wrong network. Switch MetaMask to local Hardhat chain ${LOCAL_HARDHAT_CHAIN_ID}.`;
  }

  if (message.includes("OwnableUnauthorizedAccount")) {
    return "Connected wallet is not the contract owner.";
  }

  if (message.includes("caller is not trusted issuer")) {
    return "Connected wallet is not a trusted on-chain issuer.";
  }

  if (message.includes("caller is not credential issuer")) {
    return "Connected wallet is not the original credential issuer.";
  }

  if (message.includes("credential already registered")) {
    return "Credential hash is already registered on-chain.";
  }

  if (message.includes("credential not registered")) {
    return "Credential hash is not registered on-chain.";
  }

  if (message.includes("credential already revoked")) {
    return "Credential hash is already revoked on-chain.";
  }

  if (message.includes("issuer zero address")) {
    return "Issuer wallet address cannot be the zero address.";
  }

  if (message.includes("issuer DID empty")) {
    return "Issuer DID cannot be empty.";
  }

  if (message.includes("schema already registered")) {
    return "Schema is already registered on-chain.";
  }

  if (message.includes("schema hash zero")) {
    return "Schema hash cannot be zero.";
  }

  if (message.includes("schema name empty")) {
    return "Schema name cannot be empty.";
  }

  if (message.includes("credential hash zero")) {
    return "Credential hash cannot be zero.";
  }

  if (message.includes("could not decode result data")) {
    return "Contract was not found at the configured deployment address. Redeploy to the current local Hardhat node.";
  }

  return message || "Blockchain request failed.";
}
