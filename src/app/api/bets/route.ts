import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import jwt from 'jsonwebtoken';
import clientPromise from '@/lib/mongodb';

async function getSub() {
  const hdrs = await headers();
  const devHeader = hdrs.get('x-dev-sub');
  if (process.env.NODE_ENV !== 'production' && devHeader) return devHeader;

  const cookieStore = await cookies();
  const idToken = cookieStore.get('id_token');
  if (!idToken?.value) return undefined;

  const decoded: any = jwt.decode(idToken.value);
  return decoded?.sub;
}

export async function GET() {
  try {
    const sub = await getSub();
    if (!sub) return NextResponse.json({ goals: [] });

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const users = db.collection('users');
    const user = await users.findOne({ sub });
    const goals = Array.isArray(user?.goals) ? user.goals : [];

    return NextResponse.json({ goals });
  } catch (error) {
    console.error('GET /api/bets error', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
