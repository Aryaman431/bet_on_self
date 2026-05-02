#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, Symbol, Vec, Map,
    map,
};

#[derive(Clone, Debug)]
#[contracttype]
pub enum DataKey {
    OracleOperators,
    PendingOutcomes,
    ResolvedOutcomes,
    OutcomeHistory,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct PendingOutcome {
    pub goal_id: u64,
    pub creator: Address,
    pub proposed_value: i128,
    pub succeeded: bool,
    pub timestamp: u64,
    pub confirmed_by: Vec<Address>,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct ResolvedOutcome {
    pub goal_id: u64,
    pub creator: Address,
    pub outcome_value: i128,
    pub succeeded: bool,
    pub resolution_timestamp: u64,
    pub confirmed_count: u32,
}

#[contract]
pub struct Oracle;

#[contractimpl]
impl Oracle {
    /// Initialize oracle with operators
    pub fn initialize(env: Env, operators: Vec<Address>) {
        require!(operators.len() > 0, "At least one operator required");

        env.storage()
            .instance()
            .set(&DataKey::OracleOperators, &operators);

        env.events().publish(
            (Symbol::new(&env, "oracle_initialized"),),
            operators.len(),
        );
    }

    /// Add oracle operator
    pub fn add_operator(env: Env, operator: Address) {
        let existing_operators: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::OracleOperators)
            .unwrap();

        // Only allow first operator to add others, or implement governance
        let caller = env.current_contract_address();
        
        let mut new_operators = existing_operators.clone();
        new_operators.push_back(operator.clone());

        env.storage()
            .instance()
            .set(&DataKey::OracleOperators, &new_operators);

        env.events().publish(
            (Symbol::new(&env, "operator_added"),),
            operator,
        );
    }

    /// Propose outcome for a goal (from oracle operator)
    pub fn propose_outcome(
        env: Env,
        goal_id: u64,
        creator: Address,
        outcome_value: i128,
        succeeded: bool,
    ) {
        let operator = env.invoker();

        let operators: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::OracleOperators)
            .unwrap();

        // Verify caller is operator
        require!(
            operators.iter().find(|op| op == &operator).is_some(),
            "Caller is not an oracle operator"
        );

        let mut pending: Vec<PendingOutcome> = env
            .storage()
            .instance()
            .get(&DataKey::PendingOutcomes)
            .unwrap_or(Vec::new(&env));

        // Check if outcome already proposed
        let existing = pending.iter().find(|p| p.goal_id == goal_id);
        require!(
            existing.is_none(),
            "Outcome already proposed for this goal"
        );

        let mut confirmed_by = Vec::new(&env);
        confirmed_by.push_back(operator);

        let pending_outcome = PendingOutcome {
            goal_id,
            creator,
            proposed_value: outcome_value,
            succeeded,
            timestamp: env.ledger().timestamp(),
            confirmed_by,
        };

        pending.push_back(pending_outcome.clone());

        env.storage()
            .instance()
            .set(&DataKey::PendingOutcomes, &pending);

        env.events().publish(
            (Symbol::new(&env, "outcome_proposed"),),
            (goal_id, outcome_value, succeeded),
        );
    }

    /// Confirm outcome (additional oracle operators)
    pub fn confirm_outcome(env: Env, goal_id: u64, creator: Address) {
        let operator = env.invoker();

        let operators: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::OracleOperators)
            .unwrap();

        require!(
            operators.iter().find(|op| op == &operator).is_some(),
            "Caller is not an oracle operator"
        );

        let mut pending: Vec<PendingOutcome> = env
            .storage()
            .instance()
            .get(&DataKey::PendingOutcomes)
            .unwrap_or(Vec::new(&env));

        // Find and update pending outcome
        let outcome_index = pending.iter().position(|p| p.goal_id == goal_id);
        require!(
            outcome_index.is_some(),
            "Outcome not found in pending"
        );

        let mut pending_outcome = pending.get(outcome_index.unwrap()).unwrap().clone();

        // Check operator hasn't already confirmed
        require!(
            !pending_outcome.confirmed_by.iter().any(|op| op == &operator),
            "Operator already confirmed this outcome"
        );

        pending_outcome.confirmed_by.push_back(operator);

        // Check if threshold reached (2 out of 3 operators by default)
        let threshold = (operators.len() as u32 + 1) / 2;
        if pending_outcome.confirmed_by.len() >= threshold as usize {
            // Outcome is confirmed, move to resolved
            let resolved = ResolvedOutcome {
                goal_id: pending_outcome.goal_id,
                creator: pending_outcome.creator,
                outcome_value: pending_outcome.proposed_value,
                succeeded: pending_outcome.succeeded,
                resolution_timestamp: env.ledger().timestamp(),
                confirmed_count: pending_outcome.confirmed_by.len() as u32,
            };

            let mut resolved_outcomes: Vec<ResolvedOutcome> = env
                .storage()
                .instance()
                .get(&DataKey::ResolvedOutcomes)
                .unwrap_or(Vec::new(&env));

            resolved_outcomes.push_back(resolved.clone());

            env.storage()
                .instance()
                .set(&DataKey::ResolvedOutcomes, &resolved_outcomes);

            // Remove from pending
            pending.remove(outcome_index.unwrap());
            env.storage()
                .instance()
                .set(&DataKey::PendingOutcomes, &pending);

            env.events().publish(
                (Symbol::new(&env, "outcome_confirmed"),),
                (goal_id, resolved.confirmed_count),
            );
        } else {
            // Update pending with new confirmation
            pending.set(outcome_index.unwrap(), pending_outcome);
            env.storage()
                .instance()
                .set(&DataKey::PendingOutcomes, &pending);

            env.events().publish(
                (Symbol::new(&env, "outcome_confirmation"),),
                (goal_id, pending_outcome.confirmed_by.len() as u32),
            );
        }
    }

    /// Get pending outcomes
    pub fn get_pending(env: Env) -> Vec<PendingOutcome> {
        env.storage()
            .instance()
            .get(&DataKey::PendingOutcomes)
            .unwrap_or(Vec::new(&env))
    }

    /// Get resolved outcomes
    pub fn get_resolved(env: Env) -> Vec<ResolvedOutcome> {
        env.storage()
            .instance()
            .get(&DataKey::ResolvedOutcomes)
            .unwrap_or(Vec::new(&env))
    }

    /// Check if outcome is resolved
    pub fn is_resolved(env: Env, goal_id: u64) -> bool {
        let resolved: Vec<ResolvedOutcome> = env
            .storage()
            .instance()
            .get(&DataKey::ResolvedOutcomes)
            .unwrap_or(Vec::new(&env));

        resolved.iter().any(|r| r.goal_id == goal_id)
    }

    /// Get operators
    pub fn get_operators(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::OracleOperators)
            .unwrap_or(Vec::new(&env))
    }
}
