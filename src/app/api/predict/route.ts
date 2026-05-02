import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import jwt from "jsonwebtoken";
import clientPromise from "@/lib/mongodb";

const ML_BASE = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
const REG_ENDPOINT = "/predict_regression";

async function getSub() {
  const hdrs = await headers();
  const devHeader = hdrs.get('x-dev-sub');
  if (process.env.NODE_ENV !== 'production' && devHeader) return devHeader;

  const cookieStore = await cookies();
  const idToken = cookieStore.get("id_token");
  if (!idToken?.value) return undefined;

  const decoded: any = jwt.decode(idToken.value);
  return decoded?.sub;
}

function buildSequence(values: number[]) {
  if (!values.length) return [];
  const selected = values.slice(-10);
  while (selected.length < 10) {
    selected.unshift(selected[0]);
  }
  return selected;
}

async function runPrediction(grades: number[], difficulty: number) {
  const response = await fetch(ML_BASE + REG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ past_grades: buildSequence(grades), difficulty })
  });

  if (!response.ok) {
    return { error: 'ml_upstream_error', status: response.status };
  }

  return response.json();
}

export async function GET() {
  try {
    const sub = await getSub();
    if (!sub) return NextResponse.json({ error: 'not_authenticated' }, { status: 200 });

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const users = db.collection('users');
    const user = await users.findOne({ sub });
    const goals = Array.isArray(user?.goals) ? user.goals : [];

    const grades = goals
      .map((goal: any) => Number(goal.progress ?? goal.targetValue ?? 0))
      .filter((value: number) => Number.isFinite(value));

    if (!grades.length) {
      return NextResponse.json({ error: 'no_data' }, { status: 200 });
    }

    const prediction = await runPrediction(grades, 1);
    return NextResponse.json({ grades: buildSequence(grades), difficulty: 1, prediction });
  } catch (error) {
    console.error('Predict endpoint error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const difficulty = typeof body?.difficulty === 'number' ? body.difficulty : 1;
    const gradesSource = Array.isArray(body?.grades) ? body.grades.filter((value: any) => typeof value === 'number' && !Number.isNaN(value)) : [];

    if (!gradesSource.length) {
      return NextResponse.json({ error: 'no_data' }, { status: 200 });
    }

    const prediction = await runPrediction(gradesSource, difficulty);
    return NextResponse.json({ grades: buildSequence(gradesSource), difficulty, prediction });
  } catch (error) {
    console.error('Predict POST error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
