import { WebUploader } from '@irys/web-upload';
import { WebEthereum } from '@irys/web-upload-ethereum';
import { EthersV6Adapter } from '@irys/web-upload-ethereum-ethers-v6';
import { ethers } from 'ethers';
import type { IrysUploader } from '../types';
import { 
  saveMutableAddress, 
  getAllMutableAddresses,
  saveDashboards 
} from './storageService';

let irysUploader: IrysUploader | null = null;
let lastInitTime: number = 0;
const REINIT_INTERVAL = 30 * 60 * 1000; // 30 minutes
let cachedProvider: ethers.BrowserProvider | null = null;
let cachedAddress: string | null = null;
let initializationPromise: Promise<IrysUploader | null> | null = null;

export async function initializeIrysUploader(): Promise<IrysUploader | null> {
  console.log('[IrysUpload] Initializing Irys uploader...');
  
  // Check if we need to reinitialize (after 30 minutes)
  const now = Date.now();
  if (irysUploader && (now - lastInitTime) < REINIT_INTERVAL) {
    console.log('[IrysUpload] Using existing Irys uploader');
    
    // Verify the connection is still valid
    try {
      if (irysUploader.address) {
        console.log('[IrysUpload] Existing uploader is valid, address:', irysUploader.address);
        return irysUploader;
      }
    } catch (error) {
      console.log('[IrysUpload] Existing uploader invalid, reinitializing...');
      irysUploader = null;
    }
  }
  
  // Check for various wallet providers
  const ethereum = window.ethereum || window.okxwallet || (window.web3 && window.web3.currentProvider);
  
  if (!ethereum) {
    console.error('[IrysUpload] No Ethereum provider found. Please install MetaMask, OKX Wallet, or another Ethereum wallet.');
    return null;
  }

  try {
    // Check if we can reuse cached provider
    let provider = cachedProvider;
    if (!provider || provider.provider !== ethereum) {
      console.log('[IrysUpload] Creating new Ethereum provider...');
      provider = new ethers.BrowserProvider(ethereum);
      cachedProvider = provider;
    } else {
      console.log('[IrysUpload] Reusing cached provider');
    }
    
    // 지갑이 연결되어 있는지 확인
    const accounts = await provider.listAccounts();
    console.log('[IrysUpload] Accounts found:', accounts.length);
    
    if (accounts.length === 0) {
      console.error('[IrysUpload] No accounts connected. Please connect your wallet first.');
      // Try to request accounts
      try {
        console.log('[IrysUpload] Requesting wallet connection...');
        if (ethereum.request) {
          await ethereum.request({ method: 'eth_requestAccounts' });
        } else {
          await provider.send("eth_requestAccounts", []);
        }
        const newAccounts = await provider.listAccounts();
        if (newAccounts.length === 0) {
          console.error('[IrysUpload] Still no accounts after request');
          return null;
        }
        console.log('[IrysUpload] Connected account after request:', newAccounts[0].address);
      } catch (requestError) {
        console.error('[IrysUpload] Error requesting accounts:', requestError);
        return null;
      }
    } else {
      console.log('[IrysUpload] Connected account:', accounts[0].address);
    }
    
    // Signer 가져오기
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    console.log('[IrysUpload] Signer address:', address);
    
    // Check if we're reinitializing with the same address
    if (cachedAddress === address && irysUploader) {
      console.log('[IrysUpload] Same address, checking if existing uploader is still valid...');
      try {
        // Try to use existing uploader
        if (irysUploader.address === address) {
          console.log('[IrysUpload] Existing uploader is still valid, reusing it');
          lastInitTime = now;
          return irysUploader;
        }
      } catch (error) {
        console.log('[IrysUpload] Existing uploader validation failed, creating new one');
      }
    }
    
    console.log('[IrysUpload] Creating Irys uploader...');
    
    // Step 1: Create WebEthereum instance
    const step1Start = Date.now();
    const webEthereum = WebEthereum;
    const step1End = Date.now();
    console.log(`[IrysUpload] Step 1 (WebEthereum) took ${step1End - step1Start}ms`);
    
    // Step 2: Create adapter
    const step2Start = Date.now();
    const adapter = EthersV6Adapter(provider);
    const step2End = Date.now();
    console.log(`[IrysUpload] Step 2 (Adapter) took ${step2End - step2Start}ms`);
    
    // Step 3: Create uploader with adapter
    const step3Start = Date.now();
    const uploader = await WebUploader(webEthereum).withAdapter(adapter);
    const step3End = Date.now();
    console.log(`[IrysUpload] Step 3 (WebUploader) took ${step3End - step3Start}ms`);
    
    // Step 4: Call ready() to complete initialization
    console.log('[IrysUpload] Calling uploader.ready() to complete initialization...');
    const readyStart = Date.now();
    try {
      await uploader.ready();
      const readyEnd = Date.now();
      console.log(`[IrysUpload] ready() completed in ${readyEnd - readyStart}ms`);
    } catch (error) {
      console.error('[IrysUpload] ready() failed:', error);
      throw error;
    }
    
    // Log uploader properties to understand its structure
    console.log('[IrysUpload] Uploader type:', typeof uploader);
    console.log('[IrysUpload] Uploader constructor name:', uploader?.constructor?.name);
    console.log('[IrysUpload] Uploader methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(uploader || {})));
    console.log('[IrysUpload] Uploader properties:', Object.keys(uploader || {}));
    
    // Check for internal Irys instance
    if ((uploader as any)._irys) {
      console.log('[IrysUpload] Found _irys property');
      console.log('[IrysUpload] _irys type:', typeof (uploader as any)._irys);
      console.log('[IrysUpload] _irys methods:', Object.getOwnPropertyNames(Object.getPrototypeOf((uploader as any)._irys || {})).slice(0, 20));
    }
    
    // Try to access signer
    if ((uploader as any).signer || (uploader as any)._signer) {
      console.log('[IrysUpload] Found signer property');
    }
    
    // Try to build/initialize the uploader if build method exists
    if (typeof (uploader as any).build === 'function') {
      console.log('[IrysUpload] Found build method (but skipping as ready() should handle initialization)');
    }
    
    // Try to prepare upload without triggering signatures
    console.log('[IrysUpload] Attempting to prepare upload mechanism...');
    
    // Skip pre-initialization to avoid delays
    console.log('[IrysUpload] Skipping pre-initialization to reduce delays');
    
    const totalTime = Date.now() - step1Start;
    console.log(`[IrysUpload] Total uploader initialization (including ready()) took ${totalTime}ms`);
    
    // Verify the address is properly set after ready()
    if (!uploader.address || uploader.address === "Please run `await Irys.ready()`") {
      console.error('[IrysUpload] Uploader address not properly initialized after ready()');
      console.error('[IrysUpload] Current address:', uploader.address);
      throw new Error('Uploader initialization failed - address not set');
    }
    
    irysUploader = uploader as unknown as IrysUploader;
    cachedAddress = address;
    lastInitTime = now;
    console.log('[IrysUpload] Irys uploader initialized successfully with address:', irysUploader.address);
    console.log('[IrysUpload] Irys uploader details:', {
      address: irysUploader.address,
      uploaderType: uploader.constructor?.name
    });
    
    return irysUploader;
  } catch (error) {
    console.error('[IrysUpload] Error initializing Irys uploader:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('User rejected') || error.message.includes('denied')) {
        console.error('[IrysUpload] User rejected wallet connection');
      } else if (error.message.includes('wallet_requestPermissions')) {
        console.error('[IrysUpload] Wallet permissions issue');
      }
    }
    
    irysUploader = null;
    return null;
  }
}

