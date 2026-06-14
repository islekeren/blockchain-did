"use client";

import { LogIn, LogOut, RefreshCw, Wallet } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import type { WalletConnection } from "@/hooks/useWallet";
import { LOCAL_HARDHAT_CHAIN_ID } from "@/lib/blockchain/provider";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type WalletConnectProps = {
  wallet: WalletConnection;
};

export function WalletConnect({ wallet }: WalletConnectProps) {
  const auth = useWalletAuth(wallet);
  const walletMismatch =
    Boolean(wallet.address && auth.user?.walletAddress) &&
    wallet.address !== auth.user?.walletAddress;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>MetaMask Wallet</CardTitle>
          <CardDescription>
            Browser writes use the connected wallet signer. Expected chain id is{" "}
            {LOCAL_HARDHAT_CHAIN_ID}.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={wallet.isConnected ? "outline" : "default"}
            onClick={() => void wallet.connect()}
            disabled={wallet.connecting}
          >
            <Wallet />
            {wallet.connecting
              ? "Connecting..."
              : wallet.isConnected
                ? "Reconnect"
                : "Connect MetaMask"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void wallet.refresh()}
          >
            <RefreshCw />
            Refresh
          </Button>
          {auth.isSignedIn ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void auth.signOut()}
            >
              <LogOut />
              Sign out
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void auth.signIn()}
              disabled={auth.signingIn || !wallet.hasMetaMask}
            >
              <LogIn />
              {auth.signingIn ? "Signing..." : "Sign in"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant={wallet.isConnected ? "success" : "neutral"}>
            {wallet.address ? shortAddress(wallet.address) : "Not connected"}
          </Badge>
          <Badge variant={wallet.isLocalHardhat ? "success" : "warning"}>
            Chain {wallet.chainId ?? "unknown"}
          </Badge>
          <Badge variant={auth.isSignedIn ? "success" : "neutral"}>
            {auth.user ? `${auth.user.role} session` : "Not signed in"}
          </Badge>
        </div>

        {!wallet.hasMetaMask ? (
          <Alert variant="warning">
            <AlertTitle>MetaMask not detected</AlertTitle>
            <AlertDescription>
              Install MetaMask or open this app in a browser where MetaMask is enabled.
            </AlertDescription>
          </Alert>
        ) : null}

        {wallet.hasMetaMask && wallet.chainId && !wallet.isLocalHardhat ? (
          <Alert variant="warning">
            <AlertTitle>Wrong network</AlertTitle>
            <AlertDescription>
              Switch MetaMask to the local Hardhat network with chain id{" "}
              {LOCAL_HARDHAT_CHAIN_ID}.
            </AlertDescription>
          </Alert>
        ) : null}

        {walletMismatch ? (
          <Alert variant="warning">
            <AlertTitle>Wallet session mismatch</AlertTitle>
            <AlertDescription>
              Connected wallet {wallet.address} differs from the signed-in session{" "}
              {auth.user?.walletAddress}. Sign out and sign in with the active wallet.
            </AlertDescription>
          </Alert>
        ) : null}

        {auth.error ? (
          <Alert variant="destructive">
            <AlertTitle>Sign-in error</AlertTitle>
            <AlertDescription>{auth.error}</AlertDescription>
          </Alert>
        ) : null}

        {wallet.error ? (
          <Alert variant="destructive">
            <AlertTitle>Wallet error</AlertTitle>
            <AlertDescription>{wallet.error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
