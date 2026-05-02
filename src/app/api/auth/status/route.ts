import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function GET() {
  const cookieStore = await cookies();
  const idToken = cookieStore.get("id_token");
  const isLoggedIn = !!idToken;

  let userEmail = null;
  if (idToken?.value) {
    try {
      const decoded: any = jwt.decode(idToken.value);
      userEmail = decoded?.email || null;
    } catch (error) {
      console.error("Error decoding token:", error);
    }
  }

  return NextResponse.json({ isLoggedIn, userEmail });
}