// Helper function to ensure uploader is ready
export async function ensureUploaderReady(): Promise<IrysUploader | null> {
  // First check if we have a valid cached uploader
  if (irysUploader) {
    try {
      if (irysUploader.address) {
        console.log('[IrysUpload] Using existing uploader, address:', irysUploader.address);
        return irysUploader;
      }
    } catch (error) {
      console.log('[IrysUpload] Existing uploader invalid');
    }
  }
  
  // Check if initialization is already in progress
  if (initializationPromise) {
    console.log('[IrysUpload] Initialization already in progress, waiting...');
    return await initializationPromise;
  }
  
  // Need to initialize
  console.log('[IrysUpload] Uploader not ready, initializing...');
  initializationPromise = initializeIrysUploader();
  const result = await initializationPromise;
  initializationPromise = null;
  return result;
}

// Test function that returns mock data for testing UI
export async function fetchMockDashboards(): Promise<any[]> {
  return [
    {
      id: 'mock-1',
      name: 'Test Dashboard 1',
      description: 'This is a test dashboard',
      author: '0x123...abc',
      authorAddress: '0x1234567890abcdef',
      tags: [{ name: 'App-Name', value: 'test' }],
      chartType: 'line',
      timePeriod: 'month',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      views: 5,
      likes: 2,
      transactionId: 'mock-tx-1'
    }
  ];
}

