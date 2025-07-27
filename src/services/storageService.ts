import type { QueryResult, Dashboard } from '../types';

const STORAGE_KEY = 'irys_query_cache';
const DASHBOARD_STORAGE_KEY = 'irys_dashboard_cache';
const MUTABLE_STORAGE_KEY = 'irys_mutable_addresses';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

interface CacheData {
  data: { [key: string]: QueryResult[] };
  timestamp: number;
}

// Check if cache is valid (not expired)
export function isCacheValid(): boolean {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return false;
    
    const parsedCache: CacheData = JSON.parse(cached);
    const now = Date.now();
    
    return (now - parsedCache.timestamp) < CACHE_DURATION;
  } catch (error) {
    console.error('[StorageService] Error checking cache validity:', error);
    return false;
  }
}

// Get cached data
export function getCachedData(): { [key: string]: QueryResult[] } | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return null;
    
    const parsedCache: CacheData = JSON.parse(cached);
    
    // Check if cache is still valid
    if (!isCacheValid()) {
      console.log('[StorageService] Cache expired, returning null');
      return null;
    }
    
    console.log('[StorageService] Returning cached data');
    return parsedCache.data;
  } catch (error) {
    console.error('[StorageService] Error getting cached data:', error);
    return null;
  }
}

// Save data to cache
export function saveCacheData(data: { [key: string]: QueryResult[] }): void {
  try {
    const cacheData: CacheData = {
      data,
      timestamp: Date.now()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
    console.log('[StorageService] Data saved to cache');
  } catch (error) {
    console.error('[StorageService] Error saving to cache:', error);
  }
}

// Clear cache
export function clearCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[StorageService] Cache cleared');
  } catch (error) {
    console.error('[StorageService] Error clearing cache:', error);
  }
}

// Get cache age in minutes
export function getCacheAge(): number | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return null;
    
    const parsedCache: CacheData = JSON.parse(cached);
    const ageMs = Date.now() - parsedCache.timestamp;
    return Math.floor(ageMs / 60000); // Convert to minutes
  } catch (error) {
    console.error('[StorageService] Error getting cache age:', error);
    return null;
  }
}

// Create a promise that resolves when data is available in cache
export function waitForCache(timeout: number = 10000): Promise<{ [key: string]: QueryResult[] } | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkCache = () => {
      const data = getCachedData();
      if (data) {
        resolve(data);
        return;
      }
      
      // Check if timeout reached
      if (Date.now() - startTime > timeout) {
        console.log('[StorageService] Cache wait timeout reached');
        resolve(null);
        return;
      }
      
      // Check again in 100ms
      setTimeout(checkCache, 100);
    };
    
    checkCache();
  });
}

// Dashboard cache functions
interface DashboardCache {
  dashboards: Dashboard[];
  timestamp: number;
}

export function saveDashboards(dashboards: Dashboard[]): void {
  try {
    const cache: DashboardCache = {
      dashboards,
      timestamp: Date.now()
    };
    
    localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(cache));
    console.log('[StorageService] Dashboards saved to cache');
  } catch (error) {
    console.error('[StorageService] Error saving dashboards:', error);
  }
}

export function getCachedDashboards(): Dashboard[] | null {
  try {
    const cached = localStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (!cached) return null;
    
    const parsedCache: DashboardCache = JSON.parse(cached);
    console.log('[StorageService] Returning cached dashboards');
    return parsedCache.dashboards;
  } catch (error) {
    console.error('[StorageService] Error getting cached dashboards:', error);
    return null;
  }
}

// Mutable address management
interface MutableAddresses {
  [dashboardId: string]: {
    rootTxId: string;
    mutableAddress: string;
    lastUpdated: number;
  };
}

export function saveMutableAddress(dashboardId: string, rootTxId: string, mutableAddress: string): void {
  try {
    const cached = localStorage.getItem(MUTABLE_STORAGE_KEY);
    const addresses: MutableAddresses = cached ? JSON.parse(cached) : {};
    
    addresses[dashboardId] = {
      rootTxId,
      mutableAddress,
      lastUpdated: Date.now()
    };
    
    localStorage.setItem(MUTABLE_STORAGE_KEY, JSON.stringify(addresses));
    console.log('[StorageService] Mutable address saved for dashboard:', dashboardId);
  } catch (error) {
    console.error('[StorageService] Error saving mutable address:', error);
  }
}

