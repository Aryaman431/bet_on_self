import type { Goal } from "./types"

export const sampleGoals: Goal[] = [
  {
    id: "goal-1",
    title: "Raise GPA to 3.7",
    metric: "grade",
    targetValue: 370,
    deadline: "2026-05-18",
    stakeAmount: 2500000,
    rewardMultiplierBps: 16500,
    status: "open",
    outcome: "pending",
    progress: 58,
    lockedAmount: 2500000,
    payoutAmount: 0,
    odds: [
      { threshold: 70, probability: 0.32 },
      { threshold: 80, probability: 0.18 },
      { threshold: 90, probability: 0.08 }
    ],
    notes: "Milestone-based reinforcement for exam season."
  },
  {
    id: "goal-2",
    title: "Finish a 30-day workout streak",
    metric: "fitness",
    targetValue: 30,
    deadline: "2026-05-28",
    stakeAmount: 1800000,
    rewardMultiplierBps: 15000,
    status: "locked",
    outcome: "pending",
    progress: 21,
    lockedAmount: 1800000,
    payoutAmount: 0,
    odds: [
      { threshold: 20, probability: 0.76 },
      { threshold: 30, probability: 0.44 },
      { threshold: 40, probability: 0.18 }
    ],
    notes: "Optional scholarship pool eligible if completed early."
  },
  {
    id: "goal-3",
    title: "Ship a portfolio project",
    metric: "skill",
    targetValue: 1,
    deadline: "2026-06-10",
    stakeAmount: 2200000,
    rewardMultiplierBps: 17500,
    status: "resolved",
    outcome: "success",
    progress: 100,
    lockedAmount: 2200000,
    payoutAmount: 3850000,
    odds: [
      { threshold: 1, probability: 0.61 }
    ],
    notes: "Resolved through verified backend submission."
  }
]