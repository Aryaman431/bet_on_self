const { Aptos, AptosConfig, Network } = require('@aptos-labs/ts-sdk');

function createAptosClient() {
  const networkName = String(process.env.APTOS_NETWORK || 'devnet').toLowerCase();
  const network = Network[networkName.toUpperCase()] || Network.DEVNET;
  const config = new AptosConfig({
    network,
    fullnode: process.env.APTOS_FULLNODE_URL || undefined,
    faucet: process.env.APTOS_FAUCET_URL || undefined
  });

  return new Aptos(config);
}

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampBasisPoints(value) {
  const parsed = toInteger(value, 0);
  return Math.max(10000, Math.min(50000, parsed));
}

function buildGoalEvent(goal) {
  return {
    goalId: goal.id,
    owner: goal.owner,
    metric: goal.metric,
    targetValue: goal.targetValue,
    deadline: goal.deadline,
    stakeAmount: goal.stakeAmount,
    rewardMultiplierBps: goal.rewardMultiplierBps,
    status: goal.status,
    outcome: goal.outcome
  };
}

function buildRewardAllocation(allocation) {
  if (!allocation) {
    return null;
  }

  const recipient = String(allocation.recipient || '').trim();
  const amount = toInteger(allocation.amount, 0);
  if (!recipient || amount <= 0) {
    return null;
  }

  return {
    recipient,
    amount,
    reason: String(allocation.reason || 'scholarship')
  };
}

module.exports = {
  createAptosClient,
  buildGoalEvent,
  buildRewardAllocation,
  clampBasisPoints,
  toInteger
};