// Upload dashboard statistics (views, likes)
export async function uploadDashboardStats(
  dashboardId: string, 
  stats: any,
  walletAddress?: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  console.log('[IrysUpload] Uploading dashboard stats...');
  
  const uploader = await ensureUploaderReady();
  if (!uploader) {
    return { success: false, error: 'Failed to initialize Irys uploader' };
  }

  try {
    // Check existing stats root
    const existingRootTxId = statsRootRefs[dashboardId];
    const isFirstUpload = !existingRootTxId;
    
    const data = JSON.stringify(stats);
    const tags = [
      { name: 'App-Name', value: 'IrysDune' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Type', value: 'dashboard-stats' },
      { name: 'Dashboard-ID', value: dashboardId },
      { name: 'Updated-At', value: Date.now().toString() }
    ];

    if (walletAddress) {
      tags.push({ name: 'Updated-By', value: walletAddress });
    }

    if (!isFirstUpload && existingRootTxId) {
      tags.push({ name: 'Root-TX', value: existingRootTxId });
      console.log(`[IrysUpload] Stats update for chain: Root-TX=${existingRootTxId}`);
    }

    console.log('[IrysUpload] Uploading stats with tags:', tags);
    const result = await uploader!.upload(data, { tags });
    console.log('[IrysUpload] Stats upload successful! Transaction ID:', result.id);

    // Update root reference if first upload
    if (isFirstUpload) {
      statsRootRefs[dashboardId] = result.id;
    }

    return { success: true, transactionId: result.id };
  } catch (error) {
    console.error('[IrysUpload] Stats upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload stats';
    return { success: false, error: errorMessage };
  }
}

// Fetch dashboard statistics
export async function fetchDashboardStats(dashboardId: string): Promise<any | null> {
  console.log('[IrysUpload] Fetching stats for dashboard:', dashboardId);
  
  try {
    // Query for stats transactions
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["IrysDune"] },
            { name: "Type", values: ["dashboard-stats"] },
            { name: "Dashboard-ID", values: ["${dashboardId}"] }
          ],
          first: 100,
          order: DESC
        ) {
          edges {
            node {
              id
              tags { name value }
            }
          }
        }
      }
    `;

    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const result = await response.json();
    if (!result.data?.transactions?.edges?.length) {
      console.log('[IrysUpload] No stats found for dashboard');
      return null;
    }

    // Find the root transaction
    let rootTxId = null;
    for (const edge of result.data.transactions.edges) {
      const tags = edge.node.tags || [];
      const hasRootTag = tags.some((tag: any) => tag.name === 'Root-TX');
      
      if (!hasRootTag) {
        rootTxId = edge.node.id;
        statsRootRefs[dashboardId] = rootTxId;
        break;
      }
    }

    if (!rootTxId) {
      console.log('[IrysUpload] No root stats transaction found');
      return null;
    }

    // Fetch from mutable address
    const mutableAddress = `https://gateway.irys.xyz/mutable/${rootTxId}`;
    console.log('[IrysUpload] Fetching stats from:', mutableAddress);
    
    const dataResponse = await fetch(mutableAddress);
    if (dataResponse.ok) {
      const stats = await dataResponse.json();
      console.log('[IrysUpload] Stats loaded:', stats);
      return stats;
    }

    return null;
  } catch (error) {
    console.error('[IrysUpload] Error fetching stats:', error);
    return null;
  }
}

// Update view count
export async function incrementDashboardView(
  dashboardId: string,
  walletAddress?: string
): Promise<boolean> {
  try {
    // Fetch current stats
    let stats = await fetchDashboardStats(dashboardId);
    
    if (!stats) {
      stats = {
        dashboardId,
        views: 0,
        likes: 0,
        likedBy: [],
        viewedBy: {}
      };
    }

    // Increment view count
    stats.views = (stats.views || 0) + 1;
    
    // Track viewer if wallet connected
    if (walletAddress) {
      if (!stats.viewedBy) stats.viewedBy = {};
      stats.viewedBy[walletAddress] = (stats.viewedBy[walletAddress] || 0) + 1;
    }

    // Upload updated stats
    const result = await uploadDashboardStats(dashboardId, stats, walletAddress);
    return result.success;
  } catch (error) {
    console.error('[IrysUpload] Error incrementing view:', error);
    return false;
  }
}

