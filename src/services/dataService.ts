import type { QueryResult, LoadingProgress } from '../types';
import { executeQuery, getCacheKey, getFromCache, setCache } from '../utils/queryUtils';

// Mutable addresses for each project's data
const PROJECT_MUTABLE_ADDRESSES = {
  'cm-note': 'E6Vxp2LXNtnKa4CPiMtbRyKcZNYHiPjCtpqzb3WnaGsS',
  'githirys': '3iBYVcSnqamdmsj5YTVi4iyapf7HwZjPRJG38pZ8xDHu',
  'irys-names': 'CXNvR5HpcAvmwZMePL5vknEFq8jxJ5Ds5kRAwNJ5uNxn',
  'bridgebox': 'DThGX1CJMtDAR16rXygFneEygjEfbnJj3v3sGna1TrNB',
  'irysdune': '3nupzu4obnuWZa8guuHaiLKprvM9NsYBe46ne1rzphzw',
  'irys-proof-board': 'FeihLByeu1DukYLdwpzwyV1D4MRcU47j6oRQjXHvubB5',
  'irysflip': 'GoGqYGUHnhAFJfetfSBsTiZxeUXGqAjLX75jw9B715J7',
  'irys-crush': '5eFGjKARxZ9eQ2krUnGK3M1FjcRabH69jFfzFz3ckV8q'
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

// Convert server data to QueryResult format
function convertToQueryResult(data: ActualProjectData): QueryResult[] {
  return data.data.map(item => ({
    timestamp: item.timestamp, // Already in milliseconds
    count: item.count
  })).sort((a, b) => a.timestamp - b.timestamp);
}

// Fetch data for a specific project
export async function fetchProjectData(
  projectId: string,
  progressCallback?: (progress: LoadingProgress) => void
): Promise<QueryResult[]> {
  // Check cache first
  const cacheKey = getCacheKey('project-data', { projectId });
  const cached = getFromCache<QueryResult[]>(cacheKey);
  if (cached) {
    console.log(`[DataService] Using cached data for ${projectId} (${cached.length} points)`);
    if (progressCallback) {
      progressCallback({ current: 1, total: 1, percentage: 100 });
    }
    return cached;
  }

  console.log(`[DataService] Fetching fresh data for project: ${projectId}`);

  if (progressCallback) {
    progressCallback({ current: 0, total: 1, percentage: 0 });
  }

  try {
    // Use executeQuery for rate limiting
    const data = await executeQuery(`fetchProjectData-${projectId}`, async () => {
      return await fetchMutableData(projectId);
    });

    if (!data) {
      console.warn(`[DataService] No data found for project: ${projectId}`);
      return [];
    }

    const results = convertToQueryResult(data);
    
    // Cache the results for 5 minutes (server data is pre-processed)
    setCache(cacheKey, results, 5 * 60 * 1000);

    if (progressCallback) {
      progressCallback({ current: 1, total: 1, percentage: 100 });
    }

    console.log(`[DataService] Successfully processed ${results.length} data points for ${projectId}`);
    return results;
  } catch (error) {
    console.error(`[DataService] Error fetching project data for ${projectId}:`, error);
    
    if (progressCallback) {
      progressCallback({ current: 1, total: 1, percentage: 100 });
    }
    
    return [];
  }
}

// Fetch data for multiple projects
export async function fetchMultipleProjectsData(
  projectIds: string[],
  progressCallback?: (progress: LoadingProgress) => void
): Promise<{ [key: string]: QueryResult[] }> {
  const results: { [key: string]: QueryResult[] } = {};
  const total = projectIds.length;
  let completed = 0;

  console.log(`[DataService] Fetching data for ${total} projects:`, projectIds);

  for (const projectId of projectIds) {
    const projectProgressCallback = (progress: LoadingProgress) => {
      const overallProgress = {
        current: completed,
        total,
        percentage: Math.round(((completed + (progress.percentage / 100)) / total) * 100)
      };
      
      if (progressCallback) {
        progressCallback(overallProgress);
      }
    };

    const projectData = await fetchProjectData(projectId, projectProgressCallback);
    results[projectId] = projectData;
    
    completed++;
    if (progressCallback) {
      progressCallback({
        current: completed,
        total,
        percentage: Math.round((completed / total) * 100)
      });
    }
  }

  console.log(`[DataService] Completed fetching data for all projects`);
  return results;
} 