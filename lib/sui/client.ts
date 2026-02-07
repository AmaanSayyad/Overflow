/**
 * Sui SDK Integration Module
 * 
 * This module provides functions for interacting with the Sui blockchain,
 * including client initialization, transaction building, and execution.
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { getSuiConfig } from './config';
import { logTransactionError, logInfo } from '@/lib/logging/error-logger';

// Singleton Sui client instance
let suiClient: SuiClient | null = null;

/**
 * Get or create a Sui client instance
 * Uses singleton pattern to reuse the same client across the application
 * 
 * @returns {SuiClient} The Sui client instance
 */
export function getSuiClient(): SuiClient {
  if (!suiClient) {
    const config = getSuiConfig();
    suiClient = new SuiClient({ url: config.rpcEndpoint });
  }
  return suiClient;
}

/**
 * Build a deposit transaction
 * Creates a transaction that deposits USDC to the treasury contract
 * 
 * @param {number} amount - The amount of USDC to deposit (in USDC units, e.g., 1.5 for 1.5 USDC)
 * @param {string} userAddress - The user's Sui address
 * @returns {Transaction} The transaction block ready to be signed and executed
 */
export async function buildDepositTransaction(
  amount: number,
  userAddress: string
): Promise<Transaction> {
  const config = getSuiConfig();
  const client = getSuiClient();
  const tx = new Transaction();
  
  // Convert amount to smallest unit (USDC has 6 decimals)
  const amountInSmallestUnit = Math.floor(amount * 1_000_000);
  
  // Get user's USDC coins
  const coins = await client.getCoins({
    owner: userAddress,
    coinType: config.usdcType,
  });
  
  if (coins.data.length === 0) {
    throw new Error('No USDC coins found in wallet');
  }
  
  // Calculate total balance
  const totalBalance = coins.data.reduce((sum, coin) => sum + parseInt(coin.balance), 0);
  
  if (totalBalance < amountInSmallestUnit) {
    throw new Error(`Insufficient USDC balance. Have: ${totalBalance / 1_000_000}, Need: ${amount}`);
  }
  
  // If we have multiple coins, merge them first
  let primaryCoin = tx.object(coins.data[0].coinObjectId);
  
  if (coins.data.length > 1) {
    // Merge all other coins into the first one
    const otherCoins = coins.data.slice(1).map(coin => tx.object(coin.coinObjectId));
    tx.mergeCoins(primaryCoin, otherCoins);
  }
  
  // Split the required amount from the merged coin
  const [coin] = tx.splitCoins(
    primaryCoin,
    [tx.pure.u64(amountInSmallestUnit)]
  );
  
  // Call treasury deposit function
  tx.moveCall({
    target: `${config.treasuryPackageId}::treasury::deposit`,
    arguments: [
      tx.object(config.treasuryObjectId), // treasury object
      coin, // payment coin
    ],
    typeArguments: [config.usdcType],
  });
  
  tx.setSender(userAddress);
  
  return tx;
}

/**
 * Build a withdrawal transaction
 * Creates a transaction that withdraws USDC from the treasury contract
 * 
 * @param {number} amount - The amount of USDC to withdraw (in USDC units, e.g., 1.5 for 1.5 USDC)
 * @param {string} userAddress - The user's Sui address
 * @returns {Transaction} The transaction block ready to be signed and executed
 */
export function buildWithdrawalTransaction(
  amount: number,
  userAddress: string
): Transaction {
  const config = getSuiConfig();
  const tx = new Transaction();
  
  // Convert amount to smallest unit (USDC has 6 decimals)
  const amountInSmallestUnit = Math.floor(amount * 1_000_000);
  
  // Call treasury withdraw function
  tx.moveCall({
    target: `${config.treasuryPackageId}::treasury::withdraw`,
    arguments: [
      tx.object(config.treasuryObjectId), // treasury object
      tx.pure.u64(amountInSmallestUnit), // amount to withdraw
    ],
    typeArguments: [config.usdcType],
  });
  
  tx.setSender(userAddress);
  
  return tx;
}

/**
 * Execute a transaction using the connected wallet
 * 
 * Error handling:
 * - Insufficient gas: Thrown when user doesn't have enough SUI for gas
 * - Insufficient balance: Thrown when user doesn't have enough USDC
 * - User rejection: Thrown when user cancels transaction
 * - Network timeout: Thrown when transaction times out
 * 
 * Requirements: 2.5, 3.6, 14.2
 * 
 * @param {Transaction} tx - The transaction to execute
 * @param {any} signAndExecuteTransaction - The wallet's signAndExecuteTransaction function from @mysten/dapp-kit
 * @returns {Promise<any>} The transaction result
 * @throws {Error} If transaction execution fails
 */
