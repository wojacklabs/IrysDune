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
  // Guard: prevent empty-tag queries
  if (!tags || tags.length === 0) {
    console.warn('[IrysService] Skipping query: empty tags provided');
    if (progressCallback) {
      progressCallback({ current: 1, total: 1, percentage: 100 });
    }
    return [];
  }

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

// Query BridgeBox email count for a wallet using BridgBox API
export async function queryBridgeBoxEmails(walletAddress: string): Promise<number> {
  console.log('[IrysService] Querying BridgeBox emails for:', walletAddress);
  
  try {
    // Use proxy API to avoid CORS issues
    const proxyUrl = `/api/bridgbox-email-count?address=${walletAddress}`;
    console.log('[IrysService] Calling BridgBox API via proxy:', proxyUrl);
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Check for error response from proxy
    if (data.error) {
      throw new Error(data.error);
    }
    
    // Extract count from response
    const emailCount = data.count || data.emailCount || data.sentEmailCount || 0;
    
    console.log('[IrysService] BridgBox API response:', data);
    console.log('[IrysService] Total BridgeBox emails found:', emailCount);
    
    return emailCount;
  } catch (error) {
    console.error('[IrysService] Error querying BridgeBox emails from API:', error);
    
    // Fallback to Irys query if API fails
    console.log('[IrysService] Falling back to Irys GraphQL query...');
    return queryBridgeBoxEmailsFromIrys(walletAddress);
  }
}

// Fallback function to query from Irys GraphQL
async function queryBridgeBoxEmailsFromIrys(walletAddress: string): Promise<number> {
  // BridgBox uses devnet, so we need to check both mainnet and devnet
  const endpoints = [
    { url: IRYS_GRAPHQL_URL, name: 'mainnet' },
    { url: 'https://devnet.irys.xyz/graphql', name: 'devnet' }
  ];
  
  let totalEmailCount = 0;
  
  for (const endpoint of endpoints) {
    console.log(`[IrysService] Checking BridgeBox emails on ${endpoint.name}...`);
    
    try {
      const result = await executeQuery(`bridgebox-emails-${walletAddress}-${endpoint.name}`, async () => {
        const emailQuery = {
          query: `
            query GetUserBridgeBoxEmails {
              transactions(
                owners: ["${walletAddress}"]
                tags: [
                  { name: "App-Name", values: ["Bridgbox-Email-Lit"] }
                ]
                first: 100
                order: DESC
              ) {
                edges {
                  node {
                    id
                    tags {
                      name
                      value
                    }
                  }
                }
              }
            }
          `
        };

        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailQuery)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.errors) {
          console.error(`[IrysService] GraphQL errors on ${endpoint.name}:`, result.errors);
          throw new Error('GraphQL query failed');
        }

        return result;
      });

      // Count emails from this endpoint
      const emailCount = result.data?.transactions?.edges?.length || 0;
      console.log(`[IrysService] Found ${emailCount} BridgeBox emails on ${endpoint.name}`);
      totalEmailCount += emailCount;
      
    } catch (error) {
      console.error(`[IrysService] Error querying BridgeBox emails on ${endpoint.name}:`, error);
    }
  }
  
  console.log(`[IrysService] Total BridgeBox emails found from Irys: ${totalEmailCount}`);
  return totalEmailCount;
}

// Query PlayHirys game counts for a wallet
export async function queryPlayHirysGames(walletAddress: string): Promise<Map<string, number>> {
  console.log('[IrysService] Querying PlayHirys games for:', walletAddress);
  
  try {
    // Import necessary functions from onChainService
    const { queryUserOnChainData, ON_CHAIN_PRESETS } = await import('./onChainService');
    
    // Find PlayHirys preset
    const playHirysPreset = ON_CHAIN_PRESETS.find(preset => preset.id === 'play-hirys');
    if (!playHirysPreset || !playHirysPreset.multipleContracts) {
      console.error('[IrysService] PlayHirys preset not found');
      return new Map();
    }
    
    const gameCounts = new Map<string, number>();
    
    // Query each game contract
    await Promise.all(playHirysPreset.multipleContracts.map(async (gameContract) => {
      try {
        const results = await queryUserOnChainData(
          {
            contractAddress: gameContract.contractAddress,
            network: playHirysPreset.network,
            rpcUrl: playHirysPreset.rpcUrl,
            abis: gameContract.abis
          },
          walletAddress,
          undefined,
          { days: 365 } // Look back 1 year for all games
        );
        
        const gameCount = results.reduce((sum, r) => sum + r.count, 0);
        console.log(`[IrysService] ${gameContract.name} count:`, gameCount);
        gameCounts.set(gameContract.name, gameCount);
      } catch (error) {
        console.error(`[IrysService] Error querying ${gameContract.name}:`, error);
        gameCounts.set(gameContract.name, 0);
      }
    }));
    
    return gameCounts;
  } catch (error) {
    console.error('[IrysService] Error querying PlayHirys games:', error);
    return new Map();
  }
}

