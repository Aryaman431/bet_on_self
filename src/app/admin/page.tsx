import clientPromise from "@/lib/mongodb";

export default async function AdminPage() {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const users = await db.collection("users").find({}).toArray();

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 leading-tight">Admin</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">Goal portfolios and reward pools.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {users.map((user: any) => (
            <a
              key={user._id}
              href={`/admin/view-user/${user.email}`}
              className="block max-w-md mx-auto w-full p-6 bg-white rounded-2xl shadow-md border border-gray-200 hover:shadow-lg hover:bg-gray-50 transition cursor-pointer"
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-2">{user.email}</h2>
              <p className="text-sm text-gray-600">{Array.isArray(user.goals) ? user.goals.length : 0} goals</p>
            </a>
          ))}
        </div>
      </main>
    </div>
  )
}
