import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import clientPromise from "@/lib/mongodb"
import type { Goal } from "@/types"
import { sampleGoals } from "@/sample-data"

export async function getUserGoals(): Promise<Goal[]> {
  try {
    const cookieStore = await cookies()
    const idToken = cookieStore.get("id_token")

    if (!idToken?.value) {
      return sampleGoals
    }

    const decoded: any = jwt.decode(idToken.value)
    const sub = decoded?.sub

    if (!sub) {
      return sampleGoals
    }

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB)
    const users = db.collection("users")

    const user = await users.findOne({ sub })
    return Array.isArray(user?.goals) && user.goals.length > 0 ? user.goals : sampleGoals
  } catch (error) {
    console.error("Error fetching user goals:", error)
    return sampleGoals
  }
}

export async function getAuthState() {
  const cookieStore = await cookies()
  const idToken = cookieStore.get("id_token")
  return !!idToken
}
