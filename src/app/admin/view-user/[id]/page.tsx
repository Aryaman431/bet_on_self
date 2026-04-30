import AdminUserView from "./AdminUserView";
import clientPromise from "@/lib/mongodb";

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminPage({ params }: Props) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const userDoc = await db.collection("users").findOne({ email: decodeURIComponent(id.trim()) });

  if (!userDoc) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-lg text-muted-foreground leading-relaxed">Profile does not exist.</p>
          </div>
        </main>
      </div>
    )
  }

  const user = {
    email: userDoc.email,
    goals: userDoc.goals || []
  };

  return <AdminUserView user={user} />
}
