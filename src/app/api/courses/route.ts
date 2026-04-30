import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import jwt from 'jsonwebtoken';
import clientPromise from '@/lib/mongodb';

async function getSub() {
  const hdrs = await headers();
  const devHeader = hdrs.get('x-dev-sub');
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd && devHeader) return devHeader;

  const cookieStore = await cookies();
  const idToken = cookieStore.get('id_token');
  if (!idToken?.value) return undefined;

  const decoded: any = jwt.decode(idToken.value);
  return decoded?.sub;
}

async function getUsers() {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  return db.collection('users');
}

export async function GET() {
  try {
    const sub = await getSub();
    if (!sub) return NextResponse.json({ goals: [] });
    const users = await getUsers();
    const user = await users.findOne({ sub });
    return NextResponse.json({ goals: Array.isArray(user?.goals) ? user.goals : [] });
  } catch (error) {
    console.error('GET /api/courses error', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sub = await getSub();
    if (!sub) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = String(body.title || '').trim();
    const metric = String(body.metric || 'grade').trim();
    const targetValue = Number.parseInt(String(body.targetValue || 0), 10);
    const stakeAmount = Number.parseInt(String(body.stakeAmount || 0), 10);

    if (!title || !targetValue || !stakeAmount) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const goal = {
      id: body.id || `goal_${Date.now()}`,
      title,
      metric,
      targetValue,
      deadline: String(body.deadline || new Date().toISOString()),
      stakeAmount,
      rewardMultiplierBps: Number.parseInt(String(body.rewardMultiplierBps || 15000), 10),
      status: body.status || 'open',
      outcome: body.outcome || 'pending',
      progress: Number.parseInt(String(body.progress || 0), 10),
      lockedAmount: Number.parseInt(String(body.lockedAmount || stakeAmount), 10),
      payoutAmount: Number.parseInt(String(body.payoutAmount || 0), 10),
      odds: Array.isArray(body.odds) ? body.odds : [],
      walletAddress: body.walletAddress,
      notes: body.notes || ''
    };

    const users = await getUsers();
    const user = await users.findOne({ sub });
    const goals = Array.isArray(user?.goals) ? user.goals : [];
    const updatedGoals = [...goals, goal];
    await users.updateOne({ sub }, { $set: { goals: updatedGoals } }, { upsert: true });
    return NextResponse.json({ goals: updatedGoals, added: goal.id });
  } catch (error) {
    console.error('POST /api/courses error', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const sub = await getSub();
    if (!sub) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const goalId = String(body.id || body.goalId || '').trim();
    if (!goalId) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

    const users = await getUsers();
    const user = await users.findOne({ sub });
    const goals = Array.isArray(user?.goals) ? user.goals : [];
    const updatedGoals = goals.map((goal: any) => goal.id === goalId ? { ...goal, ...body, id: goalId } : goal);

    await users.updateOne({ sub }, { $set: { goals: updatedGoals } });
    return NextResponse.json({ goals: updatedGoals, updated: goalId });
  } catch (error) {
    console.error('PATCH /api/courses error', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const sub = await getSub();
    if (!sub) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const goalId = String(body.id || body.goalId || new URL(req.url).searchParams.get('id') || '').trim();
    if (!goalId) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

    const users = await getUsers();
    const user = await users.findOne({ sub });
    const goals = Array.isArray(user?.goals) ? user.goals : [];
    const updatedGoals = goals.filter((goal: any) => goal.id !== goalId);

    await users.updateOne({ sub }, { $set: { goals: updatedGoals } });
    return NextResponse.json({ goals: updatedGoals, removed: goalId });
  } catch (error) {
    console.error('DELETE /api/courses error', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
