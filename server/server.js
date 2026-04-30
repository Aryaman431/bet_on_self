const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createAptosClient, buildGoalEvent, buildRewardAllocation, clampBasisPoints, toInteger } = require('./aptos-oracle');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const aptos = createAptosClient();
const goalStore = new Map();
const escrowLedger = new Map();
const eventLog = [];

const adminKeyMatches = (req) => req.headers['x-admin-key'] && req.headers['x-admin-key'] === process.env.ADMIN_KEY;

function appendEvent(type, payload) {
  const entry = { id: eventLog.length + 1, type, timestamp: new Date().toISOString(), ...payload };
  eventLog.unshift(entry);
  return entry;
}

function serializeGoal(goal) {
  return {
    ...goal,
    stakeAmount: String(goal.stakeAmount),
    rewardMultiplierBps: String(goal.rewardMultiplierBps),
    payoutAmount: String(goal.payoutAmount || 0),
    lockedAmount: String(goal.lockedAmount || 0),
    resolutionScore: goal.resolutionScore ?? null
  };
}

async function getLedgerInfo(res) {
  try {
    const ledger = await aptos.getLedgerInfo();
    return res.json({
      status: 'ok',
      chain: 'aptos',
      network: process.env.APTOS_NETWORK || 'devnet',
      ledger
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
}

app.get('/api/health', async (req, res) => {
  return getLedgerInfo(res);
});

app.get('/api/goals', (req, res) => {
  const goals = Array.from(goalStore.values()).map(serializeGoal);
  res.json({ goals, total: goals.length, events: eventLog.slice(0, 20) });
});

app.post('/api/goals', (req, res) => {
  try {
    const body = req.body || {};
    const owner = String(body.owner || '').trim();
    const metric = String(body.metric || '').trim().toLowerCase();
    const targetValue = toInteger(body.targetValue, 0);
    const deadline = String(body.deadline || '').trim();
    const stakeAmount = toInteger(body.stakeAmount, 0);
    const rewardMultiplierBps = clampBasisPoints(body.rewardMultiplierBps ?? 15000);

    if (!owner || !metric || !deadline || stakeAmount <= 0 || targetValue <= 0) {
      return res.status(400).json({ error: 'invalid_goal', message: 'owner, metric, deadline, targetValue, and stakeAmount are required' });
    }

    const id = `goal_${goalStore.size + 1}`;
    const goal = {
      id,
      owner,
      metric,
      targetValue,
      deadline,
      stakeAmount,
      rewardMultiplierBps,
      status: 'open',
      lockedAmount: stakeAmount,
      payoutAmount: 0,
      resolutionScore: null,
      outcome: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    goalStore.set(id, goal);
    escrowLedger.set(id, { goalId: id, owner, lockedAmount: stakeAmount, settled: false });
    appendEvent('goal.created', buildGoalEvent(goal));

    return res.status(201).json({ success: true, goal: serializeGoal(goal) });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'goal_creation_failed', details: error.message });
  }
});

app.post('/api/goals/:goalId/lock', (req, res) => {
  const goal = goalStore.get(req.params.goalId);
  if (!goal) {
    return res.status(404).json({ error: 'goal_not_found' });
  }

  if (goal.status !== 'open') {
    return res.status(409).json({ error: 'goal_not_open' });
  }

  goal.lockedAmount = goal.stakeAmount;
  goal.updatedAt = new Date().toISOString();
  appendEvent('escrow.locked', { goalId: goal.id, owner: goal.owner, lockedAmount: goal.lockedAmount });

  return res.json({ success: true, goal: serializeGoal(goal) });
});

app.post('/api/goals/:goalId/resolve', (req, res) => {
  try {
    if (!adminKeyMatches(req)) {
      return res.status(403).json({ error: 'unauthorized' });
    }

    const goal = goalStore.get(req.params.goalId);
    if (!goal) {
      return res.status(404).json({ error: 'goal_not_found' });
    }

    if (goal.status === 'settled') {
      return res.status(409).json({ error: 'goal_already_settled' });
    }

    const actualValue = toInteger(req.body?.actualValue, null);
    if (actualValue === null) {
      return res.status(400).json({ error: 'invalid_actual_value' });
    }

    const success = actualValue >= goal.targetValue;
    const payoutAmount = success ? Math.floor((goal.stakeAmount * goal.rewardMultiplierBps) / 10000) : 0;
    goal.status = 'settled';
    goal.resolutionScore = actualValue;
    goal.outcome = success ? 'success' : 'failure';
    goal.payoutAmount = payoutAmount;
    goal.updatedAt = new Date().toISOString();

    const escrow = escrowLedger.get(goal.id);
    if (escrow) {
      escrow.settled = true;
      escrow.payoutAmount = payoutAmount;
      escrow.failurePolicy = success ? 'reward' : (req.body?.failurePolicy || 'retain');
    }

    appendEvent('goal.resolved', {
      ...buildGoalEvent(goal),
      actualValue,
      payoutAmount,
      success
    });

    return res.json({ success: true, goal: serializeGoal(goal) });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'goal_resolution_failed', details: error.message });
  }
});

app.post('/api/rewards/distribute', (req, res) => {
  if (!adminKeyMatches(req)) {
    return res.status(403).json({ error: 'unauthorized' });
  }

  const allocations = Array.isArray(req.body?.allocations) ? req.body.allocations : [];
  const normalized = allocations
    .map((allocation) => buildRewardAllocation(allocation))
    .filter(Boolean);

  appendEvent('reward.pool.distributed', {
    totalAllocations: normalized.length,
    allocations: normalized
  });

  res.json({ success: true, allocations: normalized });
});

app.get('/api/events', (req, res) => {
  res.json({ events: eventLog });
});

app.get('/api/escrow/:goalId', (req, res) => {
  const escrow = escrowLedger.get(req.params.goalId);
  if (!escrow) {
    return res.status(404).json({ error: 'escrow_not_found' });
  }

  res.json({ escrow });
});

app.listen(PORT, () => {
  console.log(`bet_on_self backend listening on port ${PORT}`);
  console.log(`Aptos health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