// Query IrysSlot game count for a wallet
export async function queryIrysSlotCount(walletAddress: string): Promise<number> {
  console.log('[IrysService] Querying IrysSlot count for:', walletAddress);
  
  try {
    // Import necessary functions from onChainService
    const { queryUserOnChainData, ON_CHAIN_PRESETS } = await import('./onChainService');
    
    // Find IrysSlot preset
    const irysSlotPreset = ON_CHAIN_PRESETS.find(preset => preset.id === 'irys-slot');
    if (!irysSlotPreset) {
      console.error('[IrysService] IrysSlot preset not found');
      console.log('[IrysService] Available presets:', ON_CHAIN_PRESETS.map(p => p.id));
      return 0;
    }
    
    console.log('[IrysService] Found IrysSlot preset:', {
      id: irysSlotPreset.id,
      contractAddress: irysSlotPreset.contractAddress,
      network: irysSlotPreset.network,
      rpcUrl: irysSlotPreset.rpcUrl,
      events: irysSlotPreset.abis?.map(abi => abi.name) || []
    });
    
    // Query IrysSlot contract
    const results = await queryUserOnChainData(
      {
        contractAddress: irysSlotPreset.contractAddress,
        network: irysSlotPreset.network,
        rpcUrl: irysSlotPreset.rpcUrl,
        abis: irysSlotPreset.abis
      },
      walletAddress,
      undefined,
      { days: 365 } // Look back 1 year
    );
    
    console.log('[IrysService] IrysSlot query results:', results);
    const slotCount = results.reduce((sum, r) => sum + r.count, 0);
    console.log('[IrysService] IrysSlot play count:', slotCount);
    
    return slotCount;
  } catch (error) {
    console.error('[IrysService] Error querying IrysSlot count:', error);
    return 0;
  }
}

