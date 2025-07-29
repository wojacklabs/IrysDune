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
    // Check for various wallet providers
    let provider = null;
    
    if (typeof window.ethereum !== 'undefined') {
      provider = window.ethereum;
    } else if (typeof (window as any).okxwallet !== 'undefined') {
      provider = (window as any).okxwallet;
    } else if (typeof (window as any).web3 !== 'undefined' && (window as any).web3.currentProvider) {
      provider = (window as any).web3.currentProvider;
    }
    
    if (provider) {
      try {
        const ethersProvider = new ethers.BrowserProvider(provider);
        const accounts = await ethersProvider.listAccounts();
        if (accounts.length > 0) {
          const addr = accounts[0].address;
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
    // Check for various wallet providers
    let provider = null;
    
    // Give wallets time to inject their providers
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check for different wallet providers in order of preference
    if (typeof window.ethereum !== 'undefined') {
      provider = window.ethereum;
    } else if (typeof (window as any).okxwallet !== 'undefined') {
      provider = (window as any).okxwallet;
    } else if (typeof (window as any).web3 !== 'undefined' && (window as any).web3.currentProvider) {
      provider = (window as any).web3.currentProvider;
    }
    
    if (!provider) {
      alert('Please install MetaMask, OKX Wallet, or another Ethereum wallet');
      return;
    }

    setIsConnecting(true);
    try {
      const ethersProvider = new ethers.BrowserProvider(provider);
      
      // Request account access
      if (provider.request) {
        await provider.request({ method: 'eth_requestAccounts' });
      } else {
        await ethersProvider.send("eth_requestAccounts", []);
      }
      
      const signer = await ethersProvider.getSigner();
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
      return username + ".irys"
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