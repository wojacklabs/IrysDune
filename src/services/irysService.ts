import axios from 'axios';
import type { QueryResult, Tag, LoadingProgress } from '../types';
import { executeQuery, getCacheKey, getFromCache, setCache } from '../utils/queryUtils';

// Use the official Irys mainnet GraphQL endpoint
const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

export async function queryTagCounts(
  tags: Tag[],
  progressCallback?: (progress: LoadingProgress) => void,
  dateRange?: { months: number }
): Promise<QueryResult[]> {
  // Check cache first
  const cacheKey = getCacheKey('query-tags', { 
    tags: tags.map(t => `${t.name}:${t.value}`).join(',') 
  });
  const cached = getFromCache<QueryResult[]>(cacheKey);
  if (cached) {
    console.log('[IrysService] Using cached data');
    if (progressCallback) {
      progressCallback({ current: 1, total: 1, percentage: 100 });
    }
    return cached;
  }

  console.log('[IrysService] Fetching from GraphQL for tags:', tags);

  // Generate date range based on parameter or default to 6 months
  const months = dateRange?.months || 6;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  console.log(`[IrysService] Query date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (${months} months)`);

  const dailyCounts: { [date: string]: number } = {};
  
  // Initialize all dates with 0
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    dailyCounts[dateStr] = 0;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  let after = "";
  let hasMore = true;
  const pageSize = 100;
  let totalFetched = 0;
  let hasAnyData = false;
  let oldestDataDate: Date | undefined;
  let newestDataDate: Date | undefined;
  let outOfRangeCount = 0;

  while (hasMore) {
    const tagQueries = tags.map(tag => `{ name: "${tag.name}", values: ["${tag.value}"] }`).join(', ');
    
    const query = `
      query {
        transactions(
          tags: [${tagQueries}],
          first: ${pageSize},
          after: "${after}",
          order: DESC
        ) {
          edges {
            node {
              id
              timestamp
            }
            cursor
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `;

    try {
      console.log('[IrysService] Fetching page, after:', after);
      
      // Use executeQuery for rate limiting
      const result = await executeQuery(`queryTagCounts-${after}`, async () => {
        const response = await axios.post(IRYS_GRAPHQL_URL, { 
          query,
          headers: {
            'Content-Type': 'application/json',
          }
        });
        return response.data;
      });
      
      if (!result || !result.data || !result.data.transactions) {
        console.error('[IrysService] Invalid response structure:', result);
        
        // If there's an error message, log it
        if (result?.errors) {
          console.error('[IrysService] GraphQL errors:', result.errors);
        }
        
        hasMore = false;
        break;
      }

      const edges = result.data.transactions.edges || [];
      const pageInfo = result.data.transactions.pageInfo || { hasNextPage: false };

      console.log('[IrysService] Fetched', edges.length, 'transactions');

      edges.forEach((edge: any) => {
        if (!edge.node || typeof edge.node.timestamp === 'undefined') {
          console.warn('[IrysService] Invalid edge structure:', edge);
          return;
        }

        // Irys timestamp might be in seconds, not milliseconds
        let timestamp = parseInt(edge.node.timestamp);
        
        // If timestamp is too small, it's likely in seconds
        if (timestamp < 10000000000) {
          timestamp = timestamp * 1000;
        }
        
        // Validate timestamp
        if (isNaN(timestamp) || timestamp <= 0) {
          console.warn('[IrysService] Invalid timestamp:', edge.node.timestamp);
          return;
        }

        const date = new Date(timestamp);
        const dateStr = date.toISOString().split('T')[0];
        
        // Track oldest and newest dates
        if (!oldestDataDate || date < oldestDataDate) oldestDataDate = date;
        if (!newestDataDate || date > newestDataDate) newestDataDate = date;
        
        // Check if date is within our range
        if (date >= startDate && date <= endDate) {
          dailyCounts[dateStr]++;
          hasAnyData = true;
        } else {
          outOfRangeCount++;
          console.log('[IrysService] Date out of range:', dateStr, '(data from', edge.node.id.substring(0, 8), '...)');
        }
      });

      totalFetched += edges.length;
      
      if (progressCallback) {
        // Estimate progress (we don't know total, so use a logarithmic scale)
        const estimatedProgress = Math.min(95, Math.log10(totalFetched + 1) * 30);
        progressCallback({
          current: totalFetched,
          total: totalFetched + (pageInfo.hasNextPage ? 100 : 0),
          percentage: Math.round(estimatedProgress)
        });
      }

      if (pageInfo.hasNextPage && edges.length > 0) {
        after = edges[edges.length - 1].cursor;
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error('[IrysService] Error querying Irys GraphQL:', error);
      if (axios.isAxiosError(error)) {
        console.error('[IrysService] Response status:', error.response?.status);
        console.error('[IrysService] Response data:', error.response?.data);
      }
      hasMore = false;
      break;
    }
  }

  const results = Object.entries(dailyCounts)
    .map(([date, count]) => ({
      timestamp: new Date(date).getTime(),
      count
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  console.log('[IrysService] Query Summary:');
  console.log('  - Date range requested:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
  console.log('  - Total transactions fetched:', totalFetched);
  console.log('  - In-range data points:', results.filter(r => r.count > 0).length);
  console.log('  - Out-of-range count:', outOfRangeCount);
  
  if (oldestDataDate && newestDataDate) {
    console.log('  - Actual data range:', oldestDataDate.toISOString().split('T')[0], 'to', newestDataDate.toISOString().split('T')[0]);
    
    // Check if we might be missing recent data
    const daysSinceNewest = Math.floor((endDate.getTime() - newestDataDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceNewest > 7) {
      console.warn(`[IrysService] ⚠️  Warning: No data found for the last ${daysSinceNewest} days. There might be more recent data not fetched.`);
    }
    
    // Check if we might be missing old data
    if (oldestDataDate.getTime() > startDate.getTime() && totalFetched >= 100) {
      console.warn(`[IrysService] ⚠️  Warning: Oldest data found is from ${oldestDataDate.toISOString().split('T')[0]}, but requested from ${startDate.toISOString().split('T')[0]}. There might be older data not fetched due to query limits.`);
    }
  }

  // Save to cache if we have data
  if (hasAnyData) {
    setCache(cacheKey, results);
  }

  if (progressCallback) {
    progressCallback({ current: totalFetched, total: totalFetched, percentage: 100 });
  }

  return results;
}

export async function queryMultipleTagCounts(
  tagGroups: Array<{ id: string; tags: Tag[] }>,
  progressCallback?: (progress: LoadingProgress) => void
): Promise<{ [key: string]: QueryResult[] }> {
  const results: { [key: string]: QueryResult[] } = {};
  const total = tagGroups.length;
  let completed = 0;

  for (const group of tagGroups) {
    console.log('[IrysService] Processing group:', group.id, 'with tags:', group.tags);
    const groupResults = await queryTagCounts(group.tags);
    results[group.id] = groupResults;
    
    completed++;
    if (progressCallback) {
      progressCallback({
        current: completed,
        total,
        percentage: Math.round((completed / total) * 100)
      });
    }
  }

  return results;
} 

export async function fetchIrysName(walletAddress: string): Promise<string | null> {
  console.log(`[IrysService] Fetching Irys Name for wallet: ${walletAddress}`);
  
  // Try both lowercase and original (checksummed) address
  const addressesToTry = [
    walletAddress.toLowerCase(),
    walletAddress
  ];
  
  for (const address of addressesToTry) {
    console.log(`[IrysService] Trying address format: ${address}`);
    
    try {
      const query = `
        query {
          transactions(
            tags: [
              { name: "App-Name", values: ["Irys-Names"] },
              { name: "Domain-Owner", values: ["${address}"] }
            ],
            first: 1,
            order: DESC
          ) {
            edges {
              node {
                id
                timestamp
                tags {
                  name
                  value
                }
              }
            }
          }
        }
      `;

      // Irys Names uses node1.irys.xyz endpoint
      const response = await fetch('https://node1.irys.xyz/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();
      
      if (result.data?.transactions?.edges?.length > 0) {
        const latestTransaction = result.data.transactions.edges[0];
        const tags = latestTransaction.node.tags || [];
        const domainNameTag = tags.find((tag: any) => tag.name === 'Domain-Name');
        
        if (domainNameTag) {
          console.log(`[IrysService] Found Irys Name: ${domainNameTag.value} for ${walletAddress}`);
          return domainNameTag.value;
        }
      }
    } catch (error) {
      console.error(`[IrysService] Error fetching Irys Name with ${address}:`, error);
    }
  }
  
  console.log(`[IrysService] No Irys Name found for ${walletAddress} in any format`);
  return null;
}

// Batch fetch Irys Names for multiple addresses
export async function fetchIrysNames(walletAddresses: string[]): Promise<Map<string, string>> {
  console.log(`[IrysService] Fetching Irys Names for ${walletAddresses.length} addresses`);
  
  const nameMap = new Map<string, string>();
  
  // Process in parallel for better performance
  const promises = walletAddresses.map(async (address) => {
    const name = await fetchIrysName(address);
    if (name) {
      nameMap.set(address, name);
    }
  });
  
  await Promise.all(promises);
  
  console.log(`[IrysService] Found ${nameMap.size} Irys Names out of ${walletAddresses.length} addresses`);
  return nameMap;
} 

// Endpoint configurations
const IRYS_ENDPOINTS = [
  { 
    graphql: 'https://uploader.irys.xyz/graphql',
    base: 'https://uploader.irys.xyz',
    name: 'Mainnet Uploader'
  },
  { 
    graphql: 'https://node1.irys.xyz/graphql',
    base: 'https://node1.irys.xyz',
    name: 'Mainnet Node1'
  },
  { 
    graphql: 'https://devnet.irys.xyz/graphql',
    base: 'https://devnet.irys.xyz',
    name: 'DevNet'
  },
  { 
    graphql: 'https://node1.testnet.irys.xyz/graphql',
    base: 'https://node1.testnet.irys.xyz',
    name: 'TestNet Node1'
  }
];

// Get user transactions from all endpoints
export async function getUserTransactions(
  walletAddress: string,
  timePeriod: '24h' | '3d' | '7d' | '1m' | '3m' | '6m',
  progressCallback?: (progress: LoadingProgress) => void
): Promise<Array<{
  id: string;
  timestamp: number;
  tags: Array<{ name: string; value: string }>;
  endpoint: string;
  url: string;
}>> {
  // Calculate time range
  const now = Date.now();
  let fromTimestamp: number;
  
  switch (timePeriod) {
    case '24h':
      fromTimestamp = now - 24 * 60 * 60 * 1000;
      break;
    case '3d':
      fromTimestamp = now - 3 * 24 * 60 * 60 * 1000;
      break;
    case '7d':
      fromTimestamp = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case '1m':
      fromTimestamp = now - 30 * 24 * 60 * 60 * 1000;
      break;
    case '3m':
      fromTimestamp = now - 90 * 24 * 60 * 60 * 1000;
      break;
    case '6m':
      fromTimestamp = now - 180 * 24 * 60 * 60 * 1000;
      break;
    default:
      fromTimestamp = now - 7 * 24 * 60 * 60 * 1000;
  }
  
  console.log(`[IrysService] Date range: ${new Date(fromTimestamp).toISOString()} to ${new Date(now).toISOString()}`);
  
  const allTransactions: Array<{
    id: string;
    timestamp: number;
    tags: Array<{ name: string; value: string }>;
    endpoint: string;
    url: string;
  }> = [];
  
  let totalProgress = 0;
  const progressPerEndpoint = 100 / IRYS_ENDPOINTS.length;
  
  // Query each endpoint
  for (const endpoint of IRYS_ENDPOINTS) {
    console.log(`[IrysService] Querying endpoint: ${endpoint.name}`);
    
    let after = "";
    let hasMore = true;
    const pageSize = 100; // 페이지 크기를 100으로 증가
    let pageCount = 0;
    let endpointTransactionCount = 0;
    
    while (hasMore) {
      const query = `
        query {
          transactions(
            owners: ["${walletAddress}"],
            first: ${pageSize},
            after: "${after}",
            order: DESC
          ) {
            edges {
              node {
                id
                timestamp
                tags {
                  name
                  value
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      `;
      
      try {
        console.log(`[IrysService] [${endpoint.name}] Fetching page ${pageCount + 1}`);
        
        const result = await executeQuery(`getUserTx-${endpoint.name}-${walletAddress}-${after}`, async () => {
          const response = await axios.post(endpoint.graphql, { 
            query,
            headers: {
              'Content-Type': 'application/json',
            }
          });
          return response.data;
        });
        
        if (!result?.data?.transactions) {
          console.error(`[IrysService] [${endpoint.name}] Invalid response structure:`, result);
          break;
        }
        
        const edges = result.data.transactions.edges || [];
        const pageInfo = result.data.transactions.pageInfo || { hasNextPage: false };
        
        console.log(`[IrysService] [${endpoint.name}] Fetched ${edges.length} transactions`);
        
        let stopFetching = false;
        
        for (const edge of edges) {
          if (!edge.node) continue;
          
          // Handle timestamp
          let timestamp = parseInt(edge.node.timestamp);
          if (timestamp < 10000000000) {
            timestamp = timestamp * 1000;
          }
          
          const txDate = new Date(timestamp);
          
          // Check date range
          if (txDate < new Date(fromTimestamp)) {
            console.log(`[IrysService] [${endpoint.name}] Transaction ${edge.node.id} is before start date, stopping`);
            stopFetching = true;
            break;
          }
          
          if (txDate <= new Date(now)) {
            allTransactions.push({
              id: edge.node.id,
              timestamp,
              tags: edge.node.tags || [],
              endpoint: endpoint.name,
              url: `${endpoint.base}/${edge.node.id}`
            });
            endpointTransactionCount++;
          }
        }
        
        pageCount++;
        
        if (stopFetching || !pageInfo.hasNextPage || edges.length === 0) {
          hasMore = false;
        } else {
          after = edges[edges.length - 1].cursor;
        }
        
        // Progress 업데이트: 각 페이지마다
        if (progressCallback) {
          progressCallback({
            current: allTransactions.length,
            total: allTransactions.length + 1, // 실시간 업데이트, 정확한 총 개수는 모름
            percentage: 0, // percentage는 사용하지 않음
            message: `Fetching from ${endpoint.name}: ${endpointTransactionCount} transactions...`
          });
        }
        
      } catch (error) {
        console.error(`[IrysService] [${endpoint.name}] Error fetching transactions:`, error);
        hasMore = false;
      }
    }
    
    totalProgress += progressPerEndpoint;
    console.log(`[IrysService] [${endpoint.name}] Total transactions: ${endpointTransactionCount}`);
    
    if (progressCallback) {
      progressCallback({
        current: allTransactions.length,
        total: allTransactions.length,
        percentage: Math.round(totalProgress),
        message: `Completed ${endpoint.name}: ${endpointTransactionCount} transactions`
      });
    }
  }
  
  // Sort all transactions by timestamp (newest first)
  allTransactions.sort((a, b) => b.timestamp - a.timestamp);
  
  console.log(`[IrysService] Total transactions fetched from all endpoints: ${allTransactions.length}`);
  return allTransactions;
} 