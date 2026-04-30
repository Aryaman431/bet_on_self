export type GoalMetric = "grade" | "score" | "improvement" | "fitness" | "productivity" | "skill";
export type GoalStatus = "draft" | "open" | "locked" | "resolved" | "settled";
export type GoalOutcome = "pending" | "success" | "failure";

export interface GoalOdds {
  threshold: number;
  probability: number;
}

export interface Goal {
  id: string;
  title: string;
  metric: GoalMetric;
  targetValue: number;
  deadline: string;
  stakeAmount: number;
  rewardMultiplierBps: number;
  status: GoalStatus;
  outcome: GoalOutcome;
  progress: number;
  lockedAmount: number;
  payoutAmount: number;
  odds: GoalOdds[];
  walletAddress?: string;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
}

export interface RewardPool {
  id: string;
  title: string;
  amount: number;
  recipients: number;
  sponsor?: string;
  description?: string;
}

export interface WalletConnection {
  address: string;
  provider: "petra" | "martian" | "unknown";
}