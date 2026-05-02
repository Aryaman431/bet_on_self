<<<<<<< HEAD
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import clientPromise from "@/lib/mongodb"
import { NextResponse, NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const idToken = cookieStore.get("id_token")

    if (!idToken?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decoded: any = jwt.decode(idToken.value)
    const userId = decoded?.sub

    if (!userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { goalId, title, metric, targetValue, stakeAmount, walletAddress, odds = [] } = await request.json()

    if (!goalId && !title) {
      return NextResponse.json({ error: "Missing required fields: goalId or title" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB)
    const users = db.collection("users")
    const user = await users.findOne({ sub: userId })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const goal = {
      id: goalId || `goal_${Date.now()}`,
      title: title || "Untitled goal",
      metric: metric || "grade",
      targetValue: Number(targetValue || 0),
      deadline: String(new Date().toISOString()),
      stakeAmount: Number(stakeAmount || 0),
      rewardMultiplierBps: 15000,
      status: "locked",
      outcome: "pending",
      progress: 0,
      lockedAmount: Number(stakeAmount || 0),
      payoutAmount: 0,
      odds,
      walletAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const existingGoals = Array.isArray(user.goals) ? user.goals : []
    const nextGoals = existingGoals.some((entry: any) => entry.id === goal.id)
      ? existingGoals.map((entry: any) => entry.id === goal.id ? { ...entry, ...goal } : entry)
      : [...existingGoals, goal]

    await users.updateOne({ sub: userId }, { $set: { goals: nextGoals } }, { upsert: true })

    return NextResponse.json({ success: true, goal })
  } catch (error) {
    console.error("Place goal stake API error:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
=======
// src/app/api/place-bet/route.ts - Updated for Stellar
import { NextRequest, NextResponse } from 'next/server';
import StellarSdk from 'stellar-sdk';
import clientPromise from '@/lib/mongodb';

const server = new StellarSdk.Server(
  process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org'
);
const networkPassphrase = StellarSdk.Networks.TESTNET_NETWORK_PASSPHRASE;

interface PlaceBetRequest {
  userAddress: string; // Stellar public key
  targetValue: number;
  deadline: number;
  stake: number; // in stroops
  rewardMultiplier: number; // e.g., 150 for 1.5x
  metadata?: Record<string, any>;
  signedTransaction: string; // Signed XDR from frontend
}

export async function POST(request: NextRequest) {
  try {
    const body: PlaceBetRequest = await request.json();

    const {
      userAddress,
      targetValue,
      deadline,
      stake,
      rewardMultiplier,
      metadata,
      signedTransaction,
    } = body;

    // Validate Stellar address format
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid Stellar address' },
        { status: 400 }
      );
    }

    // Validate transaction signature and format
    try {
      const tx = StellarSdk.TransactionBuilder.fromXDR(
        signedTransaction,
        networkPassphrase
      );
      if (tx.source !== userAddress) {
        return NextResponse.json(
          { error: 'Transaction source does not match user address' },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid signed transaction' },
        { status: 400 }
      );
    }

    // Validate inputs
    if (targetValue <= 0 || stake <= 0 || rewardMultiplier < 100) {
      return NextResponse.json(
        { error: 'Invalid bet parameters' },
        { status: 400 }
      );
    }

    if (deadline <= Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { error: 'Deadline must be in the future' },
        { status: 400 }
      );
    }

    // Submit transaction to Stellar network
    const submitResult = await server.submitTransaction(
      StellarSdk.TransactionBuilder.fromXDR(
        signedTransaction,
        networkPassphrase
      )
    );

    // Store bet in database
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const goalsCollection = db.collection('goals');

    const goalDoc = {
      creator: userAddress,
      targetValue,
      deadline,
      stake,
      rewardMultiplier,
      status: 'active',
      createdAt: new Date(),
      transactionHash: submitResult.hash,
      transactionLedger: submitResult.ledger,
      metadata: metadata || {},
    };

    const insertResult = await goalsCollection.insertOne(goalDoc);

    // Update user portfolio
    const portfolioCollection = db.collection('portfolios');
    await portfolioCollection.updateOne(
      { address: userAddress },
      {
        $inc: {
          totalStaked: stake,
        },
        $push: {
          goals: insertResult.insertedId.toString(),
        },
        $setOnInsert: {
          address: userAddress,
          totalEarned: 0,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      goalId: insertResult.insertedId.toString(),
      transactionHash: submitResult.hash,
      ledger: submitResult.ledger,
    });
  } catch (error: any) {
    console.error('Error placing bet:', error);

    // Handle Stellar-specific errors
    if (error.response?.body?.extras?.result_codes) {
      const resultCodes = error.response.body.extras.result_codes;
      return NextResponse.json(
        {
          error: 'Transaction failed',
          resultCodes,
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to place bet' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userAddress = searchParams.get('user');

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address required' },
        { status: 400 }
      );
    }

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid Stellar address' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const goalsCollection = db.collection('goals');

    const goals = await goalsCollection
      .find({ creator: userAddress })
      .toArray();

    return NextResponse.json({ goals });
  } catch (error: any) {
    console.error('Error fetching bets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bets' },
      { status: 500 }
    );
  }
}
>>>>>>> 6d6b1791cab816d1014e9651a83fed8a53e1cec0
