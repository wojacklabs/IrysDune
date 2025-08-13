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
  const [currentChainId, setCurrentChainId] = useState<string | null>(null);

  useEffect(() => {
    // Check for saved wallet and connection on mount
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
      checkConnection(savedAddress);
    } else {
      checkConnection();
    }
    
    // Setup wallet event listeners
    setupWalletListeners();
    
    // Cleanup on unmount
    return () => {
      removeWalletListeners();
    };
  }, []);

  useEffect(() => {
    // Update connection state based on props
    if (walletAddress) {
      setIsConnected(true);
      setAddress(walletAddress);
      localStorage.setItem('walletAddress', walletAddress);
    } else {
      setIsConnected(false);
      setAddress('');
      localStorage.removeItem('walletAddress');
    }
  }, [walletAddress]);

  const setupWalletListeners = () => {
    const provider = window.ethereum || (window as any).okxwallet || ((window as any).web3 && (window as any).web3.currentProvider);
    
    if (provider && provider.on) {
      // Listen for account changes
      provider.on('accountsChanged', handleAccountsChanged);
      
      // Listen for chain changes
      provider.on('chainChanged', handleChainChanged);
      
      // Listen for disconnection
      provider.on('disconnect', handleDisconnect);
      
      console.log('[ConnectWallet] Wallet event listeners set up');
    }
  };

  const removeWalletListeners = () => {
    const provider = window.ethereum || (window as any).okxwallet || ((window as any).web3 && (window as any).web3.currentProvider);
    
    if (provider && provider.removeListener) {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
      provider.removeListener('disconnect', handleDisconnect);
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    console.log('[ConnectWallet] Accounts changed:', accounts);
    
    if (accounts.length === 0) {
      // User disconnected wallet
      disconnectWallet();
    } else if (accounts[0] !== address) {
      // User switched accounts
      const newAddress = accounts[0];
      setAddress(newAddress);
      setIsConnected(true);
      onConnect(newAddress);
      localStorage.setItem('walletAddress', newAddress);
    }
  };

  const handleChainChanged = async (chainId: string) => {
    console.log('[ConnectWallet] Chain changed to:', chainId);
    
    // Update the current chain ID
    setCurrentChainId(chainId);
    
    // Convert chainId to network name for better logging
    const networkNames: { [key: string]: string } = {
      '0x1': 'Ethereum Mainnet',
      '0x89': 'Polygon',
      '0xa4b1': 'Arbitrum',
      '0xa86a': 'Avalanche',
      '0x2105': 'Base',
      '0x4f6': 'Irys Testnet',
      '0x4F6': 'Irys Testnet'
    };
    
    const networkName = networkNames[chainId] || networkNames[chainId.toUpperCase()] || `Unknown (${chainId})`;
    console.log('[ConnectWallet] Switched to network:', networkName);
    
    // Verify the connection is still valid
    // This allows the user to continue their work without interruption
    await checkConnection();
    
    // Emit a custom event for other components to listen to
    window.dispatchEvent(new CustomEvent('chainChanged', { 
      detail: { 
        chainId,
        networkName 
      } 
    }));
  };

  const handleDisconnect = () => {
    console.log('[ConnectWallet] Wallet disconnected');
    disconnectWallet();
  };

  const checkConnection = async (savedAddress?: string) => {
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
        
        // Get current chain ID
        const network = await ethersProvider.getNetwork();
        const chainId = `0x${network.chainId.toString(16)}`;
        setCurrentChainId(chainId);
        console.log('[ConnectWallet] Current chain ID:', chainId, 'Network:', network.name);
        
        if (accounts.length > 0) {
          const addr = accounts[0].address;
          
          // Check if the connected address matches saved address
          if (savedAddress && addr.toLowerCase() !== savedAddress.toLowerCase()) {
            console.log('[ConnectWallet] Connected address differs from saved address');
            localStorage.removeItem('walletAddress');
            return;
          }
          
          setAddress(addr);
          setIsConnected(true);
          onConnect(addr);
          localStorage.setItem('walletAddress', addr);
        } else if (savedAddress) {
          // Saved address exists but wallet is not connected
          console.log('[ConnectWallet] Saved address found but wallet not connected');
          localStorage.removeItem('walletAddress');
        }
      } catch (error) {
        console.error('Error checking connection:', error);
        if (savedAddress) {
          localStorage.removeItem('walletAddress');
        }
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
      localStorage.setItem('walletAddress', addr);
      
      // Re-setup listeners after connection
      setupWalletListeners();
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
    localStorage.removeItem('walletAddress');
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

  // Get network name from chain ID
  const getNetworkName = () => {
    if (!currentChainId) return '';
    const networkNames: { [key: string]: string } = {
      '0x1': 'Ethereum',
      '0x89': 'Polygon',
      '0xa4b1': 'Arbitrum',
      '0xa86a': 'Avalanche',
      '0x2105': 'Base',
      '0x4f6': 'Irys Testnet',
      '0x4F6': 'Irys Testnet'
    };
    return networkNames[currentChainId] || networkNames[currentChainId.toUpperCase()] || 'Unknown';
  };

  return (
    <div className="connect-wallet">
      {isConnected ? (
        <div className="wallet-info">
          <span className="wallet-address">{getDisplayName()}</span>
          {currentChainId && (
            <span className="network-badge" style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '8px' }}>
              {getNetworkName()}
            </span>
          )}
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