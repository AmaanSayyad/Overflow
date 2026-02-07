/**
 * Wallet state slice for Zustand store
 * Manages wallet connection, authentication, and balance
 * 
 * Note: This slice is now primarily used for storing wallet state.
 * Actual wallet connection is handled by @mysten/dapp-kit in lib/sui/wallet.ts
 */

import { StateCreator } from "zustand";

export interface WalletState {
  // State
  address: string | null;
  balance: string;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  clearError: () => void;

  // Setters for Sui wallet integration
  setAddress: (address: string | null) => void;
  setIsConnected: (connected: boolean) => void;
}

/**
 * Create wallet slice for Zustand store
 * Handles wallet state management for Sui integration
 */
export const createWalletSlice: StateCreator<WalletState> = (set, get) => ({
  // Initial state
  address: null,
  balance: "0.0",
  isConnected: false,
  isConnecting: false,
  error: null,

  /**
   * Connect wallet
   * Note: Actual connection is handled by @mysten/dapp-kit
   * This is kept for compatibility with existing code
   */
  connect: async () => {
    // Connection is handled by useWalletConnection hook in lib/sui/wallet.ts
    console.log('Connect called - handled by dapp-kit');
  },

  /**
   * Disconnect wallet
   * Note: Actual disconnection is handled by @mysten/dapp-kit
   * This is kept for compatibility with existing code
   */
  disconnect: () => {
    // Disconnection is handled by useWalletConnection hook in lib/sui/wallet.ts
    console.log('Disconnect called - handled by dapp-kit');
    
    // Reset state
    set({
      address: null,
      balance: "0.0",
      isConnected: false,
      isConnecting: false,
      error: null
    });
  },

  /**
   * Refresh USDC token balance for connected wallet
   * Note: Balance fetching is handled by getUSDCBalance in lib/sui/client.ts
   */
  refreshBalance: async () => {
    const { address, isConnected } = get();

    if (!isConnected || !address) {
      return;
    }

    try {
      // Balance is fetched by components using getUSDCBalance from lib/sui/client.ts
      console.log('Balance refresh - handled by components');
    } catch (error) {
      console.error("Error refreshing balance:", error);
      set({
        error: error instanceof Error ? error.message : "Failed to refresh balance"
      });
    }
  },

  /**
   * Clear error message
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * Set address (used by Sui wallet integration)
   */
  setAddress: (address: string | null) => {
    set({ address });
  },

  /**
   * Set connected status (used by Sui wallet integration)
   */
  setIsConnected: (connected: boolean) => {
    set({ isConnected: connected });
  }
});
