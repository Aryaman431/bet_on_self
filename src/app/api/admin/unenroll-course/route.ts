import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function POST(req: Request) {
  const body: { id: string; goalId: string } = await req.json();
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.id || !body.goalId) {
    return NextResponse.json({ error: "No id or goal id provided" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const coll = db.collection("users");

  const curr: any = await coll.findOne({ email: body.id });
  if (!curr) {
    return NextResponse.json({ error: "User DNE" }, { status: 400 });
  }

  const goals = Array.isArray(curr.goals) ? curr.goals : [];
  const filtered = goals.filter((goal: any) => goal.id !== body.goalId);
  await coll.replaceOne({ email: body.id }, { ...curr, goals: filtered });

  return NextResponse.json({ message: "Success" }, { status: 200 });
}