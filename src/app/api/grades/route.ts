import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import jwt from "jsonwebtoken";
import clientPromise from "@/lib/mongodb";

async function getSub() {
  const hdrs = await headers();
  const devHeader = hdrs.get("x-dev-sub");
  if (process.env.NODE_ENV !== 'production' && devHeader) return devHeader;

  const cookieStore = await cookies();
  const idToken = cookieStore.get("id_token");
  if (!idToken?.value) return undefined;

  const decoded: any = jwt.decode(idToken.value);
  return decoded?.sub;
}

export async function GET() {
  try {
    const sub = await getSub();
    if (!sub) {
      return NextResponse.json({ progress: [], reason: "not_authenticated" }, { status: 200 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const users = db.collection("users");
    const user = await users.findOne({ sub });
    const goals = Array.isArray(user?.goals) ? user.goals : [];

    const progress = goals.map((goal: any) => ({
      id: goal.id,
      title: goal.title,
      metric: goal.metric,
      progress: typeof goal.progress === 'number' ? goal.progress : 0,
      outcome: goal.outcome || 'pending'
    }));

    return NextResponse.json({ progress, count: progress.length });
  } catch (error) {
    console.error("Error building goal progress payload:", error);
    return NextResponse.json({ progress: [], error: "internal_error" }, { status: 500 });
  }
}
