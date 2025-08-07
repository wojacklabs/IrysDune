import { useState, useEffect, useRef } from 'react';
import TrendSection from './components/TrendSection';
import { DashboardsSection } from './components/DashboardsSection';
import MyHistorySection from './components/MyHistorySection';
import BadgesSection from './components/BadgesSection';
import CloudBackground from './components/CloudBackground';
import { ConnectWallet } from './components/ConnectWallet';

import { fetchIrysName } from './services/irysService';
import { getCachedData, saveCacheData, isCacheValid } from './services/storageService';
import { fetchAllProjectsData } from './services/dataService';
import type { QueryResult } from './types';

function App() {
  const [activeTab, setActiveTab] = useState('trends');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<{ [key: string]: QueryResult[] }>({});
  const [weatherState, setWeatherState] = useState<'clear' | 'stormy'>('clear');
  const [fullscreenBackground, setFullscreenBackground] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Log dropdown state changes
  useEffect(() => {
    console.log('[Dropdown] State changed to:', dropdownOpen);
  }, [dropdownOpen]);

  // Apply weather state class to body
  useEffect(() => {
    if (weatherState === 'stormy') {
      document.body.classList.add('weather-stormy');
    } else {
      document.body.classList.remove('weather-stormy');
    }
  }, [weatherState]);

  // Close dropdown when clicking outside
  useEffect(() => {
    console.log('[Dropdown] Setting up click outside handler');
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        console.log('[Dropdown] Clicked outside, closing dropdown');
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Background data loading on app mount
  useEffect(() => {
    const loadBackgroundData = async () => {
      console.log('[App] Checking for background data update...');
      
      // Check if cache exists and is valid
      const cachedData = getCachedData();
      const cacheValid = isCacheValid();
      
      if (cachedData) {
        // Use cached data immediately
        setTrendData(cachedData);
        console.log('[App] Using cached data for immediate display');
      }
      
      // If cache is invalid or doesn't exist, fetch in background
      if (!cacheValid) {
        console.log('[App] Cache is invalid or missing, fetching fresh data in background...');
        
        try {
          // Fetch data from mutable addresses (complete dataset)
          console.log('[App] Fetching complete data from mutable addresses...');
          const results = await fetchAllProjectsData();
          
          // Save to cache
          saveCacheData(results);
          setTrendData(results);
          console.log('[App] Background data update completed with full dataset');
        } catch (error) {
          console.error('[App] Error loading background data:', error);
        }
      }
    };
    
    loadBackgroundData();
  }, []);

  const handleWalletConnect = async (address: string) => {
    console.log('[App] Wallet connected:', address);
    setWalletAddress(address);
    
    // Skip pre-initialization to avoid unwanted signatures
    
    // Fetch Irys Name for the wallet
    try {
      const irysName = await fetchIrysName(address);
      if (irysName) {
        console.log('[App] Found Irys Name:', irysName);
        setUsername(irysName);
      } else {
        console.log('[App] No Irys Name found for wallet');
        setUsername(null);
      }
    } catch (error) {
      console.error('[App] Error fetching Irys Name:', error);
      setUsername(null);
    }
    
    // Skip Irys initialization on wallet connect to avoid unwanted signatures
  };

  const handleWalletDisconnect = () => {
    setWalletAddress(null);
    setUsername(null);
  };

  return (
    <div className="app">
      {/* Three.js cloud background */}
      <CloudBackground weatherState={weatherState} />

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo">
              <div className="logo-icon">
                <svg viewBox="0 0 100 60" width="45" height="27">
                  <g className="cloud-group">
                    {/* Cloud outline */}
                    <path 
                      d="M 75 40 
                         C 80 40, 84 36, 84 31
                         C 84 26, 80 22, 75 22
                         C 74 16, 68 12, 61 12
                         C 56 12, 52 14, 49 17
                         C 46 13, 41 10, 35 10
                         C 27 10, 20 17, 20 25
                         C 20 26, 20 27, 21 28
                         C 17 29, 14 33, 14 37
                         C 14 42, 18 46, 23 46
                         L 70 46
                         C 73 46, 75 44, 75 41
                         Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Left eye */}
                    <circle cx="35" cy="30" r="2" fill="currentColor" />
                    {/* Right eye */}
                    <circle cx="55" cy="30" r="2" fill="currentColor" />
                    {/* Cute smile */}
                    <path 
                      d="M 40 35 Q 45 38, 50 35"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </g>
                </svg>
              </div>
              <h1>IrysDune</h1>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <div className="header-nav">
            <button
              onClick={() => setActiveTab('trends')}
              className={`nav-button ${activeTab === 'trends' ? 'active' : ''}`}
            >
              Trends
            </button>
            <button
              onClick={() => setActiveTab('dashboards')}
              className={`nav-button ${activeTab === 'dashboards' ? 'active' : ''}`}
            >
              Dashboards
            </button>
            <button
              onClick={() => setActiveTab('badges')}
              className={`nav-button ${activeTab === 'badges' ? 'active' : ''}`}
            >
              Badges
            </button>
            <button
              onClick={() => setActiveTab('my-history')}
              className={`nav-button ${activeTab === 'my-history' ? 'active' : ''}`}
            >
              My History
            </button>
          </div>
          
          <div className="header-right">
            <div className="desktop-wallet">
              <ConnectWallet 
                onConnect={handleWalletConnect}
                onDisconnect={handleWalletDisconnect}
                walletAddress={walletAddress}
                username={username}
              />
            </div>
            
            {/* Dropdown Menu */}
            <div className="dropdown" ref={dropdownRef}>
              <button
                onClick={() => {
                  console.log('[Dropdown] Toggle clicked, current state:', dropdownOpen);
                  setDropdownOpen(!dropdownOpen);
                }}
                className="dropdown-toggle"
                aria-label="Settings menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              
              {dropdownOpen && (
                <div className="dropdown-menu">
                  {/* Mobile Navigation Section */}
                  <div className="mobile-nav-section">
                    <button
                      onClick={() => {
                        setActiveTab('trends');
                        setDropdownOpen(false);
                      }}
                      className={`mobile-nav-item ${activeTab === 'trends' ? 'active' : ''}`}
                    >
                      Trends
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('dashboards');
                        setDropdownOpen(false);
                      }}
                      className={`mobile-nav-item ${activeTab === 'dashboards' ? 'active' : ''}`}
                    >
                      Dashboards
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('badges');
                        setDropdownOpen(false);
                      }}
                      className={`mobile-nav-item ${activeTab === 'badges' ? 'active' : ''}`}
                    >
                      Badges
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('my-history');
                        setDropdownOpen(false);
                      }}
                      className={`mobile-nav-item ${activeTab === 'my-history' ? 'active' : ''}`}
                    >
                      My History
                    </button>
                  </div>
                  
                  <div className="dropdown-divider mobile-only"></div>
                  
                  {/* Mobile Wallet Section */}
                  <div className="mobile-wallet-section">
                    {walletAddress ? (
                      <div className="wallet-info">
                        <div className="wallet-status">
                          <span className="wallet-label">Connected</span>
                          <span className="wallet-address-mobile">
                            {username || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            handleWalletDisconnect();
                            setDropdownOpen(false);
                          }}
                          className="disconnect-btn-mobile"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          setDropdownOpen(false);
                          // Trigger wallet connection
                          const provider = window.ethereum || (window as any).okxwallet || (window as any).web3?.currentProvider;
                          if (!provider) {
                            alert('Please install a Web3 wallet');
                            return;
                          }
                          try {
                            const accounts = await provider.request({ method: 'eth_requestAccounts' });
                            if (accounts.length > 0) {
                              handleWalletConnect(accounts[0]);
                            }
                          } catch (error) {
                            console.error('Failed to connect wallet:', error);
                          }
                        }}
                        className="connect-btn-mobile"
                      >
                        🔗 Connect Wallet
                      </button>
                    )}
                  </div>
                  
                  <div className="dropdown-divider mobile-only"></div>
                  
                  <div className="dropdown-item">
                    <span>DarkMode</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={weatherState === 'stormy'}
                        onChange={(e) => setWeatherState(e.target.checked ? 'stormy' : 'clear')}
                      />
                      <span className="toggle-slider">
                      </span>
                    </label>
                  </div>
                  
                  <div className="dropdown-item">
                    <span>Background Mode</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={fullscreenBackground}
                        onChange={(e) => setFullscreenBackground(e.target.checked)}
                      />
                      <span className="toggle-slider">
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>



      {/* Main Content */}
      <main className={`main ${fullscreenBackground ? 'hidden' : ''}`}>
        <div className="container">
          {activeTab === 'trends' && <TrendSection onDataUpdate={setTrendData} />}
          {activeTab === 'dashboards' && <DashboardsSection walletAddress={walletAddress} username={username} trendData={trendData} />}
          {activeTab === 'my-history' && <MyHistorySection walletAddress={walletAddress} />}
          {activeTab === 'badges' && <BadgesSection walletAddress={walletAddress} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p>Built with ❤️ for the Irys Ecosystem</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
