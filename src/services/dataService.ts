import type { QueryResult, LoadingProgress } from '../types';

// Mutable addresses for each project's data
const PROJECT_MUTABLE_ADDRESSES: { [key: string]: string } = {
  'cm-note': 'BPJkksQCWERREdP1ftVAVQ38z429W5q8iKZ3oRNEsWZQ',
  'githirys': '9unbTk3ykt7aPiq8gKEj6Z9BDUUCLpufSNfpEnXiUnpJ',
  'irys-names': 'EyVYXjojk7fygA56Gu3Ndcj6ueYqH1dXCfVBwRU52fgF',
  'bridgbox': 'DhW8NTY9BHy6w4JaBNDtycG4XFaAgk287D6fxnxhkDkd',
  'irysdune': '9eCDDCox81c6dsjjgcZ7bvs6Yf7VNfBVGeS7AevvSR7R',
  'irys-proof-board': 'FeihLByeu1DukYLdwpzwyV1D4MRcU47j6oRQjXHvubB5',
  'irysflip': '3dHMNfs4rnoL9fCfc7c9CgpEe2jvozF89vJ7KnEhSxfG',
  'irys-crush': '5eFGjKARxZ9eQ2krUnGK3M1FjcRabH69jFfzFz3ckV8q',
  'irys-memory': '9um9YHT8cdJmHPXYVtxMDLSY1xzs4eXiX5df8Mc4dyxL',
  'irys-pfp': 'FwTTi9Sk5pv4e4UbPBNUjWHt94F5Y1XWhPbZuBHe1BQ9',
  'irys-pinter': '3rpucfSC6JVWhbkscVkFP6KGKzaaWiJFsszRJNfDU5To',
  'seedback': '8B4SKBJfamH5WT4eGLtQDYJYmbX9ihenNdgmAAtsz5mo',
  'irys-drive': '9PnF5Z8AuWbbQKV6wL7EKQLquNhTvDv6pr6gYzXbfUxm',
  'play-hirys': '78n3sD6YFSADU3tff2KbBwGu6BhqipYEr93fEPbubaap',
  'irys-realms': '3HM28iD2k13qCw1yyV5stqZy1yD3jCEgeg9RsbMuVrit',
  'irys-slot': 'B3aag66tJuhNmsqh3LPVj4kM1sGx9ZnzZu9Cm2ZbEdD9',
  'irys-tarot-card': 'AtzCU6spPnjKHUXdwFnANZWiNFmvoYEaCYrHpRCrhBxN',
  'irys-forum': '9NBhQtdPu7uCkQXov9mfWqtYusJ11ksyZpo6cn8sbPM2',
  'irys-3d': '5xzH3xoCW6PaCjzdpYHQUj8y15rZZwQ1pkwxeeLEWUcG',
  'irys-note': '2PKcFQ15NK3sLgp5XN5ijosFQPh6nbgdypFH9vLwzGgh',
  'irys-vibe-coders-hub': 'AUQHGoMHyVgr2eQT46kTRLLRs63K3DzMFffatbsbvLWN'
};

// Data structure from the actual server data
interface ActualProjectData {
  projectId: string;
  projectName: string;
  dataType: string;
  generatedAt: string;
  dataPoints: number;
  data: Array<{
    timestamp: number; // Already in milliseconds
    count: number;
    period: string;
  }>;
}

// Fetch mutable data for a specific project
async function fetchMutableData(projectId: string): Promise<ActualProjectData | null> {
  const mutableAddress = PROJECT_MUTABLE_ADDRESSES[projectId as keyof typeof PROJECT_MUTABLE_ADDRESSES];
  
  if (!mutableAddress) {
    console.error(`[DataService] No mutable address found for project: ${projectId}`);
    return null;
  }

  try {
    console.log(`[DataService] Fetching mutable address: ${mutableAddress}`);
    
    // First, fetch the mutable address to get the redirect URL
    const mutableResponse = await fetch(`https://gateway.irys.xyz/mutable/${mutableAddress}`, {
      redirect: 'follow',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!mutableResponse.ok) {
      throw new Error(`Failed to fetch data: ${mutableResponse.status} ${mutableResponse.statusText}`);
    }

    const data = await mutableResponse.json() as ActualProjectData;
    
    console.log(`[DataService] Received data for ${projectId}:`, {
      projectName: data.projectName,
      dataPoints: data.dataPoints,
      generatedAt: data.generatedAt
    });
    
    // Validate data structure
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid data structure: missing data array');
    }

    return data;
  } catch (error) {
    console.error(`[DataService] Error fetching data for ${projectId}:`, error);
    return null;
  }
}

