import { cookies, headers } from "next/headers"
import jwt from "jsonwebtoken"
import clientPromise from "@/lib/mongodb"
import { NextResponse } from "next/server"

async function getSub() {
  const hdrs = await headers()
  const devHeader = hdrs.get("x-dev-sub")
  const isProd = process.env.NODE_ENV === "production"

  if (!isProd && devHeader) {
    return devHeader
  }

  const cookieStore = await cookies()
  const idToken = cookieStore.get("id_token")
  if (!idToken?.value) return undefined

  const decoded: any = jwt.decode(idToken.value)
  return decoded?.sub
}

export async function GET() {
  try {
    const sub = await getSub()
    if (!sub) {
      return NextResponse.json({ goals: [] }, { headers: { "Cache-Control": "no-store" } })
    }

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB)
    const users = db.collection("users")
    const user = await users.findOne({ sub })

    return NextResponse.json({ goals: Array.isArray(user?.goals) ? user.goals : [] }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Error fetching user goals:", error)
    return NextResponse.json({ goals: [] }, { headers: { "Cache-Control": "no-store" } })
  }
}
