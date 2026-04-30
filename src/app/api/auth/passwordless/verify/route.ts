import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "http://auth0.com/oauth/grant-type/passwordless/otp",
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      username: email,
      otp: code,
      realm: "email",
      scope: "openid profile email",
      audience: process.env.AUTH0_AUDIENCE,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: data }, { status: 400 });
  }
  // For demo: return tokens. In production, set a secure cookie/session here.
  // --- Begin MongoDB user upsert ---
  const { id_token } = data;
  if (id_token) {
    // Decode JWT to get the Auth0 user sub
    const decoded: any = jwt.decode(id_token);
    const sub = decoded?.sub;
    if (sub) {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB);
      const users = db.collection("users");
      await users.updateOne(
        { sub },
        { $setOnInsert: { sub, email: decoded.email, createdAt: new Date() } },
        { upsert: true }
      );
    }
  }
  // --- End MongoDB user upsert ---
  // Set id_token as a secure, httpOnly cookie
  const response = NextResponse.json({ ...data });
  if (id_token) {
    response.cookies.set("id_token", id_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }
  return response;
}
