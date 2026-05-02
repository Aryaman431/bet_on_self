import { NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import clientPromise from '@/lib/mongodb';

async function getSub() {
  const hdrs = await headers();
  const dev = hdrs.get('x-dev-sub');
  if (process.env.NODE_ENV !== 'production' && dev) return dev;

  const store = await cookies();
  const idToken = store.get('id_token');
  if (!idToken?.value) return undefined;

  const decoded: any = jwt.decode(idToken.value);
  return decoded?.sub;
}

export async function POST(req: Request) {
  try {
    const sub = await getSub();
    if (!sub) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const goalId = String(body.goalId || body.id || '').trim();
    const buckets = Array.isArray(body.buckets) ? body.buckets : [];

    if (!goalId || !buckets.length) {
      return NextResponse.json({ error: 'missing_fields', required: ['goalId', 'buckets'] }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const users = db.collection('users');
    const user = await users.findOne({ sub });

    if (!user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    const goals = Array.isArray(user.goals) ? user.goals : [];
    const updatedGoals = goals.map((goal: any) => goal.id === goalId ? { ...goal, odds: buckets } : goal);

    await users.updateOne({ sub }, { $set: { goals: updatedGoals } });
    return NextResponse.json({ success: true, goalId, updated: buckets.length });
  } catch (error) {
    console.error('POST /api/odds/update error', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
