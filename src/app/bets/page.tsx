import { getAuthState, getUserGoals } from "@/lib/user-data"
import BetsDashboardClient from './dashboard-client';
import { sampleGoals } from "@/sample-data";

export default async function BetsDashboardPage() {
  const loggedIn = await getAuthState();
  const goals = loggedIn ? await getUserGoals() : sampleGoals;
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
          <h1 className="text-3xl font-bold mb-4">Goals</h1>
          <p className="text-muted-foreground">Please log in to view your goals.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8 space-y-8">
        <BetsDashboardClient goals={goals} />
      </main>
    </div>
  );
}

// Client dashboard handles dynamic data.

