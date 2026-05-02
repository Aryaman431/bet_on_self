"use client"
import { Navbar } from "./navbar";
import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";
import type { WalletConnection } from "@/types";

export default function NavbarClient() {
  const { isLoggedIn, userEmail, logout } = useAuth();
  const [wallet, setWallet] = useState<WalletConnection | null>(null);

  useEffect(() => {
    const injected = window as Window & {
      aptos?: {
        account?: { address?: string };
        connect?: () => Promise<{ address?: string }>;
      };
    };

    const address = injected.aptos?.account?.address;
    if (address) {
      setWallet({ address, provider: 'unknown' });
    }
  }, []);

  const connectWallet = async () => {
    const injected = window as Window & {
      aptos?: {
        account?: { address?: string };
        connect?: () => Promise<{ address?: string }>;
      };
    };

    const connection = await injected.aptos?.connect?.();
    const address = connection?.address || injected.aptos?.account?.address || null;
    if (address) {
      setWallet({ address, provider: 'unknown' });
    }
  };

  return <Navbar isLoggedIn={isLoggedIn} userEmail={userEmail} onLogout={logout} walletAddress={wallet?.address || null} onConnectWallet={connectWallet} />;
}