export function getMutableAddress(dashboardId: string): { rootTxId: string; mutableAddress: string } | null {
  try {
    const cached = localStorage.getItem(MUTABLE_STORAGE_KEY);
    if (!cached) return null;
    
    const addresses: MutableAddresses = JSON.parse(cached);
    const address = addresses[dashboardId];
    
    if (address) {
      console.log('[StorageService] Found cached mutable address for dashboard:', dashboardId);
      return {
        rootTxId: address.rootTxId,
        mutableAddress: address.mutableAddress
      };
    }
    
    return null;
  } catch (error) {
    console.error('[StorageService] Error getting mutable address:', error);
    return null;
  }
}

export function getAllMutableAddresses(): MutableAddresses {
  try {
    const cached = localStorage.getItem(MUTABLE_STORAGE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch (error) {
    console.error('[StorageService] Error getting all mutable addresses:', error);
    return {};
  }
}

// Dashboard data cache (for chart data)
interface DashboardDataCache {
  [dashboardId: string]: {
    data: any;
    timestamp: number;
  };
}

const DASHBOARD_DATA_KEY = 'irys_dashboard_data_cache';

export function saveDashboardData(dashboardId: string, data: any): void {
  try {
    const cached = localStorage.getItem(DASHBOARD_DATA_KEY);
    const cache: DashboardDataCache = cached ? JSON.parse(cached) : {};
    
    cache[dashboardId] = {
      data,
      timestamp: Date.now()
    };
    
    localStorage.setItem(DASHBOARD_DATA_KEY, JSON.stringify(cache));
    console.log('[StorageService] Dashboard data saved for:', dashboardId);
  } catch (error) {
    console.error('[StorageService] Error saving dashboard data:', error);
  }
}

export function getCachedDashboardData(dashboardId: string): any | null {
  try {
    const cached = localStorage.getItem(DASHBOARD_DATA_KEY);
    if (!cached) return null;
    
    const cache: DashboardDataCache = JSON.parse(cached);
    const dashboardData = cache[dashboardId];
    
    if (dashboardData && (Date.now() - dashboardData.timestamp) < CACHE_DURATION) {
      console.log('[StorageService] Returning cached dashboard data for:', dashboardId);
      return dashboardData.data;
    }
    
    return null;
  } catch (error) {
    console.error('[StorageService] Error getting dashboard data:', error);
    return null;
  }
} 

// Debug function to check local storage status
export function debugStorageStatus() {
  console.log('[StorageService] === Local Storage Status ===');
  
  // Check query cache
  const queryCache = localStorage.getItem(STORAGE_KEY);
  if (queryCache) {
    const parsed = JSON.parse(queryCache);
    const age = Date.now() - parsed.timestamp;
    console.log('[StorageService] Query Cache:');
    console.log('  - Projects:', Object.keys(parsed.data).length);
    console.log('  - Age:', Math.floor(age / 60000), 'minutes');
    console.log('  - Valid:', age < CACHE_DURATION);
    console.log('  - Keys:', Object.keys(parsed.data));
  } else {
    console.log('[StorageService] Query Cache: Not found');
  }
  
  // Check dashboard cache
  const dashboardCache = localStorage.getItem(DASHBOARD_STORAGE_KEY);
  if (dashboardCache) {
    const parsed = JSON.parse(dashboardCache);
    console.log('[StorageService] Dashboard Cache:');
    console.log('  - Dashboards:', parsed.dashboards.length);
    console.log('  - Age:', Math.floor((Date.now() - parsed.timestamp) / 60000), 'minutes');
  } else {
    console.log('[StorageService] Dashboard Cache: Not found');
  }
  
  // Check mutable addresses
  const mutableCache = localStorage.getItem(MUTABLE_STORAGE_KEY);
  if (mutableCache) {
    const parsed = JSON.parse(mutableCache);
    console.log('[StorageService] Mutable Addresses:');
    console.log('  - Count:', Object.keys(parsed).length);
  } else {
    console.log('[StorageService] Mutable Addresses: Not found');
  }
  
  // Check dashboard data cache
  const dashboardDataCache = localStorage.getItem(DASHBOARD_DATA_KEY);
  if (dashboardDataCache) {
    const parsed = JSON.parse(dashboardDataCache);
    console.log('[StorageService] Dashboard Data Cache:');
    console.log('  - Dashboards with data:', Object.keys(parsed).length);
  } else {
    console.log('[StorageService] Dashboard Data Cache: Not found');
  }
  
  console.log('[StorageService] ============================');
}

// Expose debug function to window for easy access
if (typeof window !== 'undefined') {
  (window as any).debugStorage = debugStorageStatus;
} 