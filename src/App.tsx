import { useState, useEffect } from 'react';
import TrendSection from './components/TrendSection';
import { DashboardsSection } from './components/DashboardsSection';
import { ConnectWallet } from './components/ConnectWallet';
import { initializeIrysUploader } from './services/irysUploadService';
import { fetchIrysName } from './services/irysService';
import { getCachedData, saveCacheData, isCacheValid } from './services/storageService';
import { APP_PRESETS } from './constants/appPresets';
import { queryTagCounts } from './services/irysService';
import type { QueryResult } from './types';

function App() {
  const [activeTab, setActiveTab] = useState('trends');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<{ [key: string]: QueryResult[] }>({});

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
          // Fetch data for all presets
          const allProjectIds = APP_PRESETS.map(preset => preset.id);
          const results: { [key: string]: QueryResult[] } = {};
          
          for (const projectId of allProjectIds) {
            const preset = APP_PRESETS.find(p => p.id === projectId);
            if (preset) {
              console.log(`[App] Fetching background data for ${preset.name}...`);
              const projectResults = await queryTagCounts(preset.tags, undefined, { months: 6 });
              results[projectId] = projectResults;
            }
          }
          
          // Save to cache
          saveCacheData(results);
          setTrendData(results);
          console.log('[App] Background data update completed');
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
      {/* Animated cloud background */}
      <div className="cloud-background">
        <div className="cloud cloud-1"></div>
        <div className="cloud cloud-2"></div>
        <div className="cloud cloud-3"></div>
      </div>

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
      <nav className="nav">
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
        </div>
      </nav>

      {/* Main Content */}
      <main className="main">
        <div className="container">
          {activeTab === 'trends' && <TrendSection onDataUpdate={setTrendData} />}
          {activeTab === 'dashboards' && <DashboardsSection walletAddress={walletAddress} username={username} trendData={trendData} />}
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
