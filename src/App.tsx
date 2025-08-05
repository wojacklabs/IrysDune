import { useState, useEffect } from 'react';
import TrendSection from './components/TrendSection';
import { DashboardsSection } from './components/DashboardsSection';
import MyHistorySection from './components/MyHistorySection';
import BadgesSection from './components/BadgesSection';
import CloudBackground from './components/CloudBackground';
import { ConnectWallet } from './components/ConnectWallet';
import { initializeIrysUploader } from './services/irysUploadService';
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

  // Apply weather state class to body
  useEffect(() => {
    if (weatherState === 'stormy') {
      document.body.classList.add('weather-stormy');
    } else {
      document.body.classList.remove('weather-stormy');
    }
  }, [weatherState]);

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
    
    // Pre-initialize Irys uploader on app mount if wallet is already connected
    const checkAndInitUploader = async () => {
      const ethereum = window.ethereum || window.okxwallet || (window.web3 && window.web3.currentProvider);
      if (ethereum) {
        try {
          const accounts = await ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            console.log('[App] Pre-initializing Irys uploader on mount...');
            initializeIrysUploader().catch(err => {
              console.error('[App] Failed to pre-initialize Irys uploader:', err);
            });
          }
        } catch (err) {
          console.error('[App] Error checking wallet accounts:', err);
        }
      }
    };
    
    checkAndInitUploader();
  }, []);

  const handleWalletConnect = async (address: string) => {
    console.log('[App] Wallet connected:', address);
    setWalletAddress(address);
    
    // Pre-initialize Irys uploader in the background
    initializeIrysUploader().then(uploader => {
      if (uploader) {
        console.log('[App] Irys uploader pre-initialized successfully');
      }
    }).catch(err => {
      console.error('[App] Failed to pre-initialize Irys uploader:', err);
    });
    
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
    
    // Initialize Irys uploader when wallet connects
    try {
      console.log('[App] Initializing Irys uploader...');
      const uploader = await initializeIrysUploader();
      if (uploader) {
        console.log('[App] Irys uploader ready for uploads');
      } else {
        console.warn('[App] Irys uploader initialization failed - uploads will be unavailable');
      }
    } catch (error) {
      console.error('[App] Error during Irys initialization:', error);
    }
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
          <div className="header-right">
            {/* Weather Toggle */}
            <button
              onClick={() => setWeatherState(prev => prev === 'clear' ? 'stormy' : 'clear')}
              className="weather-toggle"
              title={weatherState === 'clear' ? 'Switch to stormy' : 'Switch to clear'}
            >
              {weatherState === 'clear' ? '☀️' : '⛈️'}
            </button>
            {/* Background Toggle */}
            <button
              onClick={() => setFullscreenBackground(prev => !prev)}
              className="background-toggle"
              title={fullscreenBackground ? 'Show interface' : 'View background only'}
            >
              {fullscreenBackground ? '🏞️' : '📈'}
            </button>
            <ConnectWallet 
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
              walletAddress={walletAddress}
              username={username}
            />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className={`nav ${fullscreenBackground ? 'hidden' : ''}`}>
        <div className="nav-content">
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
      </nav>

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