// Toggle like
export async function toggleDashboardLike(
  dashboardId: string,
  walletAddress: string
): Promise<{ success: boolean; liked: boolean; likes: number }> {
  console.log('[IrysUpload] Toggling like for dashboard:', dashboardId, 'by wallet:', walletAddress);
  
  try {
    // Fetch current stats
    let stats = await fetchDashboardStats(dashboardId);
    console.log('[IrysUpload] Current stats:', stats);
    
    if (!stats) {
      console.log('[IrysUpload] No existing stats, creating new ones');
      stats = {
        dashboardId,
        views: 0,
        likes: 0,
        likedBy: [],
        viewedBy: {}
      };
    }

    if (!stats.likedBy) stats.likedBy = [];

    // Check if already liked
    const alreadyLiked = stats.likedBy.includes(walletAddress);
    console.log('[IrysUpload] Already liked?', alreadyLiked, 'likedBy:', stats.likedBy);
    
    if (alreadyLiked) {
      // Unlike
      stats.likedBy = stats.likedBy.filter((addr: string) => addr !== walletAddress);
      stats.likes = Math.max(0, (stats.likes || 0) - 1);
      console.log('[IrysUpload] Unliked. New likes:', stats.likes);
    } else {
      // Like
      stats.likedBy.push(walletAddress);
      stats.likes = (stats.likes || 0) + 1;
      console.log('[IrysUpload] Liked. New likes:', stats.likes);
    }

    // Upload updated stats
    const result = await uploadDashboardStats(dashboardId, stats, walletAddress);
    console.log('[IrysUpload] Upload result:', result);
    
    return {
      success: result.success,
      liked: !alreadyLiked,
      likes: stats.likes
    };
  } catch (error) {
    console.error('[IrysUpload] Error toggling like:', error);
    return { success: false, liked: false, likes: 0 };
  }
}

// Expose debugging functions for browser console
if (typeof window !== 'undefined') {
  (window as any).irysDebug = {
    fetchAllTransactions: debugFetchAllTransactions,
    fetchTransaction: debugFetchTransaction,
    fetchDashboards: fetchDashboards,
    fetchMockDashboards: fetchMockDashboards,
    verifyTransactionTags: verifyTransactionTags,
    fetchDashboardStats: fetchDashboardStats,
    uploadDashboardStats: uploadDashboardStats
  };
}

// Store mutable references for dashboards by dashboard ID
const dashboardMutableRefs: { [dashboardId: string]: { rootTxId: string; mutableAddress: string } } = {};

// Store mutable references for dashboard stats
const statsRootRefs: { [dashboardId: string]: string } = {};

