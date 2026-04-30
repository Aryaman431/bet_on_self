"use client";

import type { Goal } from '@/types';

interface BetsLiveTableProps {
  goals?: Goal[];
  passive?: boolean;
}

export default function BetsLiveTable({ goals = [] }: BetsLiveTableProps) {
  const orderedGoals = [...goals].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Goals</h2>
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="text-left">
              <th className="px-4 py-2">Goal</th>
              <th className="px-4 py-2">Metric</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Stake</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Outcome</th>
              <th className="px-4 py-2">Payout</th>
              <th className="px-4 py-2">Progress</th>
            </tr>
          </thead>
          <tbody>
            {orderedGoals.map((goal) => (
              <tr key={goal.id} className="border-t">
                <td className="px-4 py-2 font-medium">{goal.title}</td>
                <td className="px-4 py-2 uppercase tracking-wide text-xs text-muted-foreground">{goal.metric}</td>
                <td className="px-4 py-2">{goal.targetValue}</td>
                <td className="px-4 py-2">{goal.stakeAmount.toLocaleString()}</td>
                <td className="px-4 py-2">{goal.status}</td>
                <td className="px-4 py-2">{goal.outcome}</td>
                <td className="px-4 py-2 text-green-600">{goal.payoutAmount.toLocaleString()}</td>
                <td className="px-4 py-2 text-muted-foreground">{goal.progress}%</td>
              </tr>
            ))}
            {!orderedGoals.length && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">No goals yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
