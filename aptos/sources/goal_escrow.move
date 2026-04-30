module bet_on_self::goal_escrow {
    use aptos_framework::event;
    use std::signer;
    use std::vector;

    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_INVALID_STAKE: u64 = 3;
    const E_GOAL_NOT_FOUND: u64 = 4;
    const E_NOT_OWNER: u64 = 5;
    const E_ALREADY_SETTLED: u64 = 6;
    const E_NOT_ORACLE: u64 = 7;
    const E_ALREADY_CLAIMED: u64 = 8;

    const STATUS_OPEN: u8 = 0;
    const STATUS_LOCKED: u8 = 1;
    const STATUS_RESOLVED: u8 = 2;
    const OUTCOME_PENDING: u8 = 0;
    const OUTCOME_SUCCESS: u8 = 1;
    const OUTCOME_FAILURE: u8 = 2;

    struct Goal has store {
        goal_id: u64,
        owner: address,
        title: vector<u8>,
        metric: vector<u8>,
        target_value: u64,
        deadline_secs: u64,
        stake_amount: u64,
        reward_multiplier_bps: u64,
        locked_amount: u64,
        payout_amount: u64,
        progress: u64,
        status: u8,
        outcome: u8,
        settled: bool,
        claimed: bool,
    }

    struct GoalCreatedEvent has drop, store {
        goal_id: u64,
        owner: address,
        stake_amount: u64,
        target_value: u64,
    }

    struct GoalResolvedEvent has drop, store {
        goal_id: u64,
        owner: address,
        actual_value: u64,
        payout_amount: u64,
        success: bool,
    }

    struct RewardDistributedEvent has drop, store {
        recipient: address,
        amount: u64,
        reason: vector<u8>,
    }

    struct GoalBook has key {
        next_goal_id: u64,
        goals: vector<Goal>,
        created_events: event::EventHandle<GoalCreatedEvent>,
        resolved_events: event::EventHandle<GoalResolvedEvent>,
        reward_events: event::EventHandle<RewardDistributedEvent>,
        oracle: address,
    }

    struct RewardPool has key {
        balance: u64,
    }

    public entry fun init(account: &signer, oracle: address) {
        let account_address = signer::address_of(account);
        assert!(!exists<GoalBook>(account_address), E_ALREADY_INITIALIZED);
        move_to(account, GoalBook {
            next_goal_id: 0,
            goals: vector::empty<Goal>(),
            created_events: event::new_event_handle<GoalCreatedEvent>(account),
            resolved_events: event::new_event_handle<GoalResolvedEvent>(account),
            reward_events: event::new_event_handle<RewardDistributedEvent>(account),
            oracle,
        });
        move_to(account, RewardPool { balance: 0 });
    }

    public entry fun create_goal(
        owner: &signer,
        title: vector<u8>,
        metric: vector<u8>,
        target_value: u64,
        deadline_secs: u64,
        stake_amount: u64,
        reward_multiplier_bps: u64,
    ) acquires GoalBook {
        let owner_address = signer::address_of(owner);
        assert!(stake_amount > 0, E_INVALID_STAKE);
        assert!(exists<GoalBook>(owner_address), E_NOT_INITIALIZED);

        let book = borrow_global_mut<GoalBook>(owner_address);
        let goal = Goal {
            goal_id: book.next_goal_id,
            owner: owner_address,
            title,
            metric,
            target_value,
            deadline_secs,
            stake_amount,
            reward_multiplier_bps,
            locked_amount: stake_amount,
            payout_amount: 0,
            progress: 0,
            status: STATUS_LOCKED,
            outcome: OUTCOME_PENDING,
            settled: false,
            claimed: false,
        };

        vector::push_back(&mut book.goals, goal);
        event::emit_event(
            &mut book.created_events,
            GoalCreatedEvent {
                goal_id: book.next_goal_id,
                owner: owner_address,
                stake_amount,
                target_value,
            },
        );
        book.next_goal_id = book.next_goal_id + 1;
    }

    public entry fun update_progress(
        owner: &signer,
        goal_id: u64,
        progress: u64,
    ) acquires GoalBook {
        let owner_address = signer::address_of(owner);
        assert!(exists<GoalBook>(owner_address), E_NOT_INITIALIZED);
        let book = borrow_global_mut<GoalBook>(owner_address);
        let goal = borrow_goal_mut(&mut book.goals, goal_id);
        assert!(goal.owner == owner_address, E_NOT_OWNER);
        assert!(!goal.settled, E_ALREADY_SETTLED);
        goal.progress = progress;
    }

    public entry fun resolve_goal(
        oracle: &signer,
        owner: address,
        goal_id: u64,
        actual_value: u64,
    ) acquires GoalBook {
        let oracle_address = signer::address_of(oracle);
        assert!(exists<GoalBook>(owner), E_NOT_INITIALIZED);
        let book = borrow_global_mut<GoalBook>(owner);
        assert!(book.oracle == oracle_address, E_NOT_ORACLE);

        let goal = borrow_goal_mut(&mut book.goals, goal_id);
        assert!(!goal.settled, E_ALREADY_SETTLED);

        goal.settled = true;
        goal.status = STATUS_RESOLVED;
        goal.outcome = if (actual_value >= goal.target_value) { OUTCOME_SUCCESS } else { OUTCOME_FAILURE };

        if (goal.outcome == OUTCOME_SUCCESS) {
            goal.payout_amount = goal.stake_amount * goal.reward_multiplier_bps / 10000;
        } else {
            goal.payout_amount = 0;
        };

        event::emit_event(
            &mut book.resolved_events,
            GoalResolvedEvent {
                goal_id,
                owner,
                actual_value,
                payout_amount: goal.payout_amount,
                success: goal.outcome == OUTCOME_SUCCESS,
            },
        );
    }

    public entry fun claim_reward(owner: &signer, goal_id: u64) acquires GoalBook, RewardPool {
        let owner_address = signer::address_of(owner);
        assert!(exists<GoalBook>(owner_address), E_NOT_INITIALIZED);
        assert!(exists<RewardPool>(owner_address), E_NOT_INITIALIZED);

        let book = borrow_global_mut<GoalBook>(owner_address);
        let pool = borrow_global_mut<RewardPool>(owner_address);
        let goal = borrow_goal_mut(&mut book.goals, goal_id);
        assert!(goal.owner == owner_address, E_NOT_OWNER);
        assert!(goal.settled, E_ALREADY_SETTLED);
        assert!(!goal.claimed, E_ALREADY_CLAIMED);

        if (goal.outcome == OUTCOME_SUCCESS) {
            if (pool.balance >= goal.payout_amount) {
                pool.balance = pool.balance - goal.payout_amount;
            } else {
                pool.balance = 0;
            };
        } else {
            pool.balance = pool.balance + goal.stake_amount;
        };

        goal.claimed = true;
        event::emit_event(
            &mut book.reward_events,
            RewardDistributedEvent {
                recipient: owner_address,
                amount: goal.payout_amount,
                reason: if (goal.outcome == OUTCOME_SUCCESS) { b"goal_success" } else { b"goal_failure" },
            },
        );
    }

    public entry fun fund_reward_pool(admin: &signer, amount: u64) acquires RewardPool {
        let admin_address = signer::address_of(admin);
        assert!(exists<RewardPool>(admin_address), E_NOT_INITIALIZED);
        let pool = borrow_global_mut<RewardPool>(admin_address);
        pool.balance = pool.balance + amount;
    }

    fun borrow_goal_mut(goals: &mut vector<Goal>, goal_id: u64): &mut Goal {
        let len = vector::length(goals);
        let mut index = 0;
        while (index < len) {
            let goal_ref = vector::borrow_mut(goals, index);
            if (goal_ref.goal_id == goal_id) {
                return goal_ref;
            };
            index = index + 1;
        };
        abort E_GOAL_NOT_FOUND
    }
}