export async function uploadDashboard(dashboard: any): Promise<{ success: boolean; transactionId?: string; mutableAddress?: string; rootTxId?: string; error?: string }> {
  console.log('[IrysUpload] Starting dashboard upload...');
  const uploadStartTime = Date.now();
  
  console.log('[IrysUpload] Ensuring uploader is ready...');
  const uploaderStartTime = Date.now();
  const uploader = await ensureUploaderReady();
  const uploaderEndTime = Date.now();
  console.log(`[IrysUpload] Uploader ready check took ${uploaderEndTime - uploaderStartTime}ms`);
  
  // Log uploader state
  if (uploader) {
    console.log('[IrysUpload] Uploader state check:');
    console.log('[IrysUpload] - Has address:', !!uploader.address);
    console.log('[IrysUpload] - Has upload method:', typeof uploader.upload === 'function');
    console.log('[IrysUpload] - Uploader type:', uploader.constructor?.name);
    console.log('[IrysUpload] - Time since initialization:', lastInitTime ? Date.now() - lastInitTime : 'unknown');
  }
  
  if (!uploader) {
    console.error('[IrysUpload] Failed to initialize Irys uploader for dashboard upload');
    return { success: false, error: 'Failed to initialize Irys uploader. Please check your wallet connection.' };
  }

  try {
    console.log('[IrysUpload] Preparing dashboard data:', dashboard);
    
    // Check if this dashboard has existing mutable reference (for updates)
    const existingRef = dashboard.rootTxId ? dashboardMutableRefs[dashboard.id] : null;
    const isFirstUpload = !existingRef && !dashboard.rootTxId;
    
    const dataString = JSON.stringify(dashboard);
    // Convert to Buffer for Irys upload
    const data = Buffer.from(dataString, 'utf-8');
    
    console.log('[IrysUpload] Data prepared:', {
      stringLength: dataString.length,
      bufferByteLength: data.byteLength,
      isBuffer: Buffer.isBuffer(data)
    });
    
    const tags = [
      { name: 'App-Name', value: 'IrysDune' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Type', value: 'dashboard' },
      { name: 'Author', value: dashboard.authorAddress },
      { name: 'Dashboard-Name', value: dashboard.name },
      { name: 'Dashboard-ID', value: dashboard.id },
      { name: 'Created-At', value: dashboard.createdAt.toString() },
      { name: 'Updated-At', value: dashboard.updatedAt.toString() },
      { name: 'Wallet-Address', value: dashboard.authorAddress },
      { name: 'Chart-Count', value: dashboard.charts?.length?.toString() || '0' }
    ];

    // Add Root-TX tag if this is an update to existing mutable chain
    const rootTxId = dashboard.rootTxId || existingRef?.rootTxId;
    if (!isFirstUpload && rootTxId) {
      tags.push({ name: 'Root-TX', value: rootTxId });
      console.log(`[IrysUpload] Mutable chain update: Root-TX=${rootTxId}`);
    } else {
      console.log('[IrysUpload] First upload - creating new mutable chain');
    }

    console.log('[IrysUpload] Upload data size:', data.byteLength, 'bytes, tags:', tags.length);

        console.log('[IrysUpload] Calling upload with options:', { tags });
    const uploadCallStart = Date.now();
    
    // Try to force eager initialization
    console.log('[IrysUpload] Checking uploader readiness...');
    try {
      // Check if uploader is properly initialized
      if (uploader && uploader.address) {
        console.log('[IrysUpload] Uploader is ready with address:', uploader.address);
      }
    } catch (error) {
      console.log('[IrysUpload] Ready check error (continuing):', error);
    }
    
    console.log('[IrysUpload] Starting actual upload...');
    console.log('[IrysUpload] Data to upload:', data.byteLength, 'bytes');
    console.log('[IrysUpload] Number of tags:', tags.length);
    
    // Log time from dashboard upload start to this point
    console.log(`[IrysUpload] Time from upload start to pre-upload: ${Date.now() - uploadStartTime}ms`);
    
    // Try to get price before upload to ensure pricing is initialized
    if (typeof uploader!.getPrice === 'function') {
      try {
        const priceStart = Date.now();
        const price = await uploader!.getPrice(data.byteLength);
        const priceEnd = Date.now();
        console.log(`[IrysUpload] Price check took ${priceEnd - priceStart}ms, price:`, price);
      } catch (error) {
        console.log('[IrysUpload] Price check failed:', error);
      }
    } else {
      console.log('[IrysUpload] getPrice method not available');
    }
    
    console.log('[IrysUpload] Calling upload method NOW...');
    console.log(`[IrysUpload] Time from upload start to upload call: ${Date.now() - uploadStartTime}ms`);
    
    const uploadMethodStart = Date.now();
    
    // Log when we're about to call upload
    console.log('[IrysUpload] Calling uploader.upload()...');
    
    const result = await uploader!.upload(data, { tags });
    
    const uploadMethodEnd = Date.now();
    console.log(`[IrysUpload] Upload method execution took ${uploadMethodEnd - uploadMethodStart}ms`);
    
    const uploadCallEnd = Date.now();
    console.log(`[IrysUpload] Upload call took ${uploadCallEnd - uploadCallStart}ms`);
    console.log('[IrysUpload] Upload successful! Transaction ID:', result.id);
    console.log('[IrysUpload] Full upload result:', result);
    
    const totalUploadTime = Date.now() - uploadStartTime;
    console.log(`[IrysUpload] Total upload process took ${totalUploadTime}ms`);
    
    // Verify tags were attached
    console.log('[IrysUpload] Verifying uploaded transaction tags...');
    setTimeout(() => {
      verifyTransactionTags(result.id);
    }, 3000); // Wait 3 seconds for indexing
    
    // Mutable chain management
    let finalRootTxId: string;
    let mutableAddress: string;
    
    if (isFirstUpload) {
      // First upload: current ID becomes rootTxId
      finalRootTxId = result.id;
      mutableAddress = `https://gateway.irys.xyz/mutable/${result.id}`;
      console.log(`[IrysUpload] New mutable chain created for dashboard ${dashboard.id}: ${mutableAddress}`);
      
      // Store reference by dashboard ID
      dashboardMutableRefs[dashboard.id] = { rootTxId: finalRootTxId, mutableAddress };
      // Save to local storage
      saveMutableAddress(dashboard.id, finalRootTxId, mutableAddress);
    } else {
      // Subsequent upload: maintain existing rootTxId
      finalRootTxId = rootTxId || existingRef?.rootTxId || result.id;
      mutableAddress = `https://gateway.irys.xyz/mutable/${finalRootTxId}`;
      console.log(`[IrysUpload] Mutable chain updated for dashboard ${dashboard.id}: ${mutableAddress} -> ${result.id}`);
      
      // Update reference
      dashboardMutableRefs[dashboard.id] = { rootTxId: finalRootTxId, mutableAddress };
      // Save to local storage
      saveMutableAddress(dashboard.id, finalRootTxId, mutableAddress);
    }
    
    return { 
      success: true, 
      transactionId: result.id,
      mutableAddress: mutableAddress,
      rootTxId: finalRootTxId
    };
  } catch (error) {
    console.error('[IrysUpload] Error uploading to Irys:', error);
    
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds to upload. Please add funds to your wallet.';
      } else if (errorMessage.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (errorMessage.includes('user rejected')) {
        errorMessage = 'Transaction was rejected. Please approve the transaction to upload.';
      }
    }
    
    return { 
      success: false, 
      error: errorMessage
    };
  }
}

