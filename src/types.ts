// src/types.ts - Updated for Stellar
export interface Goal {
  id: string;
  creator: string; // Stellar address (GXXXXXX format)
  targetValue: number;
  deadline: number; // Unix timestamp
  stake: number; // In XLM stroops (1 XLM = 10^7 stroops)
  rewardMultiplier: number; // e.g., 150 = 1.5x
  status: 'active' | 'succeeded' | 'failed';
  outcomeValue?: number;
  settlementTimestamp?: number;
  metadata?: {
    category?: string;
    description?: string;
    tags?: string[];
  };
}

export interface UserPortfolio {
  address: string; // Stellar account address
  goals: string[]; // Goal IDs
  totalStaked: number; // In stroops
  totalEarned: number; // In stroops
}

export interface StellarWalletConnection {
  connected: boolean;
  publicKey: string; // Stellar public key (GXXXXXX)
  signer?: (transaction: any) => Promise<string>;
}

export interface RewardPool {
  totalBalance: number; // In stroops
  distributed: number; // In stroops
  failedGoalContributions: number; // In stroops
}

export interface OracleOutcome {
  goalId: string;
  creator: string;
  outcomeValue: number;
  succeeded: boolean;
  resolutionTimestamp: number;
  confirmedCount: number;
}

export interface TransactionResult {
  hash: string;
  status: 'pending' | 'success' | 'failure';
  timestamp: number;
}

export interface PlaceBetRequest {
  userAddress: string;
  targetValue: number;
  deadline: number;
  stake: number;
  rewardMultiplier: number;
  metadata?: Record<string, any>;
}

export interface ResolveBetRequest {
  goalId: string;
  creator: string;
  outcomeValue: number;
  succeeded: boolean;
}

// Stellar-specific types
export interface StellarAccount {
  id: string; // Public key
  sequence: string;
  accountMuxed?: string;
  homeDomain?: string;
  lastModifiedLedger: number;
  lastModifiedTime: string;
  balances: StellarBalance[];
  signers: Signer[];
  data: Record<string, string>;
  flags: {
    authRequired: boolean;
    authRevocable: boolean;
    authImmutable: boolean;
    clawbackEnabled: boolean;
  };
  thresholds: {
    lowThreshold: number;
    medThreshold: number;
    highThreshold: number;
  };
}

export interface StellarBalance {
  balance: string;
  limit?: string;
  buyingLiabilities?: string;
  sellingLiabilities?: string;
  assetType: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
  assetCode?: string;
  assetIssuer?: string;
}

export interface Signer {
  signer_key: string;
  weight: number;
  type: string;
}

// ML Prediction types
export interface PredictionResult {
  goalId: string;
  predictedSuccessProbability: number; // 0-1
  predictedValue: number;
  recommendedMultiplier: number;
  confidence: number; // 0-1
}

export interface Course {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: number;
  grades: Grade[];
}

export interface Grade {
  courseId: string;
  userId: string;
  grade: number;
  date: number;
  verified: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  roles: string[];
  createdAt: number;
  lastLogin?: number;
}
