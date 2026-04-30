module bet_on_self::goal_escrow {
    use std::signer;
    use std::vector;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;
    use aptos_framework::timestamp;

    // Constants
    const ESCROW_VERSION: u64 = 1;
    const GOAL_PENDING: u8 = 0;
    const GOAL_LOCKED: u8 = 1;
    const GOAL_RESOLVED: u8 = 2;

    // Errors
    const ERR_GOAL_NOT_FOUND: u64 = 1;
    const ERR_INVALID_STATE: u64 = 2;
    const ERR_INSUFFICIENT_BALANCE: u64 = 3;
    const ERR_UNAUTHORIZED: u64 = 4;

    #[event]
    struct GoalCreated has drop, store {
        goal_id: u64,
        owner: address,
        title: vector<u8>,
        stake_amount: u64,
        timestamp: u64,
    }

    #[event]
    struct GoalLocked has drop, store {
        goal_id: u64,
        locked_amount: u64,
        timestamp: u64,
    }

    #[event]
    struct GoalResolved has drop, store {
        goal_id: u64,
        outcome: u8, // 0 = loss, 1 = win
        payout_amount: u64,
        timestamp: u64,
    }

    struct Goal has key, store {
        id: u64,
        owner: address,
        title: vector<u8>,
        description: vector<u8>,
        metric: vector<u8>,
        target_value: u64,
        current_progress: u64,
        stake_amount: u64,
        locked_coin: Coin<AptosCoin>,
        status: u8, // 0 = pending, 1 = locked, 2 = resolved
        outcome: u8, // 0 = loss, 1 = win
        payout_amount: u64,
        created_at: u64,
        deadline: u64,
    }

    struct GoalStore has key {
        goals: vector<Goal>,
        next_goal_id: u64,
        treasury: Coin<AptosCoin>,
    }

    /// Initialize the goal store for an account
    public fun init_goal_store(account: &signer) {
        let addr = signer::address_of(account);
        assert!(!exists<GoalStore>(addr), ERR_INVALID_STATE);

        move_to(account, GoalStore {
            goals: vector::empty<Goal>(),
            next_goal_id: 0,
            treasury: coin::zero<AptosCoin>(),
        });
    }

    /// Create a new goal with escrow stake
    public fun create_goal(
        owner: &signer,
        title: vector<u8>,
        description: vector<u8>,
        metric: vector<u8>,
        target_value: u64,
        stake_coin: Coin<AptosCoin>,
        deadline: u64,
    ) acquires GoalStore {
        let owner_addr = signer::address_of(owner);
        assert!(exists<GoalStore>(owner_addr), ERR_INVALID_STATE);

        let store = borrow_global_mut<GoalStore>(owner_addr);
        let goal_id = store.next_goal_id;
        let stake_amount = coin::value(&stake_coin);

        let goal = Goal {
            id: goal_id,
            owner: owner_addr,
            title: title,
            description: description,
            metric: metric,
            target_value: target_value,
            current_progress: 0,
            stake_amount: stake_amount,
            locked_coin: stake_coin,
            status: GOAL_PENDING,
            outcome: 0,
            payout_amount: 0,
            created_at: timestamp::now_seconds(),
            deadline: deadline,
        };

        event::emit(GoalCreated {
            goal_id: goal_id,
            owner: owner_addr,
            title: title,
            stake_amount: stake_amount,
            timestamp: timestamp::now_seconds(),
        });

        vector::push_back(&mut store.goals, goal);
        store.next_goal_id = goal_id + 1;
    }

    /// Lock the goal (move from pending to locked state)
    public fun lock_goal(owner: &signer, goal_id: u64) acquires GoalStore {
        let owner_addr = signer::address_of(owner);
        assert!(exists<GoalStore>(owner_addr), ERR_INVALID_STATE);

        let store = borrow_global_mut<GoalStore>(owner_addr);
        let goal_idx = find_goal(&store.goals, goal_id);
        assert!(goal_idx < vector::length(&store.goals), ERR_GOAL_NOT_FOUND);

        let goal = vector::borrow_mut(&mut store.goals, goal_idx);
        assert!(goal.status == GOAL_PENDING, ERR_INVALID_STATE);
        goal.status = GOAL_LOCKED;

        event::emit(GoalLocked {
            goal_id: goal_id,
            locked_amount: goal.stake_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Resolve a goal with outcome and distribute payout
    public fun resolve_goal(
        owner: &signer,
        goal_id: u64,
        outcome: u8,
        payout_amount: u64,
    ) acquires GoalStore {
        let owner_addr = signer::address_of(owner);
        assert!(exists<GoalStore>(owner_addr), ERR_INVALID_STATE);

        let store = borrow_global_mut<GoalStore>(owner_addr);
        let goal_idx = find_goal(&store.goals, goal_id);
        assert!(goal_idx < vector::length(&store.goals), ERR_GOAL_NOT_FOUND);

        let goal = vector::borrow_mut(&mut store.goals, goal_idx);
        assert!(goal.status == GOAL_LOCKED, ERR_INVALID_STATE);

        goal.status = GOAL_RESOLVED;
        goal.outcome = outcome;
        goal.payout_amount = payout_amount;

        event::emit(GoalResolved {
            goal_id: goal_id,
            outcome: outcome,
            payout_amount: payout_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Helper function to find goal by ID
    fun find_goal(goals: &vector<Goal>, goal_id: u64): u64 {
        let i = 0;
        let len = vector::length(goals);
        while (i < len) {
            if (vector::borrow(goals, i).id == goal_id) {
                return i
            };
            i = i + 1;
        };
        len
    }

    /// Get goal details (view function)
    #[view]
    public fun get_goal(owner: address, goal_id: u64): (u64, address, vector<u8>, u64, u8) acquires GoalStore {
        assert!(exists<GoalStore>(owner), ERR_INVALID_STATE);
        let store = borrow_global<GoalStore>(owner);
        let goal_idx = find_goal(&store.goals, goal_id);
        assert!(goal_idx < vector::length(&store.goals), ERR_GOAL_NOT_FOUND);

        let goal = vector::borrow(&store.goals, goal_idx);
        (goal.id, goal.owner, goal.title, goal.stake_amount, goal.status)
    }

    /// Get all goals for an owner (view function)
    #[view]
    public fun get_goals(owner: address): vector<Goal> acquires GoalStore {
        assert!(exists<GoalStore>(owner), ERR_INVALID_STATE);
        borrow_global<GoalStore>(owner).goals
    }
}
