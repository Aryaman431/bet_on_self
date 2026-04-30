import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import clientPromise from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const idToken = cookieStore.get("id_token");

    if (!idToken?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded: any = jwt.decode(idToken.value);
    const sub = decoded?.sub;
    if (!sub) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const goalId = String(body.goalId || body.id || '').trim();
    const actualValue = Number(body.actualValue ?? body.grade ?? 0);

    if (!goalId || !Number.isFinite(actualValue)) {
      return NextResponse.json({ error: "Missing required fields: goalId, actualValue" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const users = db.collection("users");
    const user = await users.findOne({ sub });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const goals = Array.isArray(user.goals) ? user.goals : [];
    const updatedGoals = goals.map((goal: any) => {
      if (goal.id !== goalId) return goal;
      const success = actualValue >= Number(goal.targetValue || 0);
      const payoutAmount = success ? Math.floor(Number(goal.stakeAmount || 0) * Number(goal.rewardMultiplierBps || 15000) / 10000) : 0;
      return {
        ...goal,
        status: 'settled',
        outcome: success ? 'success' : 'failure',
        progress: Math.max(Number(goal.progress || 0), Math.min(100, actualValue)),
        payoutAmount,
        resolutionScore: actualValue,
        updatedAt: new Date().toISOString()
      };
    });

    await users.updateOne({ sub }, { $set: { goals: updatedGoals } });
    return NextResponse.json({ success: true, goalId, goals: updatedGoals });
  } catch (error) {
    console.error('Resolve goal endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
