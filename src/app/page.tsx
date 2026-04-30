import Link from "next/link"
import { getUserGoals, getAuthState } from "@/lib/user-data"
import { ContentCard } from "@/components/content-card"
import { sampleGoals } from "@/sample-data"

export default async function HomePage() {
  const isLoggedIn = await getAuthState()
  const goals = isLoggedIn ? await getUserGoals() : sampleGoals

  const openGoals = goals.filter((goal) => goal.status === "open" || goal.status === "locked")
  const resolvedGoals = goals.filter((goal) => goal.status === "resolved" || goal.status === "settled")

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-background">
        <section className="container mx-auto px-4 py-16 md:px-6 lg:px-8">
          <div className="max-w-4xl space-y-8">
            <span className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium text-muted-foreground">Aptos-native accountability</span>
            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">Lock a goal, stake on yourself, and resolve it trustlessly.</h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">bet_on_self helps people commit to measurable goals with on-chain escrow, verified outcomes, and off-chain ML odds. Start with grades today and extend the same flow to fitness, productivity, or skill building later.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Login to create goals</Link>
              <Link href="/bets" className="inline-flex h-11 items-center justify-center rounded-md border px-5 text-sm font-medium transition-colors hover:bg-muted">View the dashboard</Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="container mx-auto px-4 py-12 md:px-6 lg:px-8 space-y-10">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
          <div className="space-y-4">
            <span className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium text-muted-foreground">Self-improvement dashboard</span>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">Your goals, stakes, and outcomes in one place.</h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">Create a goal, lock funds into escrow, and let the oracle layer resolve it with an audit trail. ML stays off-chain, funds stay on-chain, and payouts are deterministic.</p>
          </div>
          <div className="grid gap-3 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Open goals</span><span className="font-semibold">{openGoals.length}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Resolved goals</span><span className="font-semibold">{resolvedGoals.length}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Locked capital</span><span className="font-semibold">{goals.reduce((sum, goal) => sum + goal.lockedAmount, 0).toLocaleString()}</span></div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {openGoals.map((goal) => (
            <ContentCard
              key={goal.id}
              id={goal.id}
              title={goal.title}
              metric={goal.metric}
              deadline={goal.deadline}
              stakeAmount={goal.stakeAmount}
              odds={goal.odds}
              progress={goal.progress}
              status={goal.status}
            />
          ))}
        </div>
      </section>
    </main>
  )
}
