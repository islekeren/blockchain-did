"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useWallet, type WalletConnection } from "@/hooks/useWallet";

const WalletContext = createContext<WalletConnection | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();

  return (
    <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
  );
}

export function useWalletConnection() {
  const wallet = useContext(WalletContext);

  if (!wallet) {
    throw new Error("useWalletConnection must be used inside WalletProvider.");
  }

  return wallet;
}
