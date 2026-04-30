"use client";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import BetsLiveTable from './table-client';
import type { Goal } from '@/types';

function formatUnits(value: number) {
  return `${value.toLocaleString()} units`;
}

export default function BetsDashboardClient({ goals }: { goals: Goal[] }) {
  const activeGoals = goals.filter((goal) => goal.status === 'open' || goal.status === 'locked');
  const settledGoals = goals.filter((goal) => goal.status === 'resolved' || goal.status === 'settled');
  const successfulGoals = settledGoals.filter((goal) => goal.outcome === 'success');
  const totalLocked = goals.reduce((sum, goal) => sum + goal.lockedAmount, 0);
  const totalPayout = settledGoals.reduce((sum, goal) => sum + goal.payoutAmount, 0);
  const winRate = settledGoals.length ? `${Math.round((successfulGoals.length / settledGoals.length) * 100)}%` : '—';

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between"><span>Goal Summary</span><Link href="/" className="text-sm text-primary hover:underline">Home</Link></CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Locked capital</span><span className="font-semibold" data-testid="open-value">{formatUnits(totalLocked)}</span></div>
            <div className="flex justify-between"><span>Total goals</span><span className="font-semibold" data-testid="total-bets">{goals.length}</span></div>
            <div className="flex justify-between"><span>Active goals</span><span className="font-semibold" data-testid="open-bets">{activeGoals.length}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Reward recap</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Distributed rewards</span><span className="font-semibold" data-testid="realized-profit">{formatUnits(totalPayout)}</span></div>
            <div className="flex justify-between"><span>Settled goals</span><span className="font-semibold" data-testid="settled-bets">{settledGoals.length}</span></div>
            <div className="flex justify-between"><span>Win rate</span><span className="font-semibold" data-testid="win-rate">{winRate}</span></div>
          </CardContent>
        </Card>
        <div className="flex flex-col justify-between text-sm p-4 border rounded-md bg-muted/20">
          <div className="flex justify-between"><span className="font-medium">Funding model</span><span data-testid="last-refresh">On-chain escrow</span></div>
          <div className="flex justify-between"><span className="font-medium">Status</span><span data-testid="status">Live</span></div>
        </div>
      </div>
      <BetsLiveTable goals={goals} passive />
    </div>
  );
}
