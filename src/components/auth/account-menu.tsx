"use client";

import {
  AlertTriangle,
  CheckCircle2,
  LogIn,
  LogOut,
  RefreshCw,
  UserRound,
  Wallet
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useWalletConnection } from "@/components/auth/wallet-provider";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import {
  buildRoleLoginPath,
  getRoleDestination
} from "@/lib/auth/navigation";
import type { UserRole } from "@/lib/auth/roles";
import { LOCAL_HARDHAT_CHAIN_ID } from "@/lib/blockchain/provider";

type AccountMenuProps = {
  role: UserRole;
  returnPath: string;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AccountMenu({ role, returnPath }: AccountMenuProps) {
  const wallet = useWalletConnection();
  const auth = useWalletAuth(wallet);
  const expectedDestination = getRoleDestination(role);
  const sessionDestination = auth.user
    ? getRoleDestination(auth.user.role)
    : expectedDestination;
  const walletMismatch =
    Boolean(wallet.address && auth.user?.walletAddress) &&
    wallet.address !== auth.user?.walletAddress;
  const ready = auth.isSignedIn && wallet.isConnected && wallet.isLocalHardhat;
  const hasWarning =
    !wallet.hasMetaMask ||
    Boolean(wallet.chainId && !wallet.isLocalHardhat) ||
    walletMismatch ||
    Boolean(auth.error || wallet.error);

  async function signOut() {
    await auth.signOut();
    window.location.replace(buildRoleLoginPath(role, returnPath));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 max-w-full justify-start px-3"
        >
          <UserRound />
          <span className="truncate">
            {auth.loading ? "Account" : sessionDestination.shortLabel}
          </span>
          {ready ? (
            <CheckCircle2 className="text-emerald-300" />
          ) : hasWarning ? (
            <AlertTriangle className="text-amber-300" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <div className="p-2">
          <p className="text-sm font-medium">{sessionDestination.label}</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {auth.user?.walletAddress ?? wallet.address ?? "No wallet selected"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 px-2 pb-2">
          <Badge variant={wallet.isConnected ? "success" : "neutral"}>
            {wallet.address ? shortAddress(wallet.address) : "Not connected"}
          </Badge>
          <Badge variant={wallet.isLocalHardhat ? "success" : "warning"}>
            Chain {wallet.chainId ?? "unknown"}
          </Badge>
          <Badge variant={auth.isSignedIn ? "success" : "neutral"}>
            {auth.user ? `${auth.user.role} session` : "No session"}
          </Badge>
        </div>

        {!wallet.hasMetaMask ? (
          <p className="px-2 pb-2 text-xs leading-5 text-amber-300">
            MetaMask is not available in this browser.
          </p>
        ) : null}

        {wallet.hasMetaMask && wallet.chainId && !wallet.isLocalHardhat ? (
          <p className="px-2 pb-2 text-xs leading-5 text-amber-300">
            Switch MetaMask to local Hardhat chain {LOCAL_HARDHAT_CHAIN_ID}.
          </p>
        ) : null}

        {walletMismatch ? (
          <p className="px-2 pb-2 text-xs leading-5 text-amber-300">
            Connected wallet and signed-in session do not match.
          </p>
        ) : null}

        {auth.error || wallet.error ? (
          <p className="px-2 pb-2 text-xs leading-5 text-destructive">
            {auth.error ?? wallet.error}
          </p>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2"
          disabled={!wallet.hasMetaMask || wallet.connecting}
          onSelect={(event) => {
            event.preventDefault();
            void wallet.connect();
          }}
        >
          <Wallet className="h-4 w-4" />
          {wallet.isConnected ? "Reconnect wallet" : "Connect wallet"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          onSelect={(event) => {
            event.preventDefault();
            void wallet.refresh();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh account
        </DropdownMenuItem>
        {auth.isSignedIn ? (
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onSelect={(event) => {
              event.preventDefault();
              void signOut();
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="gap-2"
            disabled={!wallet.hasMetaMask || auth.signingIn}
            onSelect={(event) => {
              event.preventDefault();
              void auth.signIn();
            }}
          >
            <LogIn className="h-4 w-4" />
            {auth.signingIn ? "Signing..." : "Sign in"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
