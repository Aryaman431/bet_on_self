import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import clientPromise from "@/lib/mongodb"
import { NextResponse, NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const idToken = cookieStore.get("id_token")

    if (!idToken?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decoded: any = jwt.decode(idToken.value)
    const userId = decoded?.sub

    if (!userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { goalId, title, metric, targetValue, stakeAmount, walletAddress, odds = [] } = await request.json()

    if (!goalId && !title) {
      return NextResponse.json({ error: "Missing required fields: goalId or title" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB)
    const users = db.collection("users")
    const user = await users.findOne({ sub: userId })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const goal = {
      id: goalId || `goal_${Date.now()}`,
      title: title || "Untitled goal",
      metric: metric || "grade",
      targetValue: Number(targetValue || 0),
      deadline: String(new Date().toISOString()),
      stakeAmount: Number(stakeAmount || 0),
      rewardMultiplierBps: 15000,
      status: "locked",
      outcome: "pending",
      progress: 0,
      lockedAmount: Number(stakeAmount || 0),
      payoutAmount: 0,
      odds,
      walletAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const existingGoals = Array.isArray(user.goals) ? user.goals : []
    const nextGoals = existingGoals.some((entry: any) => entry.id === goal.id)
      ? existingGoals.map((entry: any) => entry.id === goal.id ? { ...entry, ...goal } : entry)
      : [...existingGoals, goal]

    await users.updateOne({ sub: userId }, { $set: { goals: nextGoals } }, { upsert: true })

    return NextResponse.json({ success: true, goal })
  } catch (error) {
    console.error("Place goal stake API error:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
