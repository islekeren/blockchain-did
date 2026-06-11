"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAddress } from "ethers";

import {
  getOptionalEthereumProvider,
  LOCAL_HARDHAT_CHAIN_ID,
  toBlockchainErrorMessage
} from "@/lib/blockchain/provider";

function chainIdFromHex(value: unknown) {
  return typeof value === "string" ? Number(BigInt(value)) : null;
}

export function useWallet() {
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const ethereum = getOptionalEthereumProvider();
    setHasMetaMask(Boolean(ethereum));

    if (!ethereum) {
      setAddress(null);
      setChainId(null);
      return;
    }

    try {
      const [accounts, chainIdHex] = await Promise.all([
        ethereum.request({ method: "eth_accounts" }) as Promise<string[]>,
        ethereum.request({ method: "eth_chainId" })
      ]);

      setAddress(accounts[0] ? getAddress(accounts[0]) : null);
      setChainId(chainIdFromHex(chainIdHex));
      setError(null);
    } catch (caughtError) {
      setError(toBlockchainErrorMessage(caughtError));
    }
  }, []);

  const connect = useCallback(async () => {
    const ethereum = getOptionalEthereumProvider();

    if (!ethereum) {
      setHasMetaMask(false);
      setError("MetaMask is not available in this browser.");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      await ethereum.request({ method: "eth_requestAccounts" });
      await refresh();
    } catch (caughtError) {
      setError(toBlockchainErrorMessage(caughtError));
    } finally {
      setConnecting(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();

    const ethereum = getOptionalEthereumProvider();

    if (!ethereum?.on) {
      return undefined;
    }

    const handleAccountsChanged = (accounts: unknown) => {
      const nextAccounts = Array.isArray(accounts) ? accounts : [];
      const nextAddress =
        typeof nextAccounts[0] === "string" ? getAddress(nextAccounts[0]) : null;
      setAddress(nextAddress);
    };

    const handleChainChanged = (nextChainId: unknown) => {
      setChainId(chainIdFromHex(nextChainId));
      void refresh();
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [refresh]);

  return useMemo(
    () => ({
      hasMetaMask,
      address,
      chainId,
      isConnected: Boolean(address),
      isLocalHardhat: chainId === LOCAL_HARDHAT_CHAIN_ID,
      connecting,
      error,
      connect,
      refresh
    }),
    [address, chainId, connect, connecting, error, hasMetaMask, refresh]
  );
}

export type WalletConnection = ReturnType<typeof useWallet>;
