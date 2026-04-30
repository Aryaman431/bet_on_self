import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/passwordless/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      connection: "email",
      email,
      send: "code", // or "link" for magic link
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Auth0 error:", data);
    return NextResponse.json({ error: data }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
