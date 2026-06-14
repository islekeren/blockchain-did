"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { WalletConnection } from "@/hooks/useWallet";
import { requestSigner, toBlockchainErrorMessage } from "@/lib/blockchain/provider";
import type { UserRecord } from "@/lib/types";

type SessionResponse = {
  user: UserRecord | null;
  error?: string;
};

type NonceResponse = {
  message?: string;
  error?: string;
};

export function useWalletAuth(wallet: WalletConnection) {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const data = (await response.json()) as SessionResponse;
      setUser(data.user ?? null);
      setError(data.error ?? null);
    } catch {
      setUser(null);
      setError("Unable to load wallet session.");
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async () => {
    setSigningIn(true);
    setError(null);

    try {
      const signer = await requestSigner();
      const walletAddress = await signer.getAddress();
      const nonceResponse = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress })
      });
      const nonceData = (await nonceResponse.json()) as NonceResponse;

      if (!nonceResponse.ok || !nonceData.message) {
        throw new Error(nonceData.error ?? "Unable to create sign-in nonce.");
      }

      const signature = await signer.signMessage(nonceData.message);
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          message: nonceData.message,
          signature
        })
      });
      const verifyData = (await verifyResponse.json()) as SessionResponse;

      if (!verifyResponse.ok || !verifyData.user) {
        throw new Error(verifyData.error ?? "Wallet sign-in failed.");
      }

      setUser(verifyData.user);
      window.dispatchEvent(new Event("wallet-auth-changed"));
      await wallet.refresh();
    } catch (caughtError) {
      setError(toBlockchainErrorMessage(caughtError));
    } finally {
      setSigningIn(false);
    }
  }, [wallet]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    setUser(null);
    window.dispatchEvent(new Event("wallet-auth-changed"));
  }, []);

  useEffect(() => {
    void loadSession();

    const handleAuthChanged = () => {
      void loadSession();
    };

    window.addEventListener("wallet-auth-changed", handleAuthChanged);

    return () => {
      window.removeEventListener("wallet-auth-changed", handleAuthChanged);
    };
  }, [loadSession]);

  return useMemo(
    () => ({
      user,
      loading,
      signingIn,
      error,
      isSignedIn: Boolean(user),
      signIn,
      signOut,
      refresh: loadSession
    }),
    [error, loadSession, loading, signIn, signOut, signingIn, user]
  );
}

export type WalletAuthState = ReturnType<typeof useWalletAuth>;
