# bet_on_self

bet_on_self is an Aptos-based accountability platform for committing real value to personal goals.

Users create goals such as target grades, fitness streaks, productivity challenges, or skill milestones. Funds are locked in on-chain escrow through Aptos Move modules, while an off-chain oracle layer verifies outcomes and submits final resolution data. ML stays off-chain and is used only to estimate odds and reward curves.

## Architecture

### On-chain

The Aptos Move package models each goal as a resource with deterministic settlement rules.

It covers:

- Goal creation with target value, deadline, stake, and reward multiplier
- Escrow locking with no early withdrawal
- Single-settlement resolution with outcome events
- Optional scholarship and reward pool distribution

### Off-chain

The backend acts as the oracle and analytics layer.

It handles:

- ML prediction requests for reward estimation
- Verified outcome submission
- Event tracking and portfolio mirroring
- MongoDB caching for user state and analytics

### Frontend

The Next.js app is centered on goal creation, wallet connection, progress tracking, and outcome review.

It supports:

- Aptos wallet connection via injected wallet providers such as Petra and Martian
- Goal dashboards and escrow summaries
- Settlement and reward views

## Project Structure

- `src/` contains the Next.js app and UI
- `ml/` contains the off-chain prediction model and API
- `server/` contains the Aptos-aware oracle backend
- `aptos/` contains the Move package for escrow and rewards

## Product Scope

The system is designed to generalize beyond grades.

It can support:

- Fitness goals
- Productivity challenges
- Skill development tracking
- Scholarship and incentive pools

## Notes

The current repository has been migrated to an Aptos-first architecture. The legacy setup document and artifacts were removed.