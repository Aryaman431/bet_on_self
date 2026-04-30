module bet_on_self::reward_pool {
    use std::signer;
    use std::vector;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;
    use aptos_framework::timestamp;

    // Constants
    const REWARD_POOL_VERSION: u64 = 1;
    const MAX_BASIS_POINTS: u64 = 10000;

    // Errors
    const ERR_POOL_NOT_FOUND: u64 = 1;
    const ERR_INVALID_PARAMS: u64 = 2;
    const ERR_INSUFFICIENT_FUNDS: u64 = 3;

    #[event]
    struct RewardDistributed has drop, store {
        recipient: address,
        amount: u64,
        reason: vector<u8>,
        timestamp: u64,
    }

    #[event]
    struct PoolFunded has drop, store {
        amount: u64,
        timestamp: u64,
    }

    struct RewardAllocation has key, store {
        beneficiary: address,
        amount: u64,
        basis_points: u64, // e.g., 5000 = 50%
        claimed: bool,
    }

    struct RewardPool has key {
        pool_coins: Coin<AptosCoin>,
        allocations: vector<RewardAllocation>,
        total_distributed: u64,
        owner: address,
    }

    /// Initialize a reward pool for an account
    public fun init_reward_pool(account: &signer) {
        let addr = signer::address_of(account);
        move_to(account, RewardPool {
            pool_coins: coin::zero<AptosCoin>(),
            allocations: vector::empty<RewardAllocation>(),
            total_distributed: 0,
            owner: addr,
        });
    }

    /// Fund the reward pool
    public fun fund_pool(
        pool_owner: &signer,
        deposit_coin: Coin<AptosCoin>,
    ) acquires RewardPool {
        let pool_owner_addr = signer::address_of(pool_owner);
        assert!(exists<RewardPool>(pool_owner_addr), ERR_POOL_NOT_FOUND);

        let pool = borrow_global_mut<RewardPool>(pool_owner_addr);
        let amount = coin::value(&deposit_coin);
        coin::merge(&mut pool.pool_coins, deposit_coin);

        event::emit(PoolFunded {
            amount: amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Add a reward allocation to the pool
    public fun allocate_reward(
        pool_owner: &signer,
        beneficiary: address,
        basis_points: u64,
    ) acquires RewardPool {
        let pool_owner_addr = signer::address_of(pool_owner);
        assert!(exists<RewardPool>(pool_owner_addr), ERR_POOL_NOT_FOUND);
        assert!(basis_points <= MAX_BASIS_POINTS, ERR_INVALID_PARAMS);

        let pool = borrow_global_mut<RewardPool>(pool_owner_addr);
        let pool_balance = coin::value(&pool.pool_coins);
        let amount = (pool_balance * basis_points) / MAX_BASIS_POINTS;

        let allocation = RewardAllocation {
            beneficiary: beneficiary,
            amount: amount,
            basis_points: basis_points,
            claimed: false,
        };

        vector::push_back(&mut pool.allocations, allocation);
    }

    /// Distribute rewards from the pool
    public fun distribute_rewards(
        pool_owner: &signer,
    ) acquires RewardPool {
        let pool_owner_addr = signer::address_of(pool_owner);
        assert!(exists<RewardPool>(pool_owner_addr), ERR_POOL_NOT_FOUND);

        let pool = borrow_global_mut<RewardPool>(pool_owner_addr);
        let i = 0;
        let len = vector::length(&pool.allocations);

        while (i < len) {
            let allocation = vector::borrow_mut(&mut pool.allocations, i);
            if (!allocation.claimed && allocation.amount > 0) {
                // In a real implementation, transfer the reward to the beneficiary
                allocation.claimed = true;
                pool.total_distributed = pool.total_distributed + allocation.amount;

                event::emit(RewardDistributed {
                    recipient: allocation.beneficiary,
                    amount: allocation.amount,
                    reason: b"goal_completion_reward",
                    timestamp: timestamp::now_seconds(),
                });
            };
            i = i + 1;
        };
    }

    /// Get pool balance
    #[view]
    public fun get_pool_balance(pool_owner: address): u64 acquires RewardPool {
        assert!(exists<RewardPool>(pool_owner), ERR_POOL_NOT_FOUND);
        let pool = borrow_global<RewardPool>(pool_owner);
        coin::value(&pool.pool_coins)
    }

    /// Get total rewards distributed
    #[view]
    public fun get_total_distributed(pool_owner: address): u64 acquires RewardPool {
        assert!(exists<RewardPool>(pool_owner), ERR_POOL_NOT_FOUND);
        let pool = borrow_global<RewardPool>(pool_owner);
        pool.total_distributed
    }

    /// Calculate reward amount based on basis points
    public fun calculate_reward(pool_balance: u64, basis_points: u64): u64 {
        assert!(basis_points <= MAX_BASIS_POINTS, ERR_INVALID_PARAMS);
        (pool_balance * basis_points) / MAX_BASIS_POINTS
    }
}
