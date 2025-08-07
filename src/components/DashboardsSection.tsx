import React, { useState, useEffect, useRef } from 'react';
import type { Dashboard, DashboardFilter, QueryResult, LoadingProgress as LoadingProgressType } from '../types';
import Chart from './Chart';
import { generateChartData, generateShareText, filterDataByPeriod } from '../utils/chartUtils';
import { captureAndShare, downloadImage, captureElement } from '../utils/captureUtils';
import { 
  fetchDashboards, 
  toggleDashboardLike,
  debugFetchAllTransactions,
} from '../services/irysUploadService';
import { 
  getCachedData, 
  waitForCache, 
  saveDashboardData, 
  getCachedDashboardData,
  getCachedDashboards 
} from '../services/storageService';
import { queryTagCounts, fetchIrysNames } from '../services/irysService';
import LoadingProgress from './LoadingProgress';
import { CreateDashboardModal } from './CreateDashboardModal';
import { Share2, Download } from 'lucide-react';
import { APP_PRESETS } from '../constants/appPresets';
import { ON_CHAIN_PRESETS } from '../services/onChainService';

interface DashboardsSectionProps {
  walletAddress: string | null;
  username?: string | null;
  trendData?: { [key: string]: QueryResult[] };
}

export const DashboardsSection: React.FC<DashboardsSectionProps> = ({ walletAddress, username, trendData }) => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [filteredDashboards, setFilteredDashboards] = useState<Dashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [dashboardData, setDashboardData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const dashboardContentRef = useRef<HTMLDivElement>(null);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgressType | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [likedDashboards, setLikedDashboards] = useState<Set<string>>(new Set());
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [irysNames, setIrysNames] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<DashboardFilter>({
    sortBy: 'recent'
  });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Helper function to calculate dateRange for dashboard charts
  const processDashboardDateRanges = (dashboard: Dashboard): Dashboard => {
    return {
      ...dashboard,
      charts: dashboard.charts.map(chart => {
        if (!chart.dateRange && dashboard.createdAt) {
          const uploadDate = dashboard.createdAt;
          let startDate: number;
          
          switch (chart.timePeriod) {
            case 'week':
              startDate = uploadDate - 7 * 24 * 60 * 60 * 1000;
              break;
            case 'month':
              startDate = uploadDate - 30 * 24 * 60 * 60 * 1000;
              break;
            case 'quarter':
              startDate = uploadDate - 90 * 24 * 60 * 60 * 1000;
              break;
            case 'year':
              startDate = uploadDate - 365 * 24 * 60 * 60 * 1000;
              break;
            default:
              startDate = uploadDate - 30 * 24 * 60 * 60 * 1000;
          }
          
          return {
            ...chart,
            dateRange: {
              startDate,
              endDate: uploadDate
            }
          };
        }
        return chart;
      })
    };
  };

  useEffect(() => {
    loadDashboards();
  }, []);

  // Check liked status when wallet connects or dashboards change
  useEffect(() => {
    if (!walletAddress || dashboards.length === 0) return;
    
    // Use likedBy information already included in dashboards
    const liked = new Set<string>();
    for (const dashboard of dashboards) {
      if (dashboard.likedBy?.includes(walletAddress)) {
        liked.add(dashboard.id);
      }
    }
    setLikedDashboards(liked);
  }, [walletAddress, dashboards]);

  useEffect(() => {
    filterDashboards();
  }, [dashboards, filter, searchTerm]);

  const loadDashboards = async () => {
    console.log('[DashboardsSection] Loading dashboards...');
    setIsLoading(true);
    
    // Check cached dashboards first
    const cachedDashboards = getCachedDashboards();
    if (cachedDashboards && cachedDashboards.length > 0) {
      console.log('[DashboardsSection] Using cached dashboards');
      
      // Process dateRanges for cached dashboards
      const dashboardsWithDateRanges = cachedDashboards.map(processDashboardDateRanges);
      
      // Process liked status for cached dashboards
      const dashboardsWithStats = dashboardsWithDateRanges;
      setDashboards(dashboardsWithStats);
      
      // Fetch Irys Names for all authors
      fetchIrysNamesForDashboards(dashboardsWithStats);
      
      // Check liked status for cached dashboards if wallet is connected
      if (walletAddress) {
        const liked = new Set<string>();
        for (const dashboard of dashboardsWithStats) {
          if (dashboard.likedBy?.includes(walletAddress)) {
            liked.add(dashboard.id);
          }
        }
        setLikedDashboards(liked);
      }
      
      setIsLoading(false);
      
      // Still fetch in background to get updates
      fetchDashboards().then(data => {
        if (data.length > 0) {
          // Remove duplicates based on dashboard ID
          const uniqueDashboards = data.filter((dashboard, index, self) =>
            index === self.findIndex((d) => d.id === dashboard.id)
          );
          console.log(`[DashboardsSection] Background fetch: ${data.length} dashboards, ${uniqueDashboards.length} unique`);
          
          // Only update if data has actually changed
          const hasChanges = uniqueDashboards.length !== dashboardsWithStats.length ||
            uniqueDashboards.some((d, i) => 
              d.id !== dashboardsWithStats[i]?.id || 
              d.likes !== dashboardsWithStats[i]?.likes ||
              d.updatedAt !== dashboardsWithStats[i]?.updatedAt
            );
            
          if (hasChanges) {
            setDashboards(uniqueDashboards);
            // Fetch Irys Names for updated dashboards
            fetchIrysNamesForDashboards(uniqueDashboards);
          }
        }
      }).catch(error => {
        console.error('[DashboardsSection] Background fetch error:', error);
      });
      
      return;
    }
    
    try {
      console.log('[DashboardsSection] === DEBUG: Fetching all transactions ===');
      await debugFetchAllTransactions();
      
      console.log('[DashboardsSection] === Starting dashboard data load ===');
      const data = await fetchDashboards();
      console.log('[DashboardsSection] Loaded dashboards:', data);
      
      // Remove duplicates based on dashboard ID
      const uniqueDashboards = data.filter((dashboard, index, self) =>
        index === self.findIndex((d) => d.id === dashboard.id)
      );
      
      // Process dateRanges for all dashboards
      const dashboardsWithDateRanges = uniqueDashboards.map(processDashboardDateRanges);
      
      setDashboards(dashboardsWithDateRanges);
      
      // Fetch Irys Names for all authors
      fetchIrysNamesForDashboards(uniqueDashboards);
      
      if (uniqueDashboards.length === 0) {
        console.log('[DashboardsSection] WARNING: No dashboards found. Check if any dashboards were uploaded.');
      } else {
        console.log(`[DashboardsSection] SUCCESS: Loaded ${uniqueDashboards.length} unique dashboards (from ${data.length} total)`);
      }
    } catch (error) {
      console.error('[DashboardsSection] Error loading dashboards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchIrysNamesForDashboards = async (dashboardList: Dashboard[]) => {
    // Get unique wallet addresses
    const uniqueAddresses = [...new Set(dashboardList.map(d => d.authorAddress))];
    
    if (uniqueAddresses.length === 0) return;
    
    try {
      const names = await fetchIrysNames(uniqueAddresses);
      setIrysNames(names);
    } catch (error) {
      console.error('[DashboardsSection] Error fetching Irys Names:', error);
    }
  };

    const getFormattedAuthor = (dashboard: Dashboard) => {
    const name = irysNames.get(dashboard.authorAddress) || dashboard.author;
    return name || `${dashboard.authorAddress.slice(0, 6)}...${dashboard.authorAddress.slice(-4)}`;
  };
  
  // Extract unique project logos from dashboard
  const getProjectLogos = (dashboard: Dashboard): string[] => {
    const logos = new Set<string>();
    
    if (dashboard.charts && dashboard.charts.length > 0) {
      dashboard.charts.forEach(chart => {
        // Check queries in chart
        if (chart.queries && chart.queries.length > 0) {
          chart.queries.forEach(query => {
            // Check if it's a storage preset
            const storagePreset = APP_PRESETS.find(p => p.id === query.id);
            if (storagePreset && storagePreset.icon) {
              logos.add(storagePreset.icon);
            }
            
            // Check if it's an on-chain preset
            if (query.id.startsWith('onchain-')) {
              const onChainId = query.id.replace('onchain-', '');
              const onChainPreset = ON_CHAIN_PRESETS.find(p => p.id === onChainId);
              if (onChainPreset && onChainPreset.icon) {
                logos.add(onChainPreset.icon);
              }
            }
          });
        }
      });
    }
    
    return Array.from(logos).slice(0, 4); // Limit to 4 logos for space
  };
  
  // Calculate paginated dashboards
  const totalPages = Math.ceil(filteredDashboards.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDashboards = filteredDashboards.slice(startIndex, endIndex);
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of dashboard section
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filterDashboards = () => {
    let filtered = [...dashboards];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(d => 
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.author.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Author filter
    if (filter.author) {
      filtered = filtered.filter(d => d.authorAddress === filter.author);
    }

    // Sort
    switch (filter.sortBy) {
      case 'recent':
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'popular':
        filtered.sort((a, b) => b.likes - a.likes);
        break;
    }

    setFilteredDashboards(filtered);
    // Reset to first page when filters change
    setCurrentPage(1);
  };

  const loadDashboardData = async (dashboard: Dashboard) => {
    setIsLoading(true);
    setLoadingProgress({ current: 0, total: 1, percentage: 0 });
    
    // For old dashboards without charts array, convert to new format
    if (!dashboard.charts || dashboard.charts.length === 0) {
      console.log('[DashboardsSection] Legacy dashboard format detected, skipping data load');
      setIsLoading(false);
      setLoadingProgress(null);
      return;
    }
    
    // Check for cached dashboard data first
    const cachedDashboardData = getCachedDashboardData(dashboard.id);
    if (cachedDashboardData) {
      console.log('[DashboardsSection] Using cached dashboard data');
      setDashboardData(cachedDashboardData);
      setIsLoading(false);
      setLoadingProgress(null);
      return;
    }
    
    try {
      // First try to get cached data or wait for it if being loaded
      let cachedData = getCachedData();
      if (!cachedData && !trendData) {
        console.log('[DashboardsSection] No cached data available, waiting for cache...');
        cachedData = await waitForCache(5000); // Wait up to 5 seconds
      }
      
      // Use either cached data or trendData
      const availableData = cachedData || trendData || {};
      // Load data for all charts
      const allChartData: { [chartId: string]: { [queryId: string]: QueryResult[] } } = {};
      
      for (let i = 0; i < dashboard.charts.length; i++) {
        const chart = dashboard.charts[i];
        console.log(`[DashboardsSection] Loading data for chart: ${chart.title}`);
        
        allChartData[chart.id] = {};
        
        // Check if chart has queries (new format) or tags (legacy format)
        if (chart.queries && chart.queries.length > 0) {
          // New format with multiple queries
          for (let j = 0; j < chart.queries.length; j++) {
            const query = chart.queries[j];
            
            // Check if data exists in availableData first
            if (availableData[query.id]) {
              console.log(`[DashboardsSection] Using cached data for ${query.name}`);
              allChartData[chart.id][query.id] = availableData[query.id];
              
              // Update progress
              const chartProgress = i + (j + 1) / chart.queries.length;
              const overallProgress = {
                current: chartProgress,
                total: dashboard.charts.length,
                percentage: Math.round((chartProgress / dashboard.charts.length) * 100)
              };
              setLoadingProgress(overallProgress);
            } else {
              // Query new data if not in trendData
              const data = await queryTagCounts(query.tags, (progress) => {
                const chartProgress = i + (j + progress.percentage / 100) / (chart.queries?.length || 1);
                const overallProgress = {
                  current: chartProgress,
                  total: dashboard.charts.length,
                  percentage: Math.round((chartProgress / dashboard.charts.length) * 100)
                };
                setLoadingProgress(overallProgress);
              });
              
              allChartData[chart.id][query.id] = data;
            }
          }
        } else if (chart.tags && chart.tags.length > 0) {
          // Legacy format with single tags array
          const data = await queryTagCounts(chart.tags, (progress) => {
            const overallProgress = {
              current: i + (progress.percentage / 100),
              total: dashboard.charts.length,
              percentage: Math.round(((i + (progress.percentage / 100)) / dashboard.charts.length) * 100)
            };
            setLoadingProgress(overallProgress);
          });
          
          allChartData[chart.id][chart.id] = data;
        }
      }
      
      setDashboardData(allChartData);
      
      // Save dashboard data to cache
      saveDashboardData(dashboard.id, allChartData);
      console.log('[DashboardsSection] Dashboard data saved to cache');
      
      // Increment view count (in real app, this would be done server-side)
      dashboard.views += 1;
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
      setLoadingProgress(null);
    }
  };

  const handleDashboardClick = async (dashboard: Dashboard) => {
    // Calculate dateRange for charts if not already set
    const dashboardWithDateRange = processDashboardDateRanges(dashboard);
    
    console.log(`[DashboardSection] Selected dashboard with dateRanges:`, 
      dashboardWithDateRange.charts.map(c => ({
        title: c.title,
        dateRange: c.dateRange
      }))
    );
    
    setSelectedDashboard(dashboardWithDateRange);
    loadDashboardData(dashboardWithDateRange);
  };

  const handleCreateSuccess = (dashboard: Dashboard) => {
    // Process the new dashboard
    const processedDashboard = processDashboardDateRanges(dashboard);
    
    // Add to the beginning of the list
    setDashboards([processedDashboard, ...dashboards]);
    
    // Update cache
    const updatedDashboards = [processedDashboard, ...dashboards];
    try {
      localStorage.setItem('irys-dune-dashboards', JSON.stringify({
        data: updatedDashboards,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('[DashboardsSection] Error updating cache:', error);
    }
    
    // Fetch Irys Name for the new author only
    if (dashboard.authorAddress) {
      fetchIrysNames([dashboard.authorAddress]).then(names => {
        setIrysNames(prev => new Map([...prev, ...names]));
      }).catch(error => {
        console.error('[DashboardsSection] Error fetching Irys Name:', error);
      });
    }
    
    // Don't reload all dashboards - we already have the new one
    console.log('[DashboardsSection] Dashboard added locally without full reload');
  };

  const handleLike = async (dashboard: Dashboard) => {
    if (!walletAddress) {
      alert('Please connect your wallet to like dashboards');
      return;
    }
    
    try {
      const result = await toggleDashboardLike(dashboard.id, walletAddress);
      
      if (result.success) {
        // Update all instances of this dashboard including likedBy
        const updatedDashboards = dashboards.map(d => 
          d.id === dashboard.id ? { 
            ...d, 
            likes: result.likes,
            likedBy: result.liked 
              ? [...(d.likedBy || []), walletAddress]
              : (d.likedBy || []).filter((addr: string) => addr !== walletAddress)
          } : d
        );
        setDashboards(updatedDashboards);
        
        // Update selected dashboard if it's the same
        if (selectedDashboard?.id === dashboard.id) {
          setSelectedDashboard({ 
            ...selectedDashboard, 
            likes: result.likes,
            likedBy: result.liked 
              ? [...(selectedDashboard.likedBy || []), walletAddress]
              : (selectedDashboard.likedBy || []).filter((addr: string) => addr !== walletAddress)
          });
        }
        
        // Update liked status
        const newLiked = new Set(likedDashboards);
        if (result.liked) {
          newLiked.add(dashboard.id);
        } else {
          newLiked.delete(dashboard.id);
        }
        setLikedDashboards(newLiked);
      } else {
        alert('Failed to update like status');
      }
    } catch (error) {
      console.error('Error updating like:', error);
      alert('Error occurred while updating like');
    }
  };

  const handleShareDashboard = async () => {
    if (!dashboardContentRef.current || !selectedDashboard) return;
    
    try {
      const shareText = `Check out "${selectedDashboard.name}" on IrysDune - Decentralized Analytics Dashboard powered by @irys_xyz\n\n${selectedDashboard.description || ''}\n\nmade by @wojacklabs`;
      
      // Don't set isCapturing before capture to avoid re-renders
      // Just capture the current state
      await captureAndShare(
        dashboardContentRef.current, 
        shareText, 
        `irys-dashboard-${selectedDashboard.id}.png`
      );
      
      // Optionally show success feedback
      setIsCapturing(true);
      setTimeout(() => setIsCapturing(false), 1000);
    } catch (error) {
      console.error('Error capturing dashboard:', error);
      alert('Error occurred while capturing dashboard.');
    }
  };

  const handleDownloadDashboard = async () => {
    if (!dashboardContentRef.current || !selectedDashboard) return;
    
    try {
      const blob = await captureElement(dashboardContentRef.current);
      const filename = `irys-dashboard-${selectedDashboard.name.replace(/\s+/g, '-')}-${Date.now()}.png`;
      downloadImage(blob, filename);
    } catch (error) {
      console.error('Error downloading dashboard:', error);
      alert('Error occurred while downloading dashboard.');
    }
  };

  if (selectedDashboard) {
    return (
      <div className="dashboard-view">
        <div className="container">
          <button 
            className="back-btn"
            onClick={() => {
              setSelectedDashboard(null);
              setDashboardData([]);
            }}
          >
            ← Back to Dashboards
          </button>
          <div ref={dashboardContentRef}>
            <div className="dashboard-header">
            <div className="dashboard-info">
              <h2>{selectedDashboard.name}</h2>
              <p>{selectedDashboard.description}</p>
              <div className="dashboard-meta">
                <div className="meta-info">
                  <span>By {getFormattedAuthor(selectedDashboard)}</span>
                  <span> • </span>
                  <span>{selectedDashboard.likes} likes</span>
                  <button 
                    className={`like-btn ${likedDashboards.has(selectedDashboard.id) ? 'liked' : ''}`}
                    onClick={() => handleLike(selectedDashboard)}
                    disabled={!walletAddress}
                  >
                    ❤️ {likedDashboards.has(selectedDashboard.id) ? 'Liked' : 'Like'}
                  </button>
                </div>
                <div className="dashboard-actions">
                  <button 
                    className="action-btn share-btn"
                    onClick={handleShareDashboard}
                  >
                    <Share2 size={16} />
                    {isCapturing ? 'Shared!' : 'Share'}
                  </button>
                  <button 
                    className="action-btn download-btn"
                    onClick={handleDownloadDashboard}
                  >
                    <Download size={16} />
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="dashboard-content">
          {isLoading && loadingProgress ? (
            <LoadingProgress progress={loadingProgress} />
          ) : selectedDashboard.charts && selectedDashboard.charts.length > 0 ? (
            <div className="dashboard-charts-container">
              {selectedDashboard.charts.map((chart) => {
                const chartData = dashboardData[chart.id] || {};
                
                // Prepare data for Chart component
                const chartDataForDisplay: { [key: string]: QueryResult[] } = {};
                const queriesForDisplay: any[] = [];
                
                if (chart.queries && chart.queries.length > 0) {
                  // New format with multiple queries
                  chart.queries.forEach(query => {
                    if (chartData[query.id]) {
                      chartDataForDisplay[query.id] = chartData[query.id];
                      queriesForDisplay.push({
                        id: query.id,
                        name: query.name,
                        tags: query.tags,
                        color: query.color
                      });
                    }
                  });
                } else if (chartData[chart.id]) {
                  // Legacy format
                  chartDataForDisplay[chart.id] = chartData[chart.id];
                  queriesForDisplay.push({
                    id: chart.id,
                    name: chart.name || chart.title,
                    tags: chart.tags || [],
                    color: chart.color
                  });
                }
                
                // Filter data by time period with proper type mapping
                const timePeriodMap: { [key: string]: '7d' | '30d' | '3M' | '6M' } = {
                  'week': '7d',
                  'month': '30d',
                  'quarter': '3M',
                  'year': '6M'
                };
                const mappedPeriod = timePeriodMap[chart.timePeriod] || '30d';
                
                // Debug log to check dateRange
                console.log(`[DashboardSection] Chart "${chart.title}" dateRange:`, chart.dateRange);
                console.log(`[DashboardSection] Chart timePeriod: ${chart.timePeriod}, mappedPeriod: ${mappedPeriod}`);
                
                const filteredData = filterDataByPeriod(
                  chartDataForDisplay, 
                  mappedPeriod, 
                  chart.chartType === 'stacked',
                  chart.dateRange // Pass absolute date range if available
                );
                
                return (
                  <div key={chart.id} className="dashboard-chart-wrapper">
                    <div className="chart-header">
                      <h3>{chart.title}</h3>
                      {chart.description && <p className="chart-description">{chart.description}</p>}
                      {chart.dateRange && (
                        <p className="chart-date-range">
                          {new Date(chart.dateRange.startDate).toLocaleDateString()} - {new Date(chart.dateRange.endDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Chart 
                      data={generateChartData(filteredData, queriesForDisplay, chart.chartType)}
                      chartType={chart.chartType}
                      title=""
                      shareText={generateShareText(queriesForDisplay, chart.chartType)}
                      onTypeChange={() => {}}
                      hideTypeButtons={true}
                      hideActions={true}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-data">
              {selectedDashboard.charts ? 'No charts in this dashboard' : 'Loading data...'}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboards-section">
      <div className="section-header">
        <h2>Community Dashboards</h2>
        <div className="header-buttons">
          {walletAddress && (
            <button 
              className="create-btn"
              onClick={() => setIsCreateModalOpen(true)}
            >
              Create Dashboard
            </button>
          )}
        </div>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search dashboards..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        
        <div className="filter-options">
          <select 
            value={filter.sortBy}
            onChange={(e) => setFilter({ ...filter, sortBy: e.target.value as any })}
          >
            <option value="recent">Most Recent</option>
            <option value="popular">Most Popular</option>
          </select>

          {walletAddress && (
            <label className="my-dashboards">
              <input
                type="checkbox"
                checked={filter.author === walletAddress}
                onChange={(e) => setFilter({ 
                  ...filter, 
                  author: e.target.checked ? walletAddress : undefined 
                })}
              />
              My Dashboards
            </label>
          )}
        </div>
      </div>

      {isLoading && !loadingProgress ? (
        <div className="loading-message">Loading dashboards...</div>
      ) : filteredDashboards.length === 0 ? (
        <div className="empty-state">
          <p>No dashboards found</p>
          {walletAddress && (
            <button 
              className="create-btn"
              onClick={() => setIsCreateModalOpen(true)}
            >
              Create the first dashboard
            </button>
          )}
        </div>
      ) : (
        <div className="dashboards-grid">
          {paginatedDashboards.map(dashboard => (
            <div key={dashboard.id} className="dashboard-card">
              <div 
                className="dashboard-clickable"
                onClick={() => handleDashboardClick(dashboard)}
              >
                <h3>{dashboard.name}</h3>
                {/* Project logos */}
                {(() => {
                  const logos = getProjectLogos(dashboard);
                  return logos.length > 0 ? (
                    <div className="dashboard-project-logos">
                      {logos.map((logo, index) => (
                        <img 
                          key={index} 
                          src={logo} 
                          alt="Project logo" 
                          className="dashboard-project-logo"
                        />
                      ))}
                    </div>
                  ) : null;
                })()}
                <p>{dashboard.description}</p>
                <div className="dashboard-stats">
                  <span>📊 {dashboard.charts?.length || 0} charts</span>
                  <span>❤️ {dashboard.likes}</span>
                </div>
                <div className="dashboard-author">
                  By {getFormattedAuthor(dashboard)}
                </div>
              </div>
              {walletAddress === dashboard.authorAddress && (
                <div className="dashboard-actions">
                  <button 
                    className="edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('[DashboardsSection] Opening dashboard editor...');
                      setEditingDashboard(dashboard);
                      setIsCreateModalOpen(true);
                    }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          
          <div className="pagination-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              // Show only a range of pages
              if (
                page === 1 || // Always show first page
                page === totalPages || // Always show last page
                (page >= currentPage - 2 && page <= currentPage + 2) // Show 2 pages before and after current
              ) {
                return (
                  <button
                    key={page}
                    className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                );
              } else if (
                page === currentPage - 3 || // Show ellipsis before range
                page === currentPage + 3 // Show ellipsis after range
              ) {
                return <span key={page} className="pagination-ellipsis">...</span>;
              }
              return null;
            }).filter(Boolean)}
          </div>
          
          <button 
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}

      {walletAddress && (
        <CreateDashboardModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingDashboard(null);
          }}
          onSuccess={handleCreateSuccess}
          authorAddress={walletAddress}
          authorName={username || undefined}
          existingDashboard={editingDashboard || undefined}
          trendData={trendData}
        />
      )}
    </div>
  );
}; 