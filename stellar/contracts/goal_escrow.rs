#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, Symbol, Vec, Map,
    token::Client as TokenClient, TryFromVal, IntoVal,
};

#[derive(Clone, Debug)]
#[contracttype]
pub enum DataKey {
    Goal(Address),
    User(Address),
    Admin,
    NextGoalId,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct Goal {
    pub id: u64,
    pub creator: Address,
    pub target_value: i128,
    pub deadline: u64,
    pub stake: i128,
    pub reward_multiplier: u32, // e.g., 150 = 1.5x
    pub status: u32, // 0: active, 1: succeeded, 2: failed
    pub outcome_value: i128,
    pub settlement_timestamp: u64,
    pub metadata: Vec<u8>, // JSON or custom encoding
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct UserPortfolio {
    pub goals: Vec<u64>,
    pub total_staked: i128,
    pub total_earned: i128,
}

#[contract]
pub struct GoalEscrow;

#[contractimpl]
impl GoalEscrow {
    /// Initialize the contract with admin and token
    pub fn initialize(env: Env, admin: Address, token: Address) {
        admin.require_auth();
        
        env.storage()
            .instance()
            .set(&DataKey::Admin, &admin);
        
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "TOKEN"), &token);
    }

    /// Create a new goal with escrow lock
    pub fn create_goal(
        env: Env,
        creator: Address,
        target_value: i128,
        deadline: u64,
        stake: i128,
        reward_multiplier: u32,
        metadata: Vec<u8>,
    ) -> u64 {
        creator.require_auth();

        // Validate inputs
        require!(target_value > 0, "target_value must be positive");
        require!(stake > 0, "stake must be positive");
        require!(deadline > env.ledger().timestamp(), "deadline must be in future");

        // Get token client
        let token_str: Address = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "TOKEN"))
            .unwrap();
        let token = TokenClient::new(&env, &token_str);

        // Transfer stake to contract
        token.transfer(&creator, &env.current_contract_address(), &stake);

        // Generate goal ID
        let goal_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextGoalId)
            .unwrap_or(1u64);

        let new_goal = Goal {
            id: goal_id,
            creator: creator.clone(),
            target_value,
            deadline,
            stake,
            reward_multiplier,
            status: 0, // active
            outcome_value: 0,
            settlement_timestamp: 0,
            metadata,
        };

        // Store goal
        env.storage()
            .instance()
            .set(&DataKey::Goal(creator.clone()), &new_goal);

        // Update user portfolio
        let mut portfolio: UserPortfolio = env
            .storage()
            .instance()
            .get(&DataKey::User(creator.clone()))
            .unwrap_or(UserPortfolio {
                goals: Vec::new(&env),
                total_staked: 0,
                total_earned: 0,
            });

        portfolio.goals.push_back(goal_id);
        portfolio.total_staked += stake;

        env.storage()
            .instance()
            .set(&DataKey::User(creator), &portfolio);

        // Increment next goal ID
        env.storage()
            .instance()
            .set(&DataKey::NextGoalId, &(goal_id + 1));

        env.events().publish(
            (Symbol::new(&env, "goal_created"),),
            (goal_id, stake, reward_multiplier),
        );

        goal_id
    }

    /// Resolve a goal with outcome
    pub fn resolve_goal(
        env: Env,
        goal_id: u64,
        creator: Address,
        outcome_value: i128,
        succeeded: bool,
    ) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap();
        admin.require_auth();

        let mut goal: Goal = env
            .storage()
            .instance()
            .get(&DataKey::Goal(creator.clone()))
            .unwrap();

        require!(goal.id == goal_id, "Goal ID mismatch");
        require!(goal.status == 0, "Goal already resolved");

        let token_str: Address = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "TOKEN"))
            .unwrap();
        let token = TokenClient::new(&env, &token_str);

        let settlement_timestamp = env.ledger().timestamp();

        if succeeded {
            // Calculate reward
            let reward = goal.stake * (goal.reward_multiplier as i128) / 100;
            let total_payout = goal.stake + reward;

            // Payout to creator
            token.transfer(&env.current_contract_address(), &creator, &total_payout);

            goal.status = 1; // succeeded
            goal.outcome_value = outcome_value;
            goal.settlement_timestamp = settlement_timestamp;

            // Update portfolio
            let mut portfolio: UserPortfolio = env
                .storage()
                .instance()
                .get(&DataKey::User(creator.clone()))
                .unwrap();
            portfolio.total_earned += reward;

            env.storage()
                .instance()
                .set(&DataKey::User(creator.clone()), &portfolio);

            env.events().publish(
                (Symbol::new(&env, "goal_succeeded"),),
                (goal_id, reward, outcome_value),
            );
        } else {
            // Failed: stake goes to reward pool (contract retains it)
            goal.status = 2; // failed
            goal.outcome_value = outcome_value;
            goal.settlement_timestamp = settlement_timestamp;

            env.events().publish(
                (Symbol::new(&env, "goal_failed"),),
                (goal_id, goal.stake, outcome_value),
            );
        }

        env.storage()
            .instance()
            .set(&DataKey::Goal(creator), &goal);
    }

    /// Get goal details
    pub fn get_goal(env: Env, creator: Address, goal_id: u64) -> Option<Goal> {
        let goal: Option<Goal> = env
            .storage()
            .instance()
            .get(&DataKey::Goal(creator));

        if let Some(g) = goal {
            if g.id == goal_id {
                return Some(g);
            }
        }
        None
    }

    /// Get user portfolio
    pub fn get_portfolio(env: Env, user: Address) -> UserPortfolio {
        env.storage()
            .instance()
            .get(&DataKey::User(user))
            .unwrap_or(UserPortfolio {
                goals: Vec::new(&env),
                total_staked: 0,
                total_earned: 0,
            })
    }

    /// Get escrow balance (funds locked in contract)
    pub fn get_escrow_balance(env: Env) -> i128 {
        let token_str: Address = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "TOKEN"))
            .unwrap();
        let token = TokenClient::new(&env, &token_str);
        token.balance(&env.current_contract_address())
    }
}