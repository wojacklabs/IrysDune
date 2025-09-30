import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, ChartLine, Earth } from 'lucide-react';
import type { ChartType, DataDisplayType, ChartShape, QueryResult, LoadingProgress as LoadingProgressType } from '../types';
import { APP_PRESETS } from '../constants/appPresets';
import { ON_CHAIN_PRESETS } from '../services/onChainService';
import { fetchAllProjectsData } from '../services/dataService';
import { 
  generateChartData, 
  generateShareText, 
  generateWholeEcosystemData,
  filterDataByPeriod 
} from '../utils/chartUtils';
import { getCachedData, saveCacheData, getCacheAge } from '../services/storageService';
import Chart from './Chart';
import LoadingProgress from './LoadingProgress';


type TimePeriod = '7d' | '30d' | '3M' | '6M' | 'custom';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface TrendSectionProps {
  onDataUpdate?: (data: { [key: string]: QueryResult[] }) => void;
}

const TrendSection: React.FC<TrendSectionProps> = ({ onDataUpdate }) => {
  // Combine storage and on-chain presets
  const ALL_PRESETS = [
    ...APP_PRESETS,
    ...ON_CHAIN_PRESETS.filter(p => ['irys-tarot-card', 'irys-forum'].includes(p.id)).map(p => ({
      id: p.id,
      name: p.name,
      tags: [],
      color: p.color,
      icon: p.icon || undefined
    }))
  ];
  
  // Select all apps by default
  const [selectedApps, setSelectedApps] = useState<string[]>(
    ALL_PRESETS.map(preset => preset.id)
  );
  // Data display type (absolute/cumulative) and chart shape (line/treemap)
  const [dataDisplayType, setDataDisplayType] = useState<DataDisplayType>('cumulative');
  const [ecosystemDataDisplayType, setEcosystemDataDisplayType] = useState<DataDisplayType>('cumulative');
  const [chartShape, setChartShape] = useState<ChartShape>('line');
  const [ecosystemChartShape, setEcosystemChartShape] = useState<ChartShape>('line');
  
  // Combine data display type and chart shape to get ChartType
  const chartType = chartShape === 'treemap' ? 'treemap' : (dataDisplayType === 'cumulative' ? 'stacked' : 'line') as ChartType;
  const ecosystemChartType = ecosystemChartShape === 'treemap' ? 'treemap' : (ecosystemDataDisplayType === 'cumulative' ? 'stacked' : 'line') as ChartType;
  const [wholeTimePeriod, setWholeTimePeriod] = useState<TimePeriod>('30d');
  const [individualTimePeriod, setIndividualTimePeriod] = useState<TimePeriod>('30d');
  const [wholeCustomDateRange, setWholeCustomDateRange] = useState<DateRange>({ 
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date() 
  });
  const [individualCustomDateRange, setIndividualCustomDateRange] = useState<DateRange>({ 
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date() 
  });
  const [showWholeCustomDatePicker, setShowWholeCustomDatePicker] = useState(false);
  const [showIndividualCustomDatePicker, setShowIndividualCustomDatePicker] = useState(false);
  const [individualData, setIndividualData] = useState<{ [key: string]: QueryResult[] }>({});
  const [ecosystemData, setEcosystemData] = useState<{ [key: string]: QueryResult[] }>({});
  const [individualLoading, setIndividualLoading] = useState(false);
  const [ecosystemLoading, setEcosystemLoading] = useState(false);
  const [progress, setProgress] = useState<LoadingProgressType>({ current: 0, total: 100, percentage: 0 });
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Add refs for ecosystem cards
  const wholeEcosystemCardRef = useRef<HTMLDivElement>(null);
  const appsEcosystemCardRef = useRef<HTMLDivElement>(null);

  const toggleApp = (appId: string) => {
    setSelectedApps(prev => 
      prev.includes(appId) 
        ? prev.filter(id => id !== appId)
        : [...prev, appId]
    );
  };

  // Load all preset apps data for Whole Ecosystem
  const loadEcosystemData = async (forceRefresh: boolean = false) => {
    setEcosystemLoading(true);
    
    // Use cached data if available and not forcing refresh (for ecosystem only)
    if (!forceRefresh) {
      const cachedData = getCachedData();
      if (cachedData) {
        setEcosystemData(cachedData);
        setIndividualData(cachedData);
        setEcosystemLoading(false);
        
        // Set cache age based on stored timestamp
        const age = getCacheAge();
        setCacheAge(age);
        console.log('[TrendSection] Using cached data:', Object.keys(cachedData).length, 'projects, age:', age, 'seconds');
        
        // Share ecosystem data with parent
        if (onDataUpdate) {
          onDataUpdate(cachedData);
        }
        return;
      }
    }

    try {
      const results = await fetchAllProjectsData(setProgress);
      setEcosystemData(results);
      setIndividualData(results);
      
      // Save to cache
      saveCacheData(results);
      setCacheAge(0);
      console.log('[TrendSection] Data saved to local storage:', Object.keys(results).length, 'projects');
      
      // Share ecosystem data with parent
      if (onDataUpdate) {
        onDataUpdate(results);
      }
    } catch (error) {
      console.error('Error loading ecosystem data:', error);
    } finally {
      setEcosystemLoading(false);
    }
  };

  // Load selected apps data for Individual Apps
  const loadIndividualData = async (forceRefresh: boolean = false) => {
    if (selectedApps.length === 0) return;

    setIndividualLoading(true);
    
    // Use cached data if available and not forcing refresh
    const cachedData = getCachedData();
    if (cachedData && !forceRefresh) {
      // Filter cached data to only selected apps
      const filteredData: { [key: string]: QueryResult[] } = {};
      selectedApps.forEach(appId => {
        if (cachedData[appId]) {
          filteredData[appId] = cachedData[appId];
        }
      });
      setIndividualData(filteredData);
      setIndividualLoading(false);
      return;
    }

    setIndividualData({});

    try {
      const results = await fetchAllProjectsData(setProgress);
      // Filter to only selected apps
      const filteredResults: { [key: string]: QueryResult[] } = {};
      selectedApps.forEach(appId => {
        if (results[appId]) {
          filteredResults[appId] = results[appId];
        }
      });
      setIndividualData(filteredResults);
      
      // If force refresh, update the cache with new data
      if (forceRefresh) {
        saveCacheData(results);
        setEcosystemData(results);
        setCacheAge(0);
      }
      
      // Always share ecosystem data with parent to ensure all presets are available
      if (onDataUpdate && ecosystemData) {
        onDataUpdate(ecosystemData);
      }
    } catch (error) {
      console.error('Error loading individual data:', error);
    } finally {
      setIndividualLoading(false);
    }
  };

  const refreshIndividual = () => {
    loadIndividualData(true);
  };



  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadEcosystemData(true); // Force refresh
    setIsRefreshing(false);
  };

  // Load ecosystem data on component mount and set up auto-refresh
  useEffect(() => {
    loadEcosystemData();
    
    // Set up 30-minute interval for auto-refresh
    intervalRef.current = setInterval(() => {
      // Only refresh if the page is visible
      if (!document.hidden) {
        console.log('[TrendSection] Auto-refreshing data (30-minute interval)...');
        loadEcosystemData(true);
      } else {
        console.log('[TrendSection] Page is hidden, skipping auto-refresh');
      }
    }, 30 * 60 * 1000); // 30 minutes
    
    // Set up 1-minute interval for cache age update
    const ageInterval = setInterval(() => {
      const age = getCacheAge();
      if (age !== null) {
        setCacheAge(Math.floor(age / 60000)); // Convert to minutes
        console.log('[TrendSection] Cache age updated:', Math.floor(age / 60000), 'minutes');
      }
    }, 60 * 1000); // 1 minute
    
    // Cleanup intervals on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      clearInterval(ageInterval);
    };
  }, []);

  // Share ecosystem data whenever it changes
  useEffect(() => {
    if (onDataUpdate && Object.keys(ecosystemData).length > 0) {
      onDataUpdate(ecosystemData);
    }
  }, [ecosystemData, onDataUpdate]);

  // Auto-load individual data when selected apps change
  useEffect(() => {
    if (selectedApps.length > 0) {
      loadIndividualData();
    }
  }, [selectedApps]);

  // Helper function to get presets from both storage and on-chain
  const getAllPresetsByIds = (ids: string[]) => {
    return ids.map(id => {
      const preset = ALL_PRESETS.find(p => p.id === id);
      if (preset) return preset;
      
      // Check on-chain presets
      const onChainPreset = ON_CHAIN_PRESETS.find(p => p.id === id);
      if (onChainPreset) {
        // Convert on-chain preset to match AppPreset interface
        return {
          id: onChainPreset.id,
          name: onChainPreset.name,
          tags: [],
          color: onChainPreset.color,
          icon: onChainPreset.icon || undefined
        };
      }
      return null;
    }).filter(Boolean) as any[];
  };
  
  const selectedPresets = getAllPresetsByIds(selectedApps);
  
  // Use custom date range if selected
  const individualDateRange = individualTimePeriod === 'custom' ? {
    startDate: individualCustomDateRange.startDate.getTime(),
    endDate: individualCustomDateRange.endDate.getTime()
  } : undefined;
  
  const wholeDateRange = wholeTimePeriod === 'custom' ? {
    startDate: wholeCustomDateRange.startDate.getTime(),
    endDate: wholeCustomDateRange.endDate.getTime()
  } : undefined;
  
  const individualFilteredData = filterDataByPeriod(
    individualData, 
    individualTimePeriod === 'custom' ? '30d' : individualTimePeriod, 
    chartType === 'stacked' || chartShape === 'treemap', 
    individualDateRange
  );
  const ecosystemFilteredData = filterDataByPeriod(
    ecosystemData, 
    wholeTimePeriod === 'custom' ? '30d' : wholeTimePeriod, 
    ecosystemChartType === 'stacked' || ecosystemChartShape === 'treemap', 
    wholeDateRange
  );
  const chartData = generateChartData(
    individualFilteredData, 
    selectedPresets, 
    chartShape === 'treemap' ? 'treemap' : chartType
  );
  const wholeEcosystemData = generateWholeEcosystemData(
    ecosystemFilteredData, 
    ecosystemChartShape === 'treemap' ? 'treemap' : ecosystemChartType
  );
  const shareText = generateShareText(selectedPresets, chartType);

  // Check if we have data
  const hasIndividualData = Object.keys(individualData).length > 0 && selectedApps.length > 0;
  const hasEcosystemData = Object.keys(ecosystemData).length > 0;

  return (
    <div className="trend-section">
      {/* Whole Ecosystem Section - Always visible */}
      <div className="card ecosystem-card" ref={wholeEcosystemCardRef}>
        <div className="ecosystem-header">
          <div className="ecosystem-title">
            <Earth className="ecosystem-icon" size={20} />
            <h3>Whole Ecosystem</h3>
            {cacheAge !== null && (
              <span className="cache-indicator">
                {cacheAge === 0 ? 'Just updated' : `Updated ${cacheAge}m ago`}
              </span>
            )}
          </div>
          <div className="header-actions">
            <div className="time-period-selector">
              {(['7d', '30d', '3M', '6M', 'custom'] as TimePeriod[]).map(period => (
                <button
                  key={period}
                  onClick={() => {
                    setWholeTimePeriod(period);
                    if (period === 'custom') {
                      setShowWholeCustomDatePicker(true);
                    } else {
                      setShowWholeCustomDatePicker(false);
                    }
                  }}
                  className={`period-button ${wholeTimePeriod === period ? 'active' : ''}`}
                >
                  {period === 'custom' ? 'Custom' : period}
                </button>
              ))}
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={ecosystemLoading || isRefreshing}
              className="button button-secondary button-sm"
              title={cacheAge !== null ? `Data age: ${cacheAge} minutes` : 'Refresh data'}
            >
              <RefreshCw size={16} className={ecosystemLoading || isRefreshing ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
        
        {showWholeCustomDatePicker && (
          <div className="custom-date-picker">
            <input
              type="date"
              value={wholeCustomDateRange.startDate.toISOString().split('T')[0]}
              onChange={(e) => setWholeCustomDateRange({
                ...wholeCustomDateRange,
                startDate: new Date(e.target.value)
              })}
              className="date-input"
            />
            <span className="date-separator">to</span>
            <input
              type="date"
              value={wholeCustomDateRange.endDate.toISOString().split('T')[0]}
              onChange={(e) => setWholeCustomDateRange({
                ...wholeCustomDateRange,
                endDate: new Date(e.target.value)
              })}
              className="date-input"
            />
          </div>
        )}
        
        {ecosystemLoading ? (
          <LoadingProgress 
            progress={progress} 
            message="Loading ecosystem data..."
          />
        ) : hasEcosystemData ? (
          <Chart
            data={wholeEcosystemData}
            chartType={ecosystemChartType}
            title=""
            shareText={`Irys Whole Ecosystem Activity\n\nPeriod: ${wholeTimePeriod}\n\n#Irys #Web3 #Analytics #IrysDune\n\nmade by @wojacklabs`}
            onTypeChange={(type) => {
              if (type === 'stacked') {
                setEcosystemDataDisplayType('cumulative');
              } else if (type === 'line') {
                setEcosystemDataDisplayType('absolute');
              } else if (type === 'treemap') {
                setEcosystemChartShape('treemap');
              }
            }}
            dataDisplayType={ecosystemDataDisplayType}
            chartShape={ecosystemChartShape}
            onDataDisplayTypeChange={(type) => {
              setEcosystemDataDisplayType(type);
              // Reset to line chart when selecting absolute/cumulative
              if (ecosystemChartShape === 'treemap') {
                setEcosystemChartShape('line');
              }
            }}
            onChartShapeChange={(shape) => {
              setEcosystemChartShape(shape);
              // Keep current data display type when toggling treemap
            }}
            captureContainerRef={wholeEcosystemCardRef}
            hideTreemap={true}
          />
        ) : (
          <div className="empty-state">
            <Earth className="empty-icon" />
            <div className="empty-title">Loading ecosystem data...</div>
            <div className="empty-description">
              Please wait while we fetch the data
            </div>
          </div>
        )}
      </div>

      {/* Individual Apps Section */}
      <div className="card ecosystem-card" ref={appsEcosystemCardRef}>
        <div className="ecosystem-header">
          <div className="ecosystem-title">
            <ChartLine className="ecosystem-icon" size={20} />
            <h3>Ecosystem Trends</h3>
          </div>
          <div className="header-actions">
            <div className="time-period-selector">
              {(['7d', '30d', '3M', '6M', 'custom'] as TimePeriod[]).map(period => (
                <button
                  key={period}
                  onClick={() => {
                    setIndividualTimePeriod(period);
                    if (period === 'custom') {
                      setShowIndividualCustomDatePicker(true);
                    } else {
                      setShowIndividualCustomDatePicker(false);
                    }
                  }}
                  className={`period-button ${individualTimePeriod === period ? 'active' : ''}`}
                >
                  {period === 'custom' ? 'Custom' : period}
                </button>
              ))}
            </div>
            <button
              onClick={refreshIndividual}
              disabled={individualLoading}
              className="button button-secondary button-sm"
            >
              <RefreshCw size={16} className={individualLoading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {showIndividualCustomDatePicker && (
          <div className="custom-date-picker">
            <input
              type="date"
              value={individualCustomDateRange.startDate.toISOString().split('T')[0]}
              onChange={(e) => setIndividualCustomDateRange({
                ...individualCustomDateRange,
                startDate: new Date(e.target.value)
              })}
              className="date-input"
            />
            <span className="date-separator">to</span>
            <input
              type="date"
              value={individualCustomDateRange.endDate.toISOString().split('T')[0]}
              onChange={(e) => setIndividualCustomDateRange({
                ...individualCustomDateRange,
                endDate: new Date(e.target.value)
              })}
              className="date-input"
            />
          </div>
        )}

        <div className="app-selection">
          <div className="app-grid">
            {ALL_PRESETS.map(app => (
              <button
                key={app.id}
                onClick={() => toggleApp(app.id)}
                className={`app-card ${selectedApps.includes(app.id) ? 'selected' : ''}`}
              >
                <div className="app-card-content">
                  {app.icon && (
                    <img src={app.icon} alt={app.name} className="app-icon-img" />
                  )}
                  <div className="app-info">
                    <div className="app-name">{app.name}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedApps.length === 0 && (
          <div className="empty-state">
            <ChartLine className="empty-icon" />
            <div className="empty-title">Select at least one application</div>
            <div className="empty-description">
              Choose applications to view their activity trends
            </div>
          </div>
        )}
        
        {selectedApps.length > 0 && (
          individualLoading ? (
            <LoadingProgress 
              progress={progress} 
              message="Loading trend data..."
            />
          ) : hasIndividualData ? (
            <Chart
              data={chartData}
              chartType={chartType}
              title=""
              shareText={shareText}
              onTypeChange={(type) => {
                if (type === 'stacked') {
                  setDataDisplayType('cumulative');
                } else if (type === 'line') {
                  setDataDisplayType('absolute');
                } else if (type === 'treemap') {
                  setChartShape('treemap');
                }
              }}
              dataDisplayType={dataDisplayType}
              chartShape={chartShape}
              onDataDisplayTypeChange={(type) => {
                setDataDisplayType(type);
                // Reset to line chart when selecting absolute/cumulative
                if (chartShape === 'treemap') {
                  setChartShape('line');
                }
              }}
              onChartShapeChange={(shape) => {
                setChartShape(shape);
                // Keep current data display type when toggling treemap
              }}
              captureContainerRef={appsEcosystemCardRef}
            />
          ) : null
        )}
      </div>
    </div>
  );
};

export default TrendSection; 