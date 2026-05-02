import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getAuthState, getUserGoals } from "@/lib/user-data"
import type { Goal } from "@/types"

interface Props {
  params: Promise<{ id: string }>
}

function formatUnits(value: number) {
  return `${value.toLocaleString()} units`
}

function statusLabel(goal: Goal) {
  if (goal.status === "resolved" || goal.status === "settled") {
    return goal.outcome === "success" ? "Goal completed" : "Goal missed"
  }
  return goal.status === "locked" ? "Escrow locked" : "Goal open"
}

export default async function ContentDetailPage({ params }: Props) {
  const resolvedParams = await params
  const isLoggedIn = await getAuthState()
  const goals = await getUserGoals()
  const goal = goals.find((entry) => entry.id === resolvedParams.id)

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-background">
        <section className="container mx-auto px-4 py-12 md:px-6 lg:px-8 space-y-4">
          <h1 className="text-3xl font-bold">Login required</h1>
          <p className="text-muted-foreground">Sign in to review your self-improvement goals and escrow state.</p>
          <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Login</Link>
        </section>
      </main>
    )
  }

  if (!goal) {
    return (
      <main className="min-h-screen bg-background">
        <section className="container mx-auto px-4 py-12 md:px-6 lg:px-8 space-y-4">
          <h1 className="text-3xl font-bold">Goal not found</h1>
          <p className="text-muted-foreground">The requested goal does not exist in your portfolio.</p>
          <Link href="/" className="inline-flex h-11 items-center justify-center rounded-md border px-5 text-sm font-medium transition-colors hover:bg-muted">Return home</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="container mx-auto px-4 py-12 md:px-6 lg:px-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to dashboard</Link>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground">{goal.title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{statusLabel(goal)} on Aptos escrow.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/bets">Open tracker</Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Metric</div>
                <div className="mt-1 text-lg font-semibold text-foreground">{goal.metric}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Deadline</div>
                <div className="mt-1 text-lg font-semibold text-foreground">{goal.deadline}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Target</div>
                <div className="mt-1 text-lg font-semibold text-foreground">{goal.targetValue}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Stake</div>
                <div className="mt-1 text-lg font-semibold text-foreground">{formatUnits(goal.stakeAmount)}</div>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="mb-3 text-sm font-medium text-muted-foreground">Progress</div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current progress</span>
                <span className="font-semibold text-foreground">{goal.progress}%</span>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">Odds and payout rules</h2>
              <div className="space-y-2">
                {goal.odds.map((odd) => (
                  <div key={odd.threshold} className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
                    <span className="font-medium">Threshold {odd.threshold}%+</span>
                    <span className="text-muted-foreground">{(odd.probability * 100).toFixed(1)}% probability</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
              <h2 className="text-xl font-semibold">Escrow snapshot</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Locked amount</span><span className="font-semibold">{formatUnits(goal.lockedAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Payout amount</span><span className="font-semibold">{formatUnits(goal.payoutAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Multiplier</span><span className="font-semibold">{goal.rewardMultiplierBps / 100}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Outcome</span><span className="font-semibold">{goal.outcome}</span></div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
              <h2 className="text-xl font-semibold">Settlement notes</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                Outcome resolution is submitted by the backend oracle after verifying the final value. The Move module enforces a single settlement path, blocks early withdrawal, and emits events for the lifecycle of this goal.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
