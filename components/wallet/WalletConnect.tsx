'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { useWalletConnection } from '@/lib/sui/wallet';
import { ConnectButton, useWallets } from '@mysten/dapp-kit';
import { Button } from '@/components/ui/Button';

export const WalletConnect: React.FC = () => {
  const isConnected = useStore((state) => state.isConnected);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const { connect } = useWalletConnection();
  const wallets = useWallets();

  // Don't show anything when connected (disconnect is in bottom panel now)
  if (isConnected) {
    return null;
  }

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      await connect();
    } catch (err) {
      console.error('Wallet connection error:', err);
      
      // The error is already formatted by handleWalletError in wallet.ts
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to connect wallet. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Use dapp-kit's ConnectButton for better wallet selection UI */}
      <ConnectButton
        className="text-[10px] sm:text-sm px-2 sm:px-4 py-1 sm:py-2 h-auto"
        connectText={isConnecting ? 'Connecting...' : 'Connect Sui Wallet'}
      />

      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
      
      {/* Show available wallets count for debugging */}
      {!isConnected && wallets.length > 0 && (
        <p className="text-gray-400 text-xs">
          {wallets.length} Sui wallet{wallets.length !== 1 ? 's' : ''} available
        </p>
      )}
    </div>
  );
};