// Query IrysFlip bet count for a wallet
export async function queryIrysFlipCount(walletAddress: string): Promise<number> {
  console.log('[IrysService] Querying IrysFlip count for:', walletAddress);
  
  try {
    // First, try to query from Irys data storage using the correct endpoint
    console.log('[IrysService] Querying IrysFlip data from Irys testnet node...');
    
    const IRYS_FLIP_ENDPOINT = 'https://node1.testnet.irys.xyz/graphql';
    
    // Query with the correct tag structure: App = 'IrysFlip'
    const query = {
      query: `
        query GetIrysFlipGames {
          transactions(
            owners: ["${walletAddress}"]
            tags: [
              { name: "App", values: ["IrysFlip"] }
            ]
            first: 100
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
      `
    };
    
    let irysDataCount = 0;
    
    try {
      const result = await executeQuery(`irysflip-app-${walletAddress}`, async () => {
        const response = await fetch(IRYS_FLIP_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(query)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
      });
      
      if (result.data?.transactions?.edges) {
        irysDataCount = result.data.transactions.edges.length;
        console.log(`[IrysService] Found ${irysDataCount} IrysFlip transactions in Irys data`);
        
        // Log sample tags for debugging
        if (irysDataCount > 0) {
          console.log('[IrysService] Sample transaction tags:', result.data.transactions.edges[0].node.tags);
        }
      }
    } catch (error) {
      console.error('[IrysService] Error querying Irys testnet node:', error);
    }
    
    // Query on-chain contracts (both addresses)
    console.log('[IrysService] Querying on-chain contracts...');
    
    // Import necessary functions from onChainService
    const { queryUserOnChainData, ON_CHAIN_PRESETS } = await import('./onChainService');
    
    // Find IrysFlip preset
    const irysFlipPreset = ON_CHAIN_PRESETS.find(preset => preset.id === 'irys-flip');
    if (!irysFlipPreset) {
      console.error('[IrysService] IrysFlip preset not found');
      return irysDataCount; // Return Irys data count if any
    }
    
    let onChainCount = 0;
    
    // Query primary contract
    const primaryResults = await queryUserOnChainData(
      {
        contractAddress: irysFlipPreset.contractAddress,
        network: irysFlipPreset.network,
        rpcUrl: irysFlipPreset.rpcUrl,
        abis: irysFlipPreset.abis
      },
      walletAddress,
      undefined,
      { days: 730 } // Look back 2 years
    );
    
    onChainCount += primaryResults.reduce((sum, r) => sum + r.count, 0);
    console.log('[IrysService] Primary contract BetPlaced count:', onChainCount);
    
    // Query secondary contract if multipleContracts is defined
    if (irysFlipPreset.multipleContracts) {
      for (const contract of irysFlipPreset.multipleContracts) {
        if (contract.contractAddress !== irysFlipPreset.contractAddress) {
          const secondaryResults = await queryUserOnChainData(
            {
              contractAddress: contract.contractAddress,
              network: irysFlipPreset.network,
              rpcUrl: irysFlipPreset.rpcUrl,
              abis: contract.abis
            },
            walletAddress,
            undefined,
            { days: 730 }
          );
          
          const secondaryCount = secondaryResults.reduce((sum, r) => sum + r.count, 0);
          onChainCount += secondaryCount;
          console.log(`[IrysService] Secondary contract ${contract.contractAddress} count:`, secondaryCount);
        }
      }
    }
    
    // Return the maximum of Irys data count and on-chain count (avoid double counting)
    const totalCount = Math.max(irysDataCount, onChainCount);
    console.log('[IrysService] Total IrysFlip count:', totalCount);
    
    return totalCount;
  } catch (error) {
    console.error('[IrysService] Error querying IrysFlip count:', error);
    return 0;
  }
}

// Query IrysRealms game counts for a wallet
export async function queryIrysRealmsGames(walletAddress: string): Promise<{
  blockDropperCount: number;
  tetrisCount: number;
}> {
  console.log('[IrysService] Querying IrysRealms games for:', walletAddress);
  
  try {
    // Query Block Dropper games
    const blockDropperQuery = {
      query: `
        query GetBlockDropperGames {
          transactions(
            owners: ["${walletAddress}"]
            tags: [
              { name: "Game", values: ["Block-Dropper"] }
            ]
            first: 100
            order: DESC
          ) {
            edges {
              node {
                id
                timestamp
              }
            }
          }
        }
      `
    };

    // Query Tetris games
    const tetrisQuery = {
      query: `
        query GetTetrisGames {
          transactions(
            owners: ["${walletAddress}"]
            tags: [
              { name: "Game", values: ["Tetris"] }
            ]
            first: 100
            order: DESC
          ) {
            edges {
              node {
                id
                timestamp
              }
            }
          }
        }
      `
    };

    // Execute both queries in parallel
    const [blockDropperResult, tetrisResult] = await Promise.all([
      executeQuery(`block-dropper-${walletAddress}`, async () => {
        const response = await fetch(IRYS_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(blockDropperQuery)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
      }),
      
      executeQuery(`tetris-${walletAddress}`, async () => {
        const response = await fetch(IRYS_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tetrisQuery)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
      })
    ]);

    const blockDropperCount = blockDropperResult.data?.transactions?.edges?.length || 0;
    const tetrisCount = tetrisResult.data?.transactions?.edges?.length || 0;

    console.log('[IrysService] IrysRealms game counts:', { blockDropperCount, tetrisCount });

    return { blockDropperCount, tetrisCount };
  } catch (error) {
    console.error('[IrysService] Error querying IrysRealms games:', error);
    return { blockDropperCount: 0, tetrisCount: 0 };
  }
}

// Query badge eligibility data for a wallet
export async function queryBadgeEligibility(walletAddress: string): Promise<{
  dashboardCount: number;
  emailCount: number;
  blockDropperCount: number;
  tetrisCount: number;
  playHirysGames: Map<string, number>;
  irysSlotCount: number;
  irysFlipCount: number;
  mintedBadges: string[];
  mintedBadgeDetails: Map<string, { txHash: string; timestamp: number; metadataUri: string }>;
  loading: boolean;
  error?: string;
}> {
  console.log('[IrysService] Querying badge eligibility for:', walletAddress);
  try {
    // Use executeQuery for rate limiting and queue management
    const result = await executeQuery(`badge-eligibility-${walletAddress}`, async () => {
      // Query dashboards created by this wallet (using owners field)
      const dashboardQuery = {
        query: `
          query GetUserDashboards {
            transactions(
              owners: ["${walletAddress}"]
              tags: [
                { name: "App-Name", values: ["IrysDune"] }
                { name: "Type", values: ["dashboard"] }
              ]
              first: 100
              order: DESC
            ) {
              edges {
                node {
                  id
                  tags {
                    name
                    value
                  }
                }
              }
            }
          }
        `
      };

      const response = await fetch(IRYS_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dashboardQuery)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        console.error('[IrysService] GraphQL errors:', result.errors);
        throw new Error('GraphQL query failed');
      }

      return result;
    });

    // Count unique dashboards (by Dashboard-ID to avoid counting updates)
    const dashboardIds = new Set<string>();
    console.log('[IrysService] Query result:', JSON.stringify(result, null, 2));
    
    if (result.data?.transactions?.edges) {
      console.log('[IrysService] Found', result.data.transactions.edges.length, 'dashboard transactions');
      
      for (const edge of result.data.transactions.edges) {
        const tags = edge.node.tags || [];
        console.log('[IrysService] Transaction tags:', tags);
        
        const dashboardIdTag = tags.find((tag: any) => tag.name === 'Dashboard-ID');
        if (dashboardIdTag) {
          dashboardIds.add(dashboardIdTag.value);
          console.log('[IrysService] Found Dashboard-ID:', dashboardIdTag.value);
        } else {
          console.log('[IrysService] No Dashboard-ID tag found in transaction');
          // Also check Author tag to ensure it's really the user's dashboard
          const authorTag = tags.find((tag: any) => tag.name === 'Author');
          if (authorTag && authorTag.value === walletAddress) {
            console.log('[IrysService] Confirmed Author tag matches wallet address');
          }
        }
      }
    } else {
      console.log('[IrysService] No dashboard transactions found in query result');
    }
    
    const dashboardCount = dashboardIds.size;
    console.log('[IrysService] Found', dashboardCount, 'unique dashboards for wallet:', walletAddress);

          // Query minted badges by this wallet (using owners since user mints with their own wallet)
      const mintedBadgesResult = await executeQuery(`minted-badges-${walletAddress}`, async () => {
        const mintedBadgesQuery = {
          query: `
            query GetMintedBadges($address: String!) {
              transactions(
                owners: [$address]
                tags: [
                  { name: "App-Name", values: ["IrysDune-Badge-NFT"] }
                  { name: "Type", values: ["badge-nft-metadata"] }
                ]
                first: 100
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
          `,
          variables: {
            address: walletAddress
          }
        };

      const response = await fetch(IRYS_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mintedBadgesQuery)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        console.error('[IrysService] GraphQL errors:', result.errors);
        throw new Error('GraphQL query failed');
      }

      return result;
    });

    // Extract minted badge IDs and transaction details
    const mintedBadges = new Set<string>();
    const mintedBadgeDetails = new Map<string, { txHash: string; timestamp: number; metadataUri: string }>();
    
    if (mintedBadgesResult.data?.transactions?.edges) {
      for (const edge of mintedBadgesResult.data.transactions.edges) {
        const tags = edge.node.tags || [];
        const badgeIdTag = tags.find((tag: any) => tag.name === 'Badge-Id');
        if (badgeIdTag) {
          mintedBadges.add(badgeIdTag.value);
          
          // Store transaction details
          mintedBadgeDetails.set(badgeIdTag.value, {
            txHash: edge.node.id,
            timestamp: edge.node.timestamp || Date.now(),
            metadataUri: `https://gateway.irys.xyz/${edge.node.id}`
          });
          
          console.log('[IrysService] Found minted badge:', badgeIdTag.value, 'tx:', edge.node.id);
        }
      }
    }

    console.log('[IrysService] Found minted badges:', Array.from(mintedBadges));
    console.log('[IrysService] Minted badge details:', Array.from(mintedBadgeDetails.entries()));
    
    // Query BridgeBox email count
    const emailCount = await queryBridgeBoxEmails(walletAddress);
    
    // Query IrysRealms game counts
    const { blockDropperCount, tetrisCount } = await queryIrysRealmsGames(walletAddress);
    
    // Query PlayHirys game counts
    const playHirysGames = await queryPlayHirysGames(walletAddress);
    
    // Query IrysSlot count
    const irysSlotCount = await queryIrysSlotCount(walletAddress);
    
    // Query IrysFlip count
    const irysFlipCount = await queryIrysFlipCount(walletAddress);
    
    return { 
      dashboardCount, 
      emailCount,
      blockDropperCount,
      tetrisCount,
      playHirysGames,
      irysSlotCount,
      irysFlipCount,
      mintedBadges: Array.from(mintedBadges),
      mintedBadgeDetails,
      loading: false 
    };
  } catch (error) {
    console.error('[IrysService] Error querying badge eligibility:', error);
    return { 
      dashboardCount: 0, 
      emailCount: 0,
      blockDropperCount: 0,
      tetrisCount: 0,
      playHirysGames: new Map(),
      irysSlotCount: 0,
      irysFlipCount: 0,
      mintedBadges: [],
      mintedBadgeDetails: new Map(),
      loading: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
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
    console.log(`[IrysService] Querying endpoint: ${endpoint.name} (${endpoint.graphql})`);
    
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
        console.log(`[IrysService] [${endpoint.name}] Fetching page ${pageCount + 1}, after: ${after}`);
        
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
            // Debug: Check for BridgBox transactions
            const tags = edge.node.tags || [];
            const isBridgBox = tags.some((tag: any) => tag.name === 'App-Name' && tag.value === 'Bridgbox-Email-Lit');
            if (isBridgBox) {
              console.log(`[IrysService] [${endpoint.name}] Found BridgBox transaction:`, edge.node.id, 'tags:', tags);
            }
            
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
  
  // Debug: Count BridgBox transactions
  const bridgBoxCount = allTransactions.filter(tx => 
    tx.tags.some(tag => tag.name === 'App-Name' && tag.value === 'Bridgbox-Email-Lit')
  ).length;
  console.log(`[IrysService] BridgBox transactions found: ${bridgBoxCount}`);
  
  // Special handling for BridgBox on devnet
  if (bridgBoxCount === 0) {
    console.log('[IrysService] No BridgBox transactions found, trying targeted query on devnet...');
    
    try {
      const devnetEndpoint = IRYS_ENDPOINTS.find(e => e.name === 'DevNet');
      if (devnetEndpoint) {
        const bridgBoxQuery = `
          query {
            transactions(
              owners: ["${walletAddress}"]
              tags: [
                { name: "App-Name", values: ["Bridgbox-Email-Lit"] }
              ]
              first: 100
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
        
        const result = await executeQuery(`bridgbox-special-${walletAddress}`, async () => {
          const response = await axios.post(devnetEndpoint.graphql, { 
            query: bridgBoxQuery,
            headers: {
              'Content-Type': 'application/json',
            }
          });
          return response.data;
        });
        
        if (result?.data?.transactions?.edges) {
            console.log(`[IrysService] Found ${result.data.transactions.edges.length} BridgBox transactions via targeted query`);
            
            let addedCount = 0;
            let filteredOutCount = 0;
            
            for (const edge of result.data.transactions.edges) {
              if (!edge.node) continue;
              
              let timestamp = parseInt(edge.node.timestamp);
              console.log(`[IrysService] BridgBox tx ${edge.node.id} raw timestamp: ${edge.node.timestamp}`);
              
              if (timestamp < 10000000000) {
                timestamp = timestamp * 1000;
              }
              
              const txDate = new Date(timestamp);
              console.log(`[IrysService] BridgBox tx ${edge.node.id} date: ${txDate.toISOString()}, range: ${new Date(fromTimestamp).toISOString()} to ${new Date(now).toISOString()}`);
              
              if (txDate >= new Date(fromTimestamp) && txDate <= new Date(now)) {
                allTransactions.push({
                  id: edge.node.id,
                  timestamp,
                  tags: edge.node.tags || [],
                  endpoint: 'DevNet',
                  url: `${devnetEndpoint.base}/${edge.node.id}`
                });
                
                console.log(`[IrysService] Added BridgBox transaction: ${edge.node.id}`);
                addedCount++;
              } else {
                console.log(`[IrysService] BridgBox tx ${edge.node.id} filtered out - outside time range`);
                filteredOutCount++;
              }
            }
            
            console.log(`[IrysService] BridgBox summary: ${addedCount} added, ${filteredOutCount} filtered out`);
          }
          
          // Re-sort after adding new transactions
          allTransactions.sort((a, b) => b.timestamp - a.timestamp);
        }
    } catch (error) {
      console.error('[IrysService] Error in BridgBox targeted query:', error);
    }
  }
  
  return allTransactions;
} 