export async function executeTransaction(
  tx: Transaction,
  signAndExecuteTransaction: any
): Promise<any> {
  try {
    const result = await signAndExecuteTransaction(
      {
        transaction: tx,
      },
      {
        onSuccess: (result: any) => {
          console.log('Transaction executed successfully:', result.digest);
          logInfo('transaction', 'transaction_success', { digest: result.digest });
        },
        onError: (error: any) => {
          console.error('Transaction execution failed:', error);
          logTransactionError('transaction_failed', error, {});
          throw handleTransactionError(error);
        },
      }
    );
    
    return result;
  } catch (error) {
    console.error('Failed to execute transaction:', error);
    logTransactionError('transaction_exception', error, {});
    throw handleTransactionError(error);
  }
}

/**
 * Get USDC balance for a given address
 * 
 * @param {string} address - The Sui address to query
 * @returns {Promise<number>} The USDC balance in USDC units (e.g., 1.5 for 1.5 USDC)
 */
export async function getUSDCBalance(address: string): Promise<number> {
  const client = getSuiClient();
  const config = getSuiConfig();
  
  try {
    const balance = await client.getBalance({
      owner: address,
      coinType: config.usdcType,
    });
    
    // Convert from smallest unit to USDC (6 decimals)
    return parseInt(balance.totalBalance) / 1_000_000;
  } catch (error) {
    console.error('Failed to get USDC balance:', error);
    return 0;
  }
}

/**
 * Get treasury balance
 * 
 * @returns {Promise<number>} The treasury balance in USDC units
 */
export async function getTreasuryBalance(): Promise<number> {
  const client = getSuiClient();
  const config = getSuiConfig();
  
  try {
    const treasuryObject = await client.getObject({
      id: config.treasuryObjectId,
      options: {
        showContent: true,
      },
    });
    
    if (treasuryObject.data?.content?.dataType === 'moveObject') {
      const fields = treasuryObject.data.content.fields as any;
      const balance = fields.balance || 0;
      
      // Convert from smallest unit to USDC (6 decimals)
      return parseInt(balance) / 1_000_000;
    }
    
    return 0;
  } catch (error) {
    console.error('Failed to get treasury balance:', error);
    return 0;
  }
}

/**
 * Handle transaction errors and convert to user-friendly messages
 * 
 * Requirements: 2.5, 3.6, 14.2, 14.3
 * 
 * @param {any} error - The error from transaction execution
 * @returns {Error} A new error with user-friendly message
 */
function handleTransactionError(error: any): Error {
  const errorMessage = error?.message?.toLowerCase() || '';
  
  // User rejection
  if (
    errorMessage.includes('rejected') ||
    errorMessage.includes('denied') ||
    errorMessage.includes('cancelled') ||
    errorMessage.includes('user rejected') ||
    error?.code === 4001 ||
    error?.code === 'USER_REJECTED'
  ) {
    return new Error('Transaction was cancelled by user.');
  }
  
  // Insufficient gas (SUI)
  if (
    errorMessage.includes('insufficient gas') ||
    errorMessage.includes('insufficient sui') ||
    errorMessage.includes('gas budget') ||
    errorMessage.includes('not enough gas')
  ) {
    return new Error('Insufficient SUI for gas fees. Please add SUI to your wallet.');
  }
  
  // Insufficient USDC balance
  if (
    errorMessage.includes('insufficient balance') ||
    errorMessage.includes('insufficient funds') ||
    errorMessage.includes('insufficient coin') ||
    errorMessage.includes('not enough balance')
  ) {
    return new Error('Insufficient USDC balance for this transaction.');
  }
  
  // Network timeout
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out') ||
    errorMessage.includes('network') ||
    error?.code === 'NETWORK_ERROR' ||
    error?.code === 'TIMEOUT'
  ) {
    return new Error('Transaction timed out. Please check your network connection and try again.');
  }
  
  // Contract execution failure
  if (
    errorMessage.includes('execution failed') ||
    errorMessage.includes('move abort') ||
    errorMessage.includes('assertion failed')
  ) {
    return new Error('Transaction failed during execution. Please try again or contact support.');
  }
  
  // Generic error
  if (error instanceof Error) {
    return new Error(`Transaction failed: ${error.message}`);
  }
  
  return new Error('Transaction failed. Please try again.');
}
