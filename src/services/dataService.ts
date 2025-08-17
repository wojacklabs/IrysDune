import type { QueryResult, LoadingProgress } from '../types';

// Mutable addresses for each project's data
const PROJECT_MUTABLE_ADDRESSES: { [key: string]: string } = {
  'cm-note': 'E6Vxp2LXNtnKa4CPiMtbRyKcZNYHiPjCtpqzb3WnaGsS',
  'githirys': '9unbTk3ykt7aPiq8gKEj6Z9BDUUCLpufSNfpEnXiUnpJ',
  'irys-names': 'CXNvR5HpcAvmwZMePL5vknEFq8jxJ5Ds5kRAwNJ5uNxn',
  'bridgbox': 'DThGX1CJMtDAR16rXygFneEygjEfbnJj3v3sGna1TrNB',
  'irysdune': 'FhQBDN8bJxrXd93DfPG9DcFvVTSaq1AetwhbPEURLFzY',
  'irys-proof-board': 'FeihLByeu1DukYLdwpzwyV1D4MRcU47j6oRQjXHvubB5',
  'irysflip': 'GoGqYGUHnhAFJfetfSBsTiZxeUXGqAjLX75jw9B715J7',
  'irys-crush': '5eFGjKARxZ9eQ2krUnGK3M1FjcRabH69jFfzFz3ckV8q',
  'irys-memory': 'AsoXsWd5LHNFeXFUrfipqFrB3veA9cA4kUcjAKvHa79w',
  'irys-pfp': 'DjtyngmAeV8gNns7TmC2n6sQK3Lv9zdUWsS17Qoz2ZV',
  'play-hirys': '9XVcm5iieaFMoVpdCX73iLYr9YBFpH527EsQNRYZ8ADA',
  'irys-realms': '3HM28iD2k13qCw1yyV5stqZy1yD3jCEgeg9RsbMuVrit'
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
  // The data.data array already has timestamps in milliseconds
  return data.data; // Already in correct format with timestamp and count
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
      
      const projectData = await fetchProjectData(projectId);
      results[projectId] = projectData;
      
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