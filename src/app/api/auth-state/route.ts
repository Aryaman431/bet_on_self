import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const idToken = cookieStore.get("id_token")
    return NextResponse.json({ isLoggedIn: !!idToken })
  } catch (error) {
    console.error("Error checking auth state:", error)
    return NextResponse.json({ isLoggedIn: false })
  }
}
