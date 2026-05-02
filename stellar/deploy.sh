#!/bin/bash
# stellar/deploy-corrected.sh - Deploy contracts using Stellar CLI (v26.0+)

set -e

NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org"
FUNDING_ACCOUNT=$1

if [ -z "$FUNDING_ACCOUNT" ]; then
  echo "Usage: ./deploy-corrected.sh <FUNDING_ACCOUNT_SECRET>"
  echo ""
  echo "Steps to get FUNDING_ACCOUNT_SECRET:"
  echo "1. Generate keypair: stellar keys generate --global deployer"
  echo "2. Get public key: stellar keys show deployer"
  echo "3. Fund via: https://friendbot.stellar.org/?addr=<PUBLIC_KEY>"
  echo "4. Use secret key as argument"
  exit 1
fi

echo "🚀 Deploying bet_on_self contracts using Stellar CLI (v26.0+)"

# Verify Stellar CLI is installed
echo "✅ Checking Stellar CLI..."
STELLAR_VERSION=$(stellar --version)
echo "Stellar CLI: $STELLAR_VERSION"

# Verify Rust is installed
echo "✅ Checking Rust..."
RUSTC_VERSION=$(rustc --version)
echo "Rust: $RUSTC_VERSION"

# Build contracts
echo ""
echo "📦 Building Rust contracts..."
cargo build --release --target wasm32-unknown-unknown

# Create build directory
mkdir -p ./target/contracts

# Copy WASM files
echo "📋 Preparing WASM files..."
cp target/wasm32-unknown-unknown/release/bet_on_self_stellar.wasm ./target/contracts/

# Optimize WASM using Stellar CLI
echo "🔨 Optimizing WASM..."
stellar contract optimize --wasm ./target/contracts/bet_on_self_stellar.wasm

# Get deployer info
echo ""
echo "🔐 Setting up deployer account..."
DEPLOYER_PUBLIC=$(stellar keys show deployer)
echo "Deployer: $DEPLOYER_PUBLIC"

# Deploy Goal Escrow Contract
echo ""
echo "🔗 Deploying Goal Escrow contract..."
GOAL_ESCROW=$(stellar contract deploy \
  --wasm ./target/contracts/bet_on_self_stellar.wasm \
  --source deployer \
  --network testnet 2>&1 | grep -oE 'C[A-Z0-9]{55}' | head -1)

if [ -z "$GOAL_ESCROW" ]; then
  echo "❌ Failed to deploy Goal Escrow contract"
  exit 1
fi
echo "✅ Goal Escrow deployed: $GOAL_ESCROW"

# Deploy Reward Pool Contract
echo ""
echo "🎁 Deploying Reward Pool contract..."
REWARD_POOL=$(stellar contract deploy \
  --wasm ./target/contracts/bet_on_self_stellar.wasm \
  --source deployer \
  --network testnet 2>&1 | grep -oE 'C[A-Z0-9]{55}' | head -1)

if [ -z "$REWARD_POOL" ]; then
  echo "❌ Failed to deploy Reward Pool contract"
  exit 1
fi
echo "✅ Reward Pool deployed: $REWARD_POOL"

# Deploy Oracle Contract
echo ""
echo "🔮 Deploying Oracle contract..."
ORACLE=$(stellar contract deploy \
  --wasm ./target/contracts/bet_on_self_stellar.wasm \
  --source deployer \
  --network testnet 2>&1 | grep -oE 'C[A-Z0-9]{55}' | head -1)

if [ -z "$ORACLE" ]; then
  echo "❌ Failed to deploy Oracle contract"
  exit 1
fi
echo "✅ Oracle deployed: $ORACLE"

# Output configuration
echo ""
echo "=================================================================================="
echo "                    📝 DEPLOYMENT CONFIGURATION"
echo "=================================================================================="
echo ""
echo "Copy the following into your .env.stellar file:"
echo ""
echo "# Contract Addresses"
echo "GOAL_ESCROW_CONTRACT_ID=$GOAL_ESCROW"
echo "REWARD_POOL_CONTRACT_ID=$REWARD_POOL"
echo "ORACLE_CONTRACT_ID=$ORACLE"
echo ""
echo "# Deployer Account"
echo "STELLAR_FUNDING_ACCOUNT=$DEPLOYER_PUBLIC"
echo ""
echo "=================================================================================="
echo "🎉 Deployment complete!"
echo "=================================================================================="
echo ""
echo "Next steps:"
echo "1. Copy contract IDs to .env.stellar"
echo "2. Run: stellar contract invoke (to initialize contracts)"
echo "3. Start backend: npm run dev"
echo "4. Start frontend: npm run dev (in new terminal)"
echo ""
