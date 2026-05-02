import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function POST(req: Request) {
  const body: { id: string; goal: any } = await req.json();
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.id || !body.goal) {
    return NextResponse.json({ error: "No id or goal provided" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const coll = db.collection("users");

  const curr: any = await coll.findOne({ email: body.id });
  if (!curr) {
    return NextResponse.json({ error: "User DNE" }, { status: 400 });
  }

  const goals = Array.isArray(curr.goals) ? curr.goals : [];
  goals.push({ ...body.goal, id: body.goal.id || `goal_${Date.now()}` });
  await coll.replaceOne({ email: body.id }, { ...curr, goals });

  return NextResponse.json({ message: "Success" }, { status: 200 });
}