// Helper function to calculate dateRange based on upload timestamp
function calculateDateRangeForCharts(charts: any[], uploadTimestamp: number): any[] {
  return charts?.map((chart: any) => {
    const uploadDate = uploadTimestamp;
    let startDate: number;
    
    console.log(`[IrysUpload] Setting dateRange for chart "${chart.title}" with uploadDate: ${new Date(uploadDate).toISOString()}`);
    
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
  }) || [];
}

export async function fetchDashboards(): Promise<any[]> {
  console.log('[IrysUpload] Starting dashboard fetch...');

  try {
    // First check if we have cached mutable addresses
    const cachedAddresses = getAllMutableAddresses();
    const dashboards: any[] = [];
    const dashboardsToQuery: string[] = [];
    
    // Try to fetch dashboards using cached mutable addresses
    for (const [dashboardId, addressInfo] of Object.entries(cachedAddresses)) {
      try {
        const mutableUrl = addressInfo.mutableAddress || `https://gateway.irys.xyz/mutable/${addressInfo.rootTxId}`;
        console.log(`[IrysUpload] Fetching dashboard ${dashboardId} from cached mutable address:`, mutableUrl);
        
        const response = await fetch(mutableUrl);
        if (response.ok) {
          const dashboardData = await response.json();
          
          // Use dashboard's createdAt timestamp to calculate dateRange
          const timestamp = dashboardData.createdAt || dashboardData.updatedAt;
          
          if (timestamp) {
            console.log(`[IrysUpload] Using dashboard createdAt: ${timestamp} (${new Date(timestamp).toISOString()})`);
            dashboardData.charts = calculateDateRangeForCharts(dashboardData.charts, timestamp);
          } else {
            console.log(`[IrysUpload] No createdAt/updatedAt found for dashboard ${dashboardId}`);
          }
          
          // Fetch stats for this dashboard
          const stats = await fetchDashboardStats(dashboardId);
          
          const finalDashboard = {
            ...dashboardData,
            transactionId: addressInfo.rootTxId,
            mutableAddress: mutableUrl,
            rootTxId: addressInfo.rootTxId,
            views: stats?.views || 0,
            likes: stats?.likes || 0,
            likedBy: stats?.likedBy || [] // Include likedBy for frontend use
          };
          
          // Log final dashboard dateRange status
          console.log(`[IrysUpload] Final dashboard "${finalDashboard.name}" charts:`, 
            finalDashboard.charts?.map((c: any) => ({
              title: c.title,
              hasDateRange: !!c.dateRange,
              dateRange: c.dateRange
            }))
          );
          
          dashboards.push(finalDashboard);
          
          console.log(`[IrysUpload] Successfully loaded dashboard from cache: ${dashboardData.name}`);
        } else {
          console.log(`[IrysUpload] Failed to fetch from cached mutable address, will query: ${dashboardId}`);
          dashboardsToQuery.push(dashboardId);
        }
      } catch (error) {
        console.error(`[IrysUpload] Error fetching dashboard ${dashboardId} from cache:`, error);
        dashboardsToQuery.push(dashboardId);
      }
    }
    // Query for transactions with Root-TX tag (these are root transactions)
    const rootTransactionsQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["IrysDune"] },
            { name: "Type", values: ["dashboard"] }
          ],
          first: 100,
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

    console.log('[IrysUpload] Fetching dashboard root transactions...');
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: rootTransactionsQuery }),
    });

    const result = await response.json();
    console.log('[IrysUpload] Query result:', result);

    if (result.errors) {
      console.error('[IrysUpload] GraphQL errors:', result.errors);
      return [];
    }

    if (!result.data?.transactions?.edges) {
      console.log('[IrysUpload] No transactions found');
      return [];
    }

    const allTransactions = result.data.transactions.edges;
    console.log('[IrysUpload] Found', allTransactions.length, 'transactions');

    // Group by dashboard ID and find root transactions
    const dashboardRootTxMap = new Map<string, { rootTxId: string; latestTxId: string; timestamp?: number }>();
    
    for (const edge of allTransactions) {
      const tags = edge.node.tags || [];
      const dashboardIdTag = tags.find((tag: any) => tag.name === 'Dashboard-ID');
      const rootTxTag = tags.find((tag: any) => tag.name === 'Root-TX');
      
      if (dashboardIdTag) {
        const dashboardId = dashboardIdTag.value;
        
        if (!rootTxTag) {
          // This is a root transaction
          if (!dashboardRootTxMap.has(dashboardId)) {
            dashboardRootTxMap.set(dashboardId, { 
              rootTxId: edge.node.id, 
              latestTxId: edge.node.id,
              timestamp: edge.node.timestamp // Irys timestamp is already in milliseconds
            });
            console.log(`[IrysUpload] Found root tx for dashboard ${dashboardId}: ${edge.node.id}`);
            console.log(`[IrysUpload] Timestamp: ${edge.node.timestamp} (${new Date(edge.node.timestamp).toISOString()})`);
          }
        } else {
          // This is an update - only store if it's newer than what we have
          const existing = dashboardRootTxMap.get(dashboardId);
          if (!existing || existing.rootTxId === rootTxTag.value) {
            dashboardRootTxMap.set(dashboardId, { 
              rootTxId: rootTxTag.value, 
              latestTxId: edge.node.id,
              timestamp: existing?.timestamp || edge.node.timestamp // Preserve original timestamp
            });
            console.log(`[IrysUpload] Found update for dashboard ${dashboardId}: root=${rootTxTag.value}, latest=${edge.node.id}`);
          }
        }
      }
    }

    console.log('[IrysUpload] Found', dashboardRootTxMap.size, 'unique dashboards');

    // Create a set of already loaded dashboard IDs for deduplication
    const loadedDashboardIds = new Set(dashboards.map(d => d.id));
    
    // Fetch latest data from mutable addresses for remaining dashboards
    for (const [dashboardId, { rootTxId, timestamp }] of dashboardRootTxMap) {
      // Skip if already loaded from cache
      if (loadedDashboardIds.has(dashboardId)) {
        console.log(`[IrysUpload] Skipping dashboard ${dashboardId} - already loaded from cache`);
        continue;
      }
      
      try {
        const mutableAddress = `https://gateway.irys.xyz/mutable/${rootTxId}`;
        console.log(`[IrysUpload] Fetching dashboard ${dashboardId} from mutable address: ${mutableAddress}`);
        
        const dataResponse = await fetch(mutableAddress);
        
        if (dataResponse.ok) {
          const dashboardData = await dataResponse.json();
          
          // Use dashboard's createdAt timestamp to calculate dateRange
          const dashboardTimestamp = dashboardData.createdAt || dashboardData.updatedAt || timestamp;
          
          if (dashboardTimestamp) {
            console.log(`[IrysUpload] Using dashboard timestamp: ${dashboardTimestamp} (${new Date(dashboardTimestamp).toISOString()})`);
            dashboardData.charts = calculateDateRangeForCharts(dashboardData.charts, dashboardTimestamp);
          } else {
            console.log(`[IrysUpload] No timestamp found for dashboard ${dashboardId}`);
          }
          
          // Fetch stats for this dashboard
          const stats = await fetchDashboardStats(dashboardId);
          
          const finalDashboard = {
            ...dashboardData,
            transactionId: rootTxId,
            mutableAddress: mutableAddress,
            rootTxId: rootTxId,
            views: stats?.views || 0,
            likes: stats?.likes || 0,
            likedBy: stats?.likedBy || [] // Include likedBy for frontend use
          };
          
          // Log final dashboard dateRange status
          console.log(`[IrysUpload] Final dashboard "${finalDashboard.name}" charts:`, 
            finalDashboard.charts?.map((c: any) => ({
              title: c.title,
              hasDateRange: !!c.dateRange,
              dateRange: c.dateRange
            }))
          );
          
          dashboards.push(finalDashboard);
          
          // Save mutable address to cache
          saveMutableAddress(dashboardId, rootTxId, mutableAddress);
          
          console.log('[IrysUpload] Successfully loaded dashboard:', dashboardData.name, 'with stats:', stats);
        } else {
          console.error('[IrysUpload] Failed to fetch from mutable address:', mutableAddress, dataResponse.status);
        }
      } catch (error) {
        console.error('[IrysUpload] Error fetching dashboard:', dashboardId, error);
      }
    }

    // Remove duplicates before saving and returning
    const uniqueDashboards = dashboards.filter((dashboard, index, self) =>
      index === self.findIndex((d) => d.id === dashboard.id)
    );
    
    // Save all dashboards to cache
    saveDashboards(uniqueDashboards);
    
    console.log('[IrysUpload] Total dashboards loaded:', uniqueDashboards.length, '(from', dashboards.length, 'with duplicates removed)');
    return uniqueDashboards;

  } catch (error) {
    console.error('[IrysUpload] Fatal error:', error);
    return [];
  }
}

