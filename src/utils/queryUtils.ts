// Query queue management variables
let isQueryRunning = false;
const queryQueue: (() => Promise<any>)[] = [];

// Cache implementation
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const DEFAULT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Generate cache key from parameters
export function getCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  return `${prefix}:${sortedParams}`;
}

// Get data from cache
export function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > DEFAULT_CACHE_DURATION) {
    cache.delete(key);
    return null;
  }

  console.log('[Cache] Hit:', key);
  return entry.data as T;
}

// Save data to cache
export function setCache<T>(key: string, data: T, duration?: number): void {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
  
  // Optional: Set auto cleanup
  const cacheDuration = duration || DEFAULT_CACHE_DURATION;
  setTimeout(() => {
    cache.delete(key);
  }, cacheDuration);
  
  console.log('[Cache] Set:', key);
}

// Remove from cache
export function removeFromCache(key: string): void {
  cache.delete(key);
}

// Clear all cache
export function clearCache(): void {
  cache.clear();
}

// Execute query with queue management to prevent concurrent execution
export async function executeQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const wrappedQuery = async () => {
      try {
        console.log(`[executeQuery] ${queryName} query started`);
        const result = await queryFn();
        console.log(`[executeQuery] ${queryName} query completed`);
        resolve(result);
      } catch (error) {
        console.error(`[executeQuery] ${queryName} query error:`, error);
        reject(error);
      }
    };

    queryQueue.push(wrappedQuery);
    processQueue();
  });
}

// Process queue
async function processQueue() {
  if (isQueryRunning || queryQueue.length === 0) return;

  isQueryRunning = true;
  const query = queryQueue.shift();

  try {
    await query!();
  } catch (error) {
    console.error('Query execution error:', error);
  } finally {
    isQueryRunning = false;
    // Wait 300ms before next query (rate limit prevention)
    setTimeout(() => processQueue(), 300);
  }
} 