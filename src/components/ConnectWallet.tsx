import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface ConnectWalletProps {
  onConnect: (address: string) => void;
  onDisconnect: () => void;
  walletAddress?: string | null;
  username?: string | null;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const ConnectWallet: React.FC<ConnectWalletProps> = ({ 
  onConnect, 
  onDisconnect, 
  walletAddress, 
  username 
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    // Update connection state based on props
    if (walletAddress) {
      setIsConnected(true);
      setAddress(walletAddress);
    } else {
      setIsConnected(false);
      setAddress('');
    }
  }, [walletAddress]);

  const checkConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          const signer = await provider.getSigner();
          const addr = await signer.getAddress();
          setAddress(addr);
          setIsConnected(true);
          onConnect(addr);
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask or another Ethereum wallet');
      return;
    }

    setIsConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      
      setAddress(addr);
      setIsConnected(true);
      onConnect(addr);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress('');
    setIsConnected(false);
    onDisconnect();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getDisplayName = () => {
    if (username) {
      return username;
    }
    return formatAddress(address);
  };

  return (
    <div className="connect-wallet">
      {isConnected ? (
        <div className="wallet-info">
          <span className="wallet-address">{getDisplayName()}</span>
          <button 
            onClick={disconnectWallet}
            className="disconnect-btn"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button 
          onClick={connectWallet}
          disabled={isConnecting}
          className="connect-btn"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
    </div>
  );
}; 