// Fetch data for a specific project
export async function fetchProjectData(projectId: string): Promise<QueryResult[]> {
  const address = PROJECT_MUTABLE_ADDRESSES[projectId as keyof typeof PROJECT_MUTABLE_ADDRESSES];
  if (!address) {
    console.error(`[DataService] No mutable address found for project: ${projectId}`);
    return [];
  }
  
  const data = await fetchMutableData(projectId);
  if (!data) {
    return [];
  }
  
  // Convert the actual data to our QueryResult format
  // Check if this is irys-names which has cumulative data
  if (projectId === 'irys-names') {
    console.log(`[DataService] Processing irys-names cumulative data`);
    // For irys-names, the count values are already cumulative
    // We need to convert to incremental values
    const incrementalData: QueryResult[] = [];
    
    for (let i = 0; i < data.data.length; i++) {
      if (i === 0) {
        // First data point uses its count as-is
        incrementalData.push({
          timestamp: data.data[i].timestamp,
          count: data.data[i].count
        });
      } else {
        // Subsequent points use the difference from previous
        const increment = data.data[i].count - data.data[i-1].count;
        // Only add if there's a positive increment
        if (increment > 0) {
          incrementalData.push({
            timestamp: data.data[i].timestamp,
            count: increment
          });
        }
      }
    }
    
    console.log(`[DataService] Converted ${data.data.length} cumulative points to ${incrementalData.length} incremental points`);
    return incrementalData;
  }
  
  // For other projects, data is already in correct format
  return data.data;
}

// Fetch all projects in parallel
export async function fetchAllProjectsData(progressCallback?: (progress: LoadingProgress) => void): Promise<{ [key: string]: QueryResult[] }> {
  const projectIds = Object.keys(PROJECT_MUTABLE_ADDRESSES);
  const results: { [key: string]: QueryResult[] } = {};
  let completed = 0;
  
  console.log('[DataService] Starting to fetch data for all projects');
  
  if (progressCallback) {
    progressCallback({ current: 0, total: projectIds.length, percentage: 0 });
  }
  
  // Fetch all projects in parallel
  const promises = projectIds.map(async (projectId) => {
    try {
      console.log(`[DataService] Fetching data for project: ${projectId}`);
      
      const mutableData = await fetchMutableData(projectId);
      if (mutableData) {
        // Handle special case where API returns different projectId
        // For irys-vibe-coders-hub, API returns "irysvibecodershub"
        if (projectId === 'irys-vibe-coders-hub' && mutableData.projectId === 'irysvibecodershub') {
          console.log(`[DataService] Mapping API projectId "${mutableData.projectId}" to local projectId "${projectId}"`);
        }
        results[projectId] = mutableData.data;
      } else {
        results[projectId] = [];
      }
      
      completed++;
      console.log(`[DataService] Completed ${projectId} (${completed}/${projectIds.length})`);
      
      if (progressCallback) {
        progressCallback({
          current: completed,
          total: projectIds.length,
          percentage: (completed / projectIds.length) * 100
        });
      }
    } catch (error) {
      console.error(`[DataService] Error fetching data for ${projectId}:`, error);
      results[projectId] = [];
    }
  });
  
  await Promise.all(promises);
  
  console.log('[DataService] Completed fetching all project data', Object.keys(results).map(k => `${k}: ${results[k].length} points`));
  
  return results;
} 