module bet_on_self::bet_on_self {
    use std::signer;
    use aptos_framework::coin::Coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use bet_on_self::goal_escrow;
    use bet_on_self::reward_pool;

    // Errors
    const ERR_NOT_INITIALIZED: u64 = 1;
    const ERR_ALREADY_INITIALIZED: u64 = 2;

    #[event]
    struct BetOnSelfInitialized has drop, store {
        user: address,
        timestamp: u64,
    }

    #[event]
    struct GoalProgressUpdated has drop, store {
        goal_id: u64,
        progress: u64,
        timestamp: u64,
    }

    struct UserProfile has key {
        goals_created: u64,
        goals_completed: u64,
        total_staked: u64,
        total_earned: u64,
        initialized: bool,
    }

    /// Initialize the bet_on_self application for a user
    public entry fun initialize(user: &signer) {
        let user_addr = signer::address_of(user);
        assert!(!exists<UserProfile>(user_addr), ERR_ALREADY_INITIALIZED);

        // Initialize goal store
        goal_escrow::init_goal_store(user);

        // Initialize reward pool
        reward_pool::init_reward_pool(user);

        // Create user profile
        move_to(user, UserProfile {
            goals_created: 0,
            goals_completed: 0,
            total_staked: 0,
            total_earned: 0,
            initialized: true,
        });

        event::emit(BetOnSelfInitialized {
            user: user_addr,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Create a new self-improvement goal with escrow
    public entry fun create_goal(
        user: &signer,
        title: vector<u8>,
        description: vector<u8>,
        metric: vector<u8>,
        target_value: u64,
        stake_coin: Coin<AptosCoin>,
        deadline_days: u64,
    ) acquires UserProfile {
        let user_addr = signer::address_of(user);
        assert!(exists<UserProfile>(user_addr), ERR_NOT_INITIALIZED);

        let deadline = timestamp::now_seconds() + (deadline_days * 86400); // 86400 seconds per day
        goal_escrow::create_goal(
            user,
            title,
            description,
            metric,
            target_value,
            stake_coin,
            deadline,
        );

        let profile = borrow_global_mut<UserProfile>(user_addr);
        profile.goals_created = profile.goals_created + 1;
    }

    /// Lock a goal (finalize the escrow)
    public entry fun lock_goal(user: &signer, goal_id: u64) {
        goal_escrow::lock_goal(user, goal_id);
    }

    /// Resolve a goal with outcome
    public entry fun resolve_goal(
        user: &signer,
        goal_id: u64,
        outcome: u8, // 0 = loss, 1 = win
        payout_amount: u64,
    ) acquires UserProfile {
        let user_addr = signer::address_of(user);
        assert!(exists<UserProfile>(user_addr), ERR_NOT_INITIALIZED);

        goal_escrow::resolve_goal(user, goal_id, outcome, payout_amount);

        let profile = borrow_global_mut<UserProfile>(user_addr);
        if (outcome == 1) {
            profile.goals_completed = profile.goals_completed + 1;
            profile.total_earned = profile.total_earned + payout_amount;
        };
    }

    /// Update goal progress
    public entry fun update_goal_progress(user: &signer, goal_id: u64, progress: u64) {
        event::emit(GoalProgressUpdated {
            goal_id: goal_id,
            progress: progress,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Get user profile statistics
    #[view]
    public fun get_user_profile(user: address): (u64, u64, u64, u64) acquires UserProfile {
        assert!(exists<UserProfile>(user), ERR_NOT_INITIALIZED);
        let profile = borrow_global<UserProfile>(user);
        (profile.goals_created, profile.goals_completed, profile.total_staked, profile.total_earned)
    }
}
