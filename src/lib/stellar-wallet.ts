// src/lib/stellar-wallet.ts
import * as StellarSdk from 'stellar-sdk';

// Freighter wallet integration
export interface FreighterWallet {
  connect: () => Promise<string>;
  getPublicKey: () => Promise<string>;
  sign: (transaction: string) => Promise<{ signedXDR: string }>;
  isConnected: () => Promise<boolean>;
}

declare global {
  interface Window {
    freighter?: {
      connect: () => Promise<void>;
      getPublicKey: () => Promise<string>;
      isConnected: () => Promise<boolean>;
      signTransaction: (xdr: string, opts?: any) => Promise<string>;
      signAuthEntry: (xdr: string) => Promise<string>;
    };
  }
}

export class StellarWalletManager {
  private publicKey: string | null = null;
  private networkPassphrase = StellarSdk.Networks.TESTNET_NETWORK_PASSPHRASE;

  async connectWallet(): Promise<string> {
    if (!window.freighter) {
      throw new Error('Freighter wallet not installed');
    }

    try {
      await window.freighter.connect();
      const publicKey = await window.freighter.getPublicKey();
      this.publicKey = publicKey;
      return publicKey;
    } catch (error) {
      throw new Error(`Failed to connect Freighter wallet: ${error}`);
    }
  }

  async isWalletConnected(): Promise<boolean> {
    if (!window.freighter) {
      return false;
    }
    try {
      return await window.freighter.isConnected();
    } catch {
      return false;
    }
  }

  getPublicKey(): string | null {
    return this.publicKey;
  }

  async signTransaction(transaction: StellarSdk.Transaction): Promise<StellarSdk.Transaction> {
    if (!window.freighter) {
      throw new Error('Freighter wallet not installed');
    }

    if (!this.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      const xdr = transaction.toEnvelope().toXDR('base64');
      const signedXdr = await window.freighter.signTransaction(xdr, {
        network: this.networkPassphrase,
      });

      return StellarSdk.TransactionBuilder.fromXDR(
        signedXdr,
        this.networkPassphrase
      );
    } catch (error) {
      throw new Error(`Failed to sign transaction: ${error}`);
    }
  }

  async signAuthEntry(authEntry: string): Promise<string> {
    if (!window.freighter) {
      throw new Error('Freighter wallet not installed');
    }

    try {
      return await window.freighter.signAuthEntry(authEntry);
    } catch (error) {
      throw new Error(`Failed to sign auth entry: ${error}`);
    }
  }

  validateAddress(address: string): boolean {
    return StellarSdk.StrKey.isValidEd25519PublicKey(address);
  }
}

export default new StellarWalletManager();
