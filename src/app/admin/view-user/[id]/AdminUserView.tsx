"use client";

interface Goal {
  id: string;
  title: string;
  metric: string;
  targetValue: number;
  progress: number;
  status: string;
  outcome?: string;
  payoutAmount?: number;
}

interface User {
  email: string;
  goals: Goal[];
}

interface Props {
  user: User;
}

export default function AdminUserView({ user }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 leading-tight">{user.email}</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">Goal portfolio.</p>
        </div>
        <div className="space-y-4">
          {user.goals.map((goal) => (
            <div key={goal.id} className="block max-w-md p-6 bg-white rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">{goal.title}</h2>
              <dl className="space-y-2 text-gray-700">
                <div className="flex justify-between items-center"><dt className="font-medium">Metric:</dt><dd className="font-semibold text-blue-600">{goal.metric}</dd></div>
                <div className="flex justify-between items-center"><dt className="font-medium">Target:</dt><dd className="font-semibold text-blue-600">{goal.targetValue}</dd></div>
                <div className="flex justify-between items-center"><dt className="font-medium">Progress:</dt><dd className="font-semibold text-blue-600">{goal.progress}%</dd></div>
                <div className="flex justify-between items-center"><dt className="font-medium">Status:</dt><dd className="font-semibold text-blue-600">{goal.status}</dd></div>
                <div className="flex justify-between items-center"><dt className="font-medium">Outcome:</dt><dd className="font-semibold text-blue-600">{goal.outcome || 'pending'}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