// Verify uploaded transaction tags
export async function verifyTransactionTags(txId: string): Promise<void> {
  console.log(`[IrysDebug] Verifying tags for transaction: ${txId}`);
  
  try {
    const query = `
      query {
        transaction(id: "${txId}") {
          id
          tags {
            name
            value
          }
        }
      }
    `;
    
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    
    const result = await response.json();
    console.log('[IrysDebug] Transaction query result:', result);
    
    if (result.data?.transaction?.tags) {
      console.log('[IrysDebug] Transaction tags:');
      result.data.transaction.tags.forEach((tag: any, index: number) => {
        console.log(`  Tag ${index}: ${tag.name} = ${tag.value}`);
      });
    } else {
      console.log('[IrysDebug] No tags found for this transaction');
    }
  } catch (error) {
    console.error('[IrysDebug] Error verifying transaction:', error);
  }
}

// Debug function: Fetch all IrysDune transactions
export async function debugFetchAllTransactions(): Promise<void> {
  console.log('[IrysDebug] === Starting to fetch all IrysDune transactions ===');
  
  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["IrysDune"] }
        ],
        first: 20,
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

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    
    console.log('[IrysDebug] GraphQL Response:', result);
    
    if (result.errors) {
      console.error('[IrysDebug] GraphQL Errors:', result.errors);
    }
    
    if (result.data && result.data.transactions && result.data.transactions.edges) {
      const edges = result.data.transactions.edges;
      console.log(`[IrysDebug] Found ${edges.length} transactions:`);
      
      edges.forEach((edge: any, index: number) => {
        console.log(`[IrysDebug] Transaction ${index + 1}:`);
        console.log(`  ID: ${edge.node.id}`);
        console.log(`  Timestamp: ${edge.node.timestamp}`);
        console.log(`  Tags:`, edge.node.tags);
        
        // Type 태그 확인
        const typeTag = edge.node.tags?.find((tag: any) => tag.name === 'Type');
        if (typeTag) {
          console.log(`  Type: ${typeTag.value}`);
        }
      });
    }
    
    console.log('[IrysDebug] === Fetch completed ===');
  } catch (error) {
    console.error('[IrysDebug] Error:', error);
  }
}

// 특정 트랜잭션 ID로 데이터 조회
export async function debugFetchTransaction(txId: string): Promise<void> {
  console.log(`[IrysDebug] Fetching transaction data: ${txId}`);
  
  try {
    const response = await fetch(`https://gateway.irys.xyz/${txId}`);
    
    if (!response.ok) {
      console.error(`[IrysDebug] HTTP Error: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    console.log('[IrysDebug] Transaction data:', data);
  } catch (error) {
    console.error('[IrysDebug] Error fetching transaction:', error);
  }
}

export async function fetchDashboard(transactionId: string): Promise<any | null> {
  try {
    const response = await fetch(`https://gateway.irys.xyz/${transactionId}`);
    const data = await response.json();
    return {
      ...data,
      transactionId
    };
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return null;
  }
} 