/// Treasury module for managing USDC deposits and withdrawals
/// This contract allows users to deposit and withdraw USDC tokens
/// and emits events for all operations.
module overflow::treasury {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;

    // ===== Error Codes =====
    
    /// Error when withdrawal amount exceeds available balance
    const EInsufficientBalance: u64 = 0;
    
    /// Error when deposit amount is zero
    const EZeroAmount: u64 = 1;

    // ===== Structs =====

    /// Treasury object holding USDC balance
    /// This is a shared object that can be accessed by all users
    public struct Treasury<phantom T> has key {
        id: UID,
        balance: Balance<T>
    }

    /// Event emitted when a user deposits USDC
    public struct DepositEvent has copy, drop {
        user: address,
        amount: u64,
        timestamp: u64
    }

    /// Event emitted when a user withdraws USDC
    public struct WithdrawalEvent has copy, drop {
        user: address,
        amount: u64,
        timestamp: u64
    }

    // ===== Public Functions =====

    /// Create and share a new treasury for a specific coin type
    /// This should be called after deployment to initialize the treasury
    public entry fun create_treasury<T>(ctx: &mut TxContext) {
        let treasury = Treasury<T> {
            id: object::new(ctx),
            balance: balance::zero()
        };
        transfer::share_object(treasury);
    }

    /// Initialize the treasury (called once during deployment)
    /// Creates a shared Treasury object
    /// Note: The actual USDC type will be specified during deployment
    #[allow(unused_function)]
    fun init(ctx: &mut TxContext) {
        // This init function is a placeholder
        // The actual treasury will be created with the specific USDC type
        // using a separate initialization transaction
        let _ = ctx;
    }

    /// Deposit USDC to the treasury
    /// Accepts a Coin<USDC> and adds it to the treasury balance
    /// Emits a DepositEvent
    public entry fun deposit<T>(
        treasury: &mut Treasury<T>,
        payment: Coin<T>,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&payment);
        
        // Validate amount is greater than zero
        assert!(amount > 0, EZeroAmount);
        
        // Add the coin to the treasury balance
        let coin_balance = coin::into_balance(payment);
        balance::join(&mut treasury.balance, coin_balance);
        
        // Emit deposit event
        event::emit(DepositEvent {
            user: tx_context::sender(ctx),
            amount,
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });
    }

    /// Withdraw USDC from the treasury
    /// Takes an amount and returns a Coin<USDC> to the caller
    /// Emits a WithdrawalEvent
    public entry fun withdraw<T>(
        treasury: &mut Treasury<T>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // Validate amount is greater than zero
        assert!(amount > 0, EZeroAmount);
        
        // Validate treasury has sufficient balance
        assert!(balance::value(&treasury.balance) >= amount, EInsufficientBalance);
        
        // Split the requested amount from treasury balance
        let withdrawn_balance = balance::split(&mut treasury.balance, amount);
        let withdrawn_coin = coin::from_balance(withdrawn_balance, ctx);
        
        // Transfer the coin to the sender
        transfer::public_transfer(withdrawn_coin, tx_context::sender(ctx));
        
        // Emit withdrawal event
        event::emit(WithdrawalEvent {
            user: tx_context::sender(ctx),
            amount,
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });
    }

    // ===== View Functions =====

    /// Get the current balance of the treasury
    public fun get_balance<T>(treasury: &Treasury<T>): u64 {
        balance::value(&treasury.balance)
    }

    // ===== Test Functions =====

    #[test_only]
    /// Create a treasury for testing
    public fun create_treasury_for_testing<T>(ctx: &mut TxContext): Treasury<T> {
        Treasury {
            id: object::new(ctx),
            balance: balance::zero()
        }
    }

    #[test_only]
    /// Destroy a treasury for testing
    public fun destroy_treasury_for_testing<T>(treasury: Treasury<T>) {
        let Treasury { id, balance } = treasury;
        object::delete(id);
        balance::destroy_for_testing(balance);
    }
}
