#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, Symbol, Vec,
    token::Client as TokenClient,
};

#[derive(Clone, Debug)]
#[contracttype]
pub enum DataKey {
    RewardPool,
    PoolAdmin,
    Recipients,
    TotalDistributed,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct RewardPool {
    pub total_balance: i128,
    pub distributed: i128,
    pub failed_goal_contributions: i128,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct Recipient {
    pub address: Address,
    pub allocation: u32, // percentage * 100 (e.g., 2500 = 25%)
}

#[contract]
pub struct RewardPoolContract;

#[contractimpl]
impl RewardPoolContract {
    /// Initialize reward pool
    pub fn initialize(env: Env, admin: Address, token: Address) {
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::PoolAdmin, &admin);

        env.storage()
            .instance()
            .set(&Symbol::new(&env, "TOKEN"), &token);

        let pool = RewardPool {
            total_balance: 0,
            distributed: 0,
            failed_goal_contributions: 0,
        };

        env.storage()
            .instance()
            .set(&DataKey::RewardPool, &pool);

        env.events().publish(
            (Symbol::new(&env, "pool_initialized"),),
            admin,
        );
    }

    /// Add funds to reward pool (from failed goals)
    pub fn contribute(env: Env, amount: i128) {
        require!(amount > 0, "Amount must be positive");

        let token_str: Address = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "TOKEN"))
            .unwrap();
        let token = TokenClient::new(&env, &token_str);

        // Transfer from caller to contract
        let caller = env.current_contract_address();
        token.transfer(&caller, &env.current_contract_address(), &amount);

        let mut pool: RewardPool = env
            .storage()
            .instance()
            .get(&DataKey::RewardPool)
            .unwrap();

        pool.total_balance += amount;
        pool.failed_goal_contributions += amount;

        env.storage()
            .instance()
            .set(&DataKey::RewardPool, &pool);

        env.events().publish(
            (Symbol::new(&env, "pool_contributed"),),
            amount,
        );
    }

    /// Set reward recipients and allocations
    pub fn set_recipients(env: Env, recipients: Vec<Recipient>) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::PoolAdmin)
            .unwrap();
        admin.require_auth();

        // Validate allocations sum to 10000 (100%)
        let mut total_allocation: u32 = 0;
        for recipient in recipients.iter() {
            total_allocation += recipient.allocation;
        }
        require!(total_allocation <= 10000, "Total allocation exceeds 100%");

        env.storage()
            .instance()
            .set(&DataKey::Recipients, &recipients);

        env.events().publish(
            (Symbol::new(&env, "recipients_set"),),
            total_allocation,
        );
    }

    /// Distribute rewards to recipients
    pub fn distribute(env: Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::PoolAdmin)
            .unwrap();
        admin.require_auth();

        let mut pool: RewardPool = env
            .storage()
            .instance()
            .get(&DataKey::RewardPool)
            .unwrap();

        let available = pool.total_balance - pool.distributed;
        require!(available > 0, "No funds available to distribute");

        let recipients: Vec<Recipient> = env
            .storage()
            .instance()
            .get(&DataKey::Recipients)
            .unwrap_or(Vec::new(&env));

        require!(recipients.len() > 0, "No recipients configured");

        let token_str: Address = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "TOKEN"))
            .unwrap();
        let token = TokenClient::new(&env, &token_str);

        // Distribute to each recipient
        for recipient in recipients.iter() {
            let amount = (available * (recipient.allocation as i128)) / 10000;
            if amount > 0 {
                token.transfer(
                    &env.current_contract_address(),
                    &recipient.address,
                    &amount,
                );
            }
        }

        pool.distributed = pool.total_balance;

        env.storage()
            .instance()
            .set(&DataKey::RewardPool, &pool);

        env.events().publish(
            (Symbol::new(&env, "distribution_completed"),),
            available,
        );
    }

    /// Get pool balance
    pub fn get_balance(env: Env) -> RewardPool {
        env.storage()
            .instance()
            .get(&DataKey::RewardPool)
            .unwrap_or(RewardPool {
                total_balance: 0,
                distributed: 0,
                failed_goal_contributions: 0,
            })
    }

    /// Get available for distribution
    pub fn get_available(env: Env) -> i128 {
        let pool: RewardPool = env
            .storage()
            .instance()
            .get(&DataKey::RewardPool)
            .unwrap_or(RewardPool {
                total_balance: 0,
                distributed: 0,
                failed_goal_contributions: 0,
            });

        pool.total_balance - pool.distributed
    }

    /// Get recipients
    pub fn get_recipients(env: Env) -> Vec<Recipient> {
        env.storage()
            .instance()
            .get(&DataKey::Recipients)
            .unwrap_or(Vec::new(&env))
    }
}
