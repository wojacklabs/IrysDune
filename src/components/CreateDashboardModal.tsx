import React, { useState, useEffect } from 'react';
import type { Dashboard, Tag, ChartType, ChartConfig, QueryResult, AbiFunction, IrysUploader, LoadingProgress as LoadingProgressType } from '../types';
import { APP_PRESETS } from '../constants/appPresets';
import { uploadDashboard, initializeIrysUploader } from '../services/irysUploadService';
import { queryTagCounts } from '../services/irysService';
import { ON_CHAIN_PRESETS, queryOnChainData } from '../services/onChainService';
import { generateChartData, filterDataByPeriod } from '../utils/chartUtils';
import { getCachedData, waitForCache } from '../services/storageService';
import Chart from './Chart';
import LoadingProgress from './LoadingProgress';
import { ethers } from 'ethers';

// Dashboard Contract configuration
const DASHBOARD_CONTRACT_ADDRESS = '0xcEFd26e34d86d07F04D21eDA589b4C81D4f4FcA4';
const IRYS_TESTNET_RPC = 'https://testnet-rpc.irys.xyz/v1/execution-rpc';
const DASHBOARD_ABI = [
  'function payForArticle() payable',
  'function ARTICLE_PRICE() view returns (uint256)',
  'event ArticlePaymentReceived(address indexed payer, uint256 amount, uint256 articleId, uint256 timestamp)',
  'function totalArticles() view returns (uint256)',
  'function userArticleCount(address user) view returns (uint256)'
];

interface CreateDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (dashboard: Dashboard) => void;
  authorAddress: string;
  authorName?: string;
  existingDashboard?: Dashboard;
  trendData?: { [key: string]: QueryResult[] };
}

export const CreateDashboardModal: React.FC<CreateDashboardModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  authorAddress,
  authorName,
  existingDashboard,
  trendData
}) => {
  const [name, setName] = useState(existingDashboard?.name || '');
  const [description, setDescription] = useState(existingDashboard?.description || '');
  const [charts, setCharts] = useState<ChartConfig[]>(existingDashboard?.charts || []);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [loadingChartId, setLoadingChartId] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ [chartId: string]: any }>({});
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgressType | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<string>('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploaderInstance, setUploaderInstance] = useState<IrysUploader | null>(null);

  // Current chart being edited
  const [editingChart, setEditingChart] = useState<ChartConfig | null>(null);
  const [chartTitle, setChartTitle] = useState('');
  const [chartDescription, setChartDescription] = useState('');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [customTags, setCustomTags] = useState<Tag[]>([]);
  const [selectedQueries, setSelectedQueries] = useState<Array<{
    id: string;
    name: string;
    tags: Tag[];
    color: string;
    isGroup?: boolean;
    groupName?: string;
  }>>([]);

  // On-chain query related state
  const [queryMode, setQueryMode] = useState<'storage' | 'onchain'>('storage');
  const [contractAddress, setContractAddress] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('mainnet');
  const [rpcUrl, setRpcUrl] = useState('');
  const [abiInputs, setAbiInputs] = useState<string[]>(['']);
  const [parsedAbis, setParsedAbis] = useState<AbiFunction[]>([]);
  const [onChainDisplayMode, setOnChainDisplayMode] = useState<'combined' | 'separated'>('separated');
  const [selectedOnChainPreset, setSelectedOnChainPreset] = useState<string>('');
  const [selectedPlayHirysGame, setSelectedPlayHirysGame] = useState<string>('');

  // State for custom tag input
  const [newTagName, setNewTagName] = useState('');
  const [newTagValue, setNewTagValue] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  
  // State for custom tag groups
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupTags, setGroupTags] = useState<Tag[]>([]);
  const [currentGroupTag, setCurrentGroupTag] = useState({ name: '', value: '' });
  
  // State for custom query options
  const [showCustomOptions, setShowCustomOptions] = useState(false);
  
  // Chart preview state
  const [showPreview, setShowPreview] = useState<{ [chartId: string]: boolean }>({});

  useEffect(() => {
    if (existingDashboard) {
      setName(existingDashboard.name);
      setDescription(existingDashboard.description);
      setCharts(existingDashboard.charts);
    }
  }, [existingDashboard]);

  // Initialize uploader when modal opens for new dashboards
  useEffect(() => {
    if (isOpen && !existingDashboard && !uploaderInstance) {
      console.log('[CreateDashboard] Pre-initializing Irys uploader on modal open...');
      
      // Check if we already have an initialized uploader
      initializeIrysUploader().then(uploader => {
        if (uploader) {
          console.log('[CreateDashboard] Irys uploader pre-initialized successfully');
          setUploaderInstance(uploader);
        }
      }).catch(err => {
        console.error('[CreateDashboard] Failed to pre-initialize Irys uploader:', err);
      });
    }
  }, [isOpen, existingDashboard, uploaderInstance]);

  if (!isOpen) return null;

  const addCustomTag = () => {
    if (!newTagName.trim() || !newTagValue.trim()) {
      return;
    }
    
    const newTag = { name: newTagName.trim(), value: newTagValue.trim() };
    setCustomTags([...customTags, newTag]);
    
    // Add as a query immediately
    const queryName = `${newTag.name}: ${newTag.value}`;
    const newQuery = {
      id: `custom-${Date.now()}`,
      name: queryName,
      tags: [newTag],
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
    };
    setSelectedQueries([...selectedQueries, newQuery]);
    
    setNewTagName('');
    setNewTagValue('');
    setShowTagInput(false);
  };

  const removeCustomTag = (index: number) => {
    const tagToRemove = customTags[index];
    setCustomTags(customTags.filter((_, i) => i !== index));
    // Also remove from selected queries
    setSelectedQueries(selectedQueries.filter(q => 
      !q.tags.some(t => t.name === tagToRemove.name && t.value === tagToRemove.value)
    ));
  };

  const addTagToGroup = () => {
    if (!currentGroupTag.name.trim() || !currentGroupTag.value.trim()) {
      return;
    }
    
    setGroupTags([...groupTags, { 
      name: currentGroupTag.name.trim(), 
      value: currentGroupTag.value.trim() 
    }]);
    setCurrentGroupTag({ name: '', value: '' });
  };

  const removeTagFromGroup = (index: number) => {
    setGroupTags(groupTags.filter((_, i) => i !== index));
  };

  const createTagGroup = () => {
    if (!groupName.trim() || groupTags.length === 0) {
      return;
    }
    
    // Create a group query with all tags
    const newQuery = {
      id: `group-${Date.now()}`,
      name: groupName.trim(),
      tags: [...groupTags],
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      isGroup: true,
      groupName: groupName.trim()
    };
    
    setSelectedQueries([...selectedQueries, newQuery]);
    setCustomTags([...customTags, ...groupTags]);
    
    // Reset group input
    setGroupName('');
    setGroupTags([]);
    setShowGroupInput(false);
  };

  const togglePreset = (presetId: string) => {
    const preset = APP_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    const existingQuery = selectedQueries.find(q => q.id === presetId);
    if (existingQuery) {
      setSelectedQueries(selectedQueries.filter(q => q.id !== presetId));
    } else {
      const newQuery = {
        id: presetId,
        name: preset.name,
        tags: preset.tags,
        color: preset.color
      };
      setSelectedQueries([...selectedQueries, newQuery]);
    }
  };

  const removeQuery = (queryId: string) => {
    setSelectedQueries(selectedQueries.filter(q => q.id !== queryId));
    // If it's a custom query, also remove from customTags
    if (queryId.startsWith('custom-')) {
      const query = selectedQueries.find(q => q.id === queryId);
      if (query && query.tags.length === 1) {
        const tag = query.tags[0];
        setCustomTags(customTags.filter(t => t.name !== tag.name || t.value !== tag.value));
      }
    }
  };

  const addChart = () => {
    if (!chartTitle.trim()) {
      setError('Please enter a chart title');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (queryMode === 'storage' && selectedQueries.length === 0 && customTags.length === 0) {
      setError('Please select at least one data source or add custom tags');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (queryMode === 'onchain' && !selectedOnChainPreset && (!contractAddress.trim() || !rpcUrl.trim())) {
      setError('Please enter a contract address and RPC URL or select a preset');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const newChart: ChartConfig = {
      id: `chart-${Date.now()}`,
      name: chartTitle.trim(), // for compatibility
      title: chartTitle.trim(),
      description: chartDescription.trim(),
      queries: queryMode === 'storage' ? selectedQueries : [],
      chartType,
      timePeriod,
      color: '#3b82f6', // default color for compatibility
      tags: [], // legacy support
      ...(queryMode === 'onchain' ? {
        onChainQuery: {
          contractAddress: contractAddress.trim(),
          network: selectedNetwork,
          rpcUrl: rpcUrl.trim(),
          abis: parsedAbis.filter(abi => abi !== null)
        },
        displayMode: onChainDisplayMode
      } : {})
    };

    if (editingChart) {
      setCharts(charts.map(c => c.id === editingChart.id ? newChart : c));
      setEditingChart(null);
    } else {
      setCharts([...charts, newChart]);
    }

    // Reset chart form
    setChartTitle('');
    setChartDescription('');
    setChartType('line');
    setTimePeriod('month');
    setCustomTags([]);
    setSelectedQueries([]);
    setQueryMode('storage');
    setContractAddress('');
    setSelectedNetwork('mainnet');
    setRpcUrl('');
    setAbiInputs(['']);
    setParsedAbis([]);
    setOnChainDisplayMode('separated');
    setSelectedOnChainPreset('');
  };

  const editChart = (chart: ChartConfig) => {
    setEditingChart(chart);
    setChartTitle(chart.title);
    setChartDescription(chart.description || '');
    setChartType(chart.chartType);
    setTimePeriod(chart.timePeriod);
    
    if (chart.onChainQuery) {
      setQueryMode('onchain');
      setContractAddress(chart.onChainQuery.contractAddress);
      setSelectedNetwork(chart.onChainQuery.network || 'mainnet');
      setRpcUrl(chart.onChainQuery.rpcUrl || '');
      setAbiInputs(chart.onChainQuery.abis?.map(abi => JSON.stringify(abi, null, 2)) || ['']);
      setParsedAbis(chart.onChainQuery.abis || []);
      setOnChainDisplayMode(chart.displayMode || 'separated');
    } else {
      setQueryMode('storage');
      setSelectedQueries(chart.queries || []);
      
      // Reconstruct custom tags from queries
      const customFromQueries = chart.queries?.filter(q => q.id.startsWith('custom-')) || [];
      const tags: Tag[] = [];
      customFromQueries.forEach(q => tags.push(...q.tags));
      setCustomTags(tags);
    }
  };

  const removeChart = (chartId: string) => {
    setCharts(charts.filter(c => c.id !== chartId));
    const newChartData = { ...chartData };
    delete newChartData[chartId];
    setChartData(newChartData);
  };

  const togglePreview = (chartId: string) => {
    setShowPreview(prev => ({
      ...prev,
      [chartId]: !prev[chartId]
    }));
    
    // Load data if not already loaded
    if (!chartData[chartId] && !showPreview[chartId]) {
      const chart = charts.find(c => c.id === chartId);
      if (chart) {
        loadChartData(chart);
      }
    }
  };

  const loadChartData = async (chart: ChartConfig) => {
    setLoadingChartId(chart.id);
    setLoadingProgress({ current: 0, total: 1, percentage: 0 });
    
    try {
      // For on-chain queries
      if (chart.onChainQuery) {
        const monthsMap = {
          'week': 0.25,
          'month': 1,
          'quarter': 3,
          'year': 12
        };
        const months = monthsMap[chart.timePeriod] || 6;
        
        const data = await queryOnChainData(
          {
            ...chart.onChainQuery,
            rpcUrl: chart.onChainQuery.rpcUrl || ''
          },
          (progress) => setLoadingProgress(progress),
          { months }
        );
        
        const processedData = generateChartData(
          { [chart.id]: data },
          [{
            id: chart.id,
            name: chart.title,
            tags: [],
            color: '#3b82f6'
          }],
          chart.chartType,
          false,
          true,
          chart.displayMode
        );
        
        setChartData(prev => ({
          ...prev,
          [chart.id]: processedData
        }));
      } else {
        // Storage query logic
        const allData: { [queryId: string]: QueryResult[] } = {};
        const queries = chart.queries || [];
        
        // Check if all queries are preset projects
        const allPresets = queries.every(q => APP_PRESETS.some(p => p.id === q.id));
        
        if (allPresets && queries.length > 0) {
          // For preset projects, always use trend data
          console.log('[CreateDashboard] All queries are presets, using trend data');
          
          // Wait for trend data if not available
          let availableData = trendData || getCachedData();
          if (!availableData || Object.keys(availableData).length === 0) {
            console.log('[CreateDashboard] No trend data available, waiting...');
            
            // Show loading message
            setLoadingProgress({ 
              current: 0, 
              total: 1, 
              percentage: 0,
              message: 'Waiting for trend data to load...'
            });
            
            // Wait for trend data with timeout
            const maxWaitTime = 30000; // 30 seconds
            const checkInterval = 500; // Check every 500ms
            let waited = 0;
            
            while (waited < maxWaitTime) {
              availableData = trendData || getCachedData();
              if (availableData && Object.keys(availableData).length > 0) {
                console.log('[CreateDashboard] Trend data loaded after', waited, 'ms');
                break;
              }
              await new Promise(resolve => setTimeout(resolve, checkInterval));
              waited += checkInterval;
              
              // Update progress
              setLoadingProgress({ 
                current: waited, 
                total: maxWaitTime, 
                percentage: Math.round((waited / maxWaitTime) * 100),
                message: `Waiting for trend data... ${Math.round(waited / 1000)}s`
              });
            }
            
            if (!availableData || Object.keys(availableData).length === 0) {
              throw new Error('Trend data not available. Please refresh the page and try again.');
            }
          }
          
          // Process trend data for selected time period
          const timePeriodMap = {
            'week': '7d',
            'month': '30d',
            'quarter': '3M',
            'year': '6M'
          } as const;
          
          const period = timePeriodMap[chart.timePeriod] || '30d';
          
          // Filter trend data by selected time period
          const filteredData = filterDataByPeriod(availableData, period);
          
          // Use filtered data for each query
          queries.forEach((query, i) => {
            if (filteredData[query.id]) {
              allData[query.id] = filteredData[query.id];
              console.log(`[CreateDashboard] Using filtered trend data for ${query.name}, period: ${period}`);
            }
            
            // Update progress
            const progress = {
              current: i + 1,
              total: queries.length,
              percentage: Math.round(((i + 1) / queries.length) * 100)
            };
            setLoadingProgress(progress);
          });
          
        } else {
          // Mixed or custom queries - use existing logic
          // First try to get cached data or wait for it if being loaded
          let cachedData = getCachedData();
          if (!cachedData && !trendData) {
            console.log('[CreateDashboard] No cached data available, waiting for cache...');
            cachedData = await waitForCache(5000); // Wait up to 5 seconds
          }
          
          // Use either cached data or trendData
          const availableData = cachedData || trendData || {};
          
          // If no queries, try legacy tags
          if (queries.length === 0 && chart.tags && chart.tags.length > 0) {
            const monthsMap = {
              'week': 0.25,
              'month': 1,
              'quarter': 3,
              'year': 12
            };
            const months = monthsMap[chart.timePeriod] || 6;
            
            const data = await queryTagCounts(chart.tags, (progress) => {
              setLoadingProgress(progress);
            }, { months });
            allData[chart.id] = data;
          } else {
            // Load data for each query
            for (let i = 0; i < queries.length; i++) {
              const query = queries[i];
              
              // Check if data exists in availableData first
              if (availableData[query.id]) {
                console.log(`[CreateDashboard] Using cached data for ${query.name}`);
                allData[query.id] = availableData[query.id];
                
                // Update progress
                const progress = {
                  current: i + 1,
                  total: queries.length,
                  percentage: Math.round(((i + 1) / queries.length) * 100)
                };
                setLoadingProgress(progress);
              } else {
                // Query new data if not in trendData
                const progress = {
                  current: i,
                  total: queries.length,
                  percentage: Math.round((i / queries.length) * 100)
                };
                setLoadingProgress(progress);
                
                // Get date range from chart time period
                const monthsMap = {
                  'week': 0.25,
                  'month': 1,
                  'quarter': 3,
                  'year': 12
                };
                const months = monthsMap[chart.timePeriod] || 6;
                
                const data = await queryTagCounts(query.tags, (subProgress) => {
                  const overallProgress = {
                    current: i + (subProgress.percentage / 100),
                    total: queries.length,
                    percentage: Math.round(((i + (subProgress.percentage / 100)) / queries.length) * 100)
                  };
                  setLoadingProgress(overallProgress);
                }, { months });
                
                allData[query.id] = data;
              }
            }
          }
        }
        
        // Generate chart with filtered data
        const processedData = generateChartData(
          allData,
          queries,
          chart.chartType,
          false
        );
        
        setChartData(prev => ({
          ...prev,
          [chart.id]: processedData
        }));
      }
    } catch (error) {
      console.error('Error loading chart data:', error);
      setLoadingProgress({ current: 1, total: 1, percentage: 100, error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoadingChartId(null);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Dashboard name is required');
      return;
    }

    if (charts.length === 0) {
      setError('Please add at least one chart');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const dashboard: Dashboard = {
        id: existingDashboard?.id || `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        author: authorName || authorAddress, // Use authorName if available
        authorAddress,
        charts,
        createdAt: existingDashboard?.createdAt || Date.now(),
        updatedAt: Date.now(),
        views: existingDashboard?.views || 0,
        likes: existingDashboard?.likes || 0,
        rootTxId: existingDashboard?.rootTxId
      };

      // If this is a new dashboard (not an edit), require payment
      if (!existingDashboard) {
        // Get wallet provider
        let provider = null;
        if (typeof window.ethereum !== 'undefined') {
          provider = window.ethereum;
        } else if (typeof (window as any).okxwallet !== 'undefined') {
          provider = (window as any).okxwallet;
        } else if (typeof (window as any).web3 !== 'undefined' && (window as any).web3.currentProvider) {
          provider = (window as any).web3.currentProvider;
        }
        
        if (!provider) {
          throw new Error("No wallet provider found. Please install MetaMask, OKX Wallet, or another Ethereum wallet");
        }

        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x4F6' }], // 1270 in hex
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x4F6',
                chainName: 'Irys Testnet',
                nativeCurrency: {
                  name: 'IRYS',
                  symbol: 'IRYS',
                  decimals: 18
                },
                rpcUrls: [IRYS_TESTNET_RPC],
                blockExplorerUrls: []
              }]
            });
          } else {
            throw switchError;
          }
        }

        // Connect to provider
        const ethersProvider = new ethers.BrowserProvider(provider);
        const signer = await ethersProvider.getSigner();
        const signerAddress = await signer.getAddress();
        
        // Check network
        const network = await ethersProvider.getNetwork();
        if (network.chainId !== 1270n) {
          throw new Error('Not connected to Irys testnet. Please switch networks.');
        }
        
        // Check balance
        const balance = await ethersProvider.getBalance(signerAddress);
        const contract = new ethers.Contract(DASHBOARD_CONTRACT_ADDRESS, DASHBOARD_ABI, ethersProvider);
        const creationFee = await contract.ARTICLE_PRICE();
        
        if (balance < creationFee) {
          throw new Error(`Insufficient funds. You need at least ${ethers.formatEther(creationFee)} IRYS to create a dashboard.`);
        }

        // Call contract to pay creation fee
        setTransactionStatus("Please confirm the payment transaction (1/2)...");
        const contractWithSigner = new ethers.Contract(DASHBOARD_CONTRACT_ADDRESS, DASHBOARD_ABI, signer);
        const tx = await contractWithSigner.payForArticle({
          value: creationFee
        });

        setTxHash(tx.hash);
        setTransactionStatus("⏳ Payment transaction submitted. Waiting for confirmation...");
        
        // Initialize Irys uploader while waiting for transaction
        console.log('[CreateDashboard] Getting Irys uploader...');
        const uploaderPromise = initializeIrysUploader();
        
        const receipt = await tx.wait();
        
        // Check if event was emitted
        const paymentEvent = receipt.logs.find((log: any) => {
          try {
            const parsed = contractWithSigner.interface.parseLog(log);
            return parsed?.name === 'ArticlePaymentReceived';
          } catch {
            return false;
          }
        });

        if (!paymentEvent) {
          throw new Error('Dashboard payment failed on-chain');
        }

        console.log('[CreateDashboard] Dashboard creation payment successful, tx:', tx.hash);
        setTransactionStatus("✅ Payment confirmed!\n\n🔄 A second signature is required to upload your dashboard to Irys.\nPlease confirm the upcoming signature request (2/2)...");
        
        // Wait for Irys uploader to be ready
        try {
          const uploader = await uploaderPromise;
          if (uploader) {
            console.log('[CreateDashboard] Irys uploader ready');
          }
        } catch (err) {
          console.error('[CreateDashboard] Failed to initialize Irys uploader:', err);
        }
      }

      console.log('[CreateDashboard] Starting dashboard upload process...');
      const uploadProcessStart = Date.now();
      
      if (!existingDashboard && !transactionStatus) {
        setTransactionStatus("Please confirm the upload signature to Irys...");
      } else if (transactionStatus && transactionStatus.includes("(2/2)")) {
        // Keep the second signature message visible
      }
      
      console.log('[CreateDashboard] Calling uploadDashboard function...');
      const uploadCallStart = Date.now();
      const result = await uploadDashboard(dashboard);
      const uploadCallEnd = Date.now();
      
      console.log(`[CreateDashboard] uploadDashboard call completed in ${uploadCallEnd - uploadCallStart}ms`);
      console.log(`[CreateDashboard] Total time from payment to upload completion: ${uploadCallEnd - uploadProcessStart}ms`);

      if (result.success && result.transactionId) {
        console.log('[CreateDashboard] Dashboard uploaded successfully:', result.transactionId);
        dashboard.transactionId = result.transactionId;
        dashboard.mutableAddress = result.mutableAddress;
        dashboard.rootTxId = result.rootTxId;
        
        // Clear transaction status before showing success
        setTransactionStatus("");
        
        // Show success message
        let message = `✅ Dashboard successfully ${existingDashboard ? 'updated' : 'created'} and uploaded to Irys!\n`;
        if (!existingDashboard && txHash) {
          message += `\nPayment Transaction: ${txHash}`;
          message += `\nExplorer: https://testnet.explorer.irys.xyz/tx/${txHash}\n`;
        }
        message += `\nIrys Transaction ID: ${result.transactionId}`;
        message += `\nMutable Address: ${result.mutableAddress || 'N/A'}`;
        
        setSuccessMessage(message);
        setShowSuccess(true);
        
        // Hide success message after 5 seconds
        setTimeout(() => {
          setShowSuccess(false);
          setSuccessMessage('');
        }, 5000);
        
        onSuccess(dashboard);
        
        // Close modal after a short delay to show success message
        setTimeout(() => {
          onClose();
        }, 2000);
        
        // Reset form
        setName('');
        setDescription('');
        setCharts([]);
        setChartData({});
        setTransactionStatus('');
        setTxHash(null);
      } else {
        console.error('[CreateDashboard] Upload failed:', result.error);
        setError(result.error || 'Failed to create dashboard');
      }
    } catch (err) {
      console.error('[CreateDashboard] Error creating dashboard:', err);
      console.error('[CreateDashboard] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      
      if (err instanceof Error && err.message.includes('Ethereum provider')) {
        setError('Wallet connection error. Please make sure your wallet is connected and try again.');
      } else if (err instanceof Error && err.message.includes('User rejected')) {
        setError('Transaction cancelled by user.');
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred while creating the dashboard');
      }
      
      // Don't close modal on error
      setTransactionStatus('');
      setTxHash(null);
    } finally {
      setIsCreating(false);
    }
  };

  const handleOverlayClick = () => {
    // Don't close if creating or there's an error
    if (!isCreating && !error) {
      onClose();
    }
  };

  const handleCloseClick = () => {
    // Don't close if creating
    if (!isCreating) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{existingDashboard ? 'Edit Dashboard' : 'Create New Dashboard'}</h2>
          <button className="close-btn" onClick={handleCloseClick} disabled={isCreating}>×</button>
        </div>
        
        <div className="modal-body">
          {!existingDashboard && (
            <div style={{margin: '0 0 1rem 0', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #fbbf24'}}>
              <h5 style={{color: '#92400e', marginBottom: '0.5rem', fontSize: '1rem'}}>⚠️ Transaction Notice</h5>
              <p style={{fontSize: '0.875rem', color: '#78350f', margin: 0}}>
                Creating a dashboard requires 0.1 IRYS + gas fees for permanent storage on the Irys network.
              </p>
            </div>
          )}
          
          {error && (
            <div className="error-message">{error}</div>
          )}
          
          {showSuccess && (
            <div className="success-message">
              <h4>✅ Success!</h4>
              <pre style={{whiteSpace: 'pre-wrap', fontSize: '0.875rem', margin: '0.5rem 0'}}>
                {successMessage}
              </pre>
            </div>
          )}
          
          <div className="dashboard-info-section">
            <h3>Dashboard Information</h3>
            <div className="form-group">
              <label>Dashboard Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Analytics Dashboard"
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this dashboard tracks..."
                rows={3}
                maxLength={500}
              />
            </div>
          </div>

          <div className="charts-section">
            <h3>Charts</h3>
            
            {/* Chart editor */}
            <div className="chart-editor">
              <h4>{editingChart ? 'Edit Chart' : 'Add New Chart'}</h4>
              
              <div className="form-group">
                <label>Chart Title *</label>
                <input
                  type="text"
                  value={chartTitle}
                  onChange={(e) => setChartTitle(e.target.value)}
                  placeholder="Transaction Activity"
                />
              </div>

              <div className="form-group">
                <label>Chart Description</label>
                <textarea
                  value={chartDescription}
                  onChange={(e) => setChartDescription(e.target.value)}
                  placeholder="Describe what this chart shows..."
                  rows={2}
                />
              </div>

              {/* Data source selection */}
              <div className="form-group">
                <label>Select Data Sources</label>
                <div className="data-sources-grid">
                  {/* Storage presets (excluding on-chain only projects) */}
                  {APP_PRESETS.filter(preset => 
                    !['irysflip', 'irys-crush', 'play-hirys', 'irys-slot'].includes(preset.id)
                  ).map(preset => (
                    <div 
                      key={preset.id} 
                      className={`data-source-card ${selectedQueries.some(q => q.id === preset.id) ? 'selected' : ''}`}
                      onClick={() => togglePreset(preset.id)}
                    >
                      {preset.icon && (
                        <img src={preset.icon} alt={preset.name} className="source-icon" />
                      )}
                      <div className="source-name">{preset.name}</div>
                      <div className="source-type">Storage</div>
                      <div className="source-check">
                        {selectedQueries.some(q => q.id === preset.id) && '✓'}
                      </div>
                    </div>
                  ))}
                  
                  {/* On-chain presets */}
                  {ON_CHAIN_PRESETS.map(preset => (
                    <div 
                      key={`onchain-${preset.id}`} 
                      className={`data-source-card ${selectedQueries.some(q => q.id === `onchain-${preset.id}`) ? 'selected' : ''}`}
                      onClick={() => {
                        const queryId = `onchain-${preset.id}`;
                        const existingQuery = selectedQueries.find(q => q.id === queryId);
                        if (existingQuery) {
                          setSelectedQueries(selectedQueries.filter(q => q.id !== queryId));
                        } else {
                          const newQuery = {
                            id: queryId,
                            name: preset.name,
                            tags: [],
                            color: preset.color || '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
                            isOnChain: true,
                            onChainConfig: {
                              network: preset.network || 'mainnet',
                              contractAddress: preset.contractAddress,
                              rpcUrl: preset.rpcUrl || '',
                              abis: preset.abis || [],
                              displayMode: 'combined' as const
                            }
                          };
                          setSelectedQueries([...selectedQueries, newQuery]);
                        }
                      }}
                    >
                      {preset.icon && (
                        <img src={preset.icon} alt={preset.name} className="source-icon" />
                      )}
                      <div className="source-name">{preset.name}</div>
                      <div className="source-type">On-chain</div>
                      <div className="source-check">
                        {selectedQueries.some(q => q.id === `onchain-${preset.id}`) && '✓'}
                      </div>
                    </div>
                  ))}
                  
                  {/* Custom option */}
                  <div 
                    className={`data-source-card custom-card ${showCustomOptions ? 'selected' : ''}`}
                    onClick={() => setShowCustomOptions(!showCustomOptions)}
                  >
                    <div className="source-name">➕ Custom</div>
                    <div className="source-type">Configure</div>
                    <div className="source-check">
                      {showCustomOptions && '✓'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom options (only show when custom is selected) */}
              {showCustomOptions && (
                <>
                  <div className="form-group">
                    <label>Custom Query Type</label>
                    <div className="query-mode-selector">
                      <button
                        type="button"
                        className={`mode-btn ${queryMode === 'storage' ? 'active' : ''}`}
                        onClick={() => setQueryMode('storage')}
                      >
                        📦 Storage Query
                      </button>
                      <button
                        type="button"
                        className={`mode-btn ${queryMode === 'onchain' ? 'active' : ''}`}
                        onClick={() => setQueryMode('onchain')}
                      >
                        ⛓️ On-chain Query
                      </button>
                    </div>
                  </div>

                  {queryMode === 'onchain' && (
                    <>
                      {/* On-chain preset selection */}
                      <div className="form-group">
                        <label>On-chain Presets</label>
                        <select 
                          value={selectedOnChainPreset}
                          onChange={(e) => {
                            const preset = ON_CHAIN_PRESETS.find(p => p.id === e.target.value);
                            if (preset) {
                              setSelectedOnChainPreset(preset.id);
                              
                              // Handle PlayHirys multiple contracts
                              if (preset.multipleContracts) {
                                setSelectedPlayHirysGame(''); // Reset game selection
                                setContractAddress(''); // Clear contract address until game is selected
                                setSelectedNetwork(preset.network || 'mainnet');
                                setRpcUrl(preset.rpcUrl || '');
                                setAbiInputs(['']);
                                setParsedAbis([]);
                              } else {
                                setContractAddress(preset.contractAddress);
                                setSelectedNetwork(preset.network || 'mainnet');
                                setRpcUrl(preset.rpcUrl || '');
                                // 프리셋의 ABI 설정
                                if (preset.abis) {
                                  setAbiInputs(preset.abis.map(abi => JSON.stringify(abi, null, 2)));
                                  setParsedAbis(preset.abis);
                                }
                              }
                            } else {
                              setSelectedOnChainPreset('');
                              setSelectedPlayHirysGame('');
                              setAbiInputs(['']);
                              setParsedAbis([]);
                              setRpcUrl('');
                            }
                          }}
                        >
                          <option value="">Select a preset or enter custom</option>
                          {ON_CHAIN_PRESETS.map(preset => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name} - {preset.description}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* PlayHirys game selection */}
                      {selectedOnChainPreset === 'play-hirys' && (
                        <div className="form-group">
                          <label>Select Game</label>
                          <select 
                            value={selectedPlayHirysGame}
                            onChange={(e) => {
                              const gameAddress = e.target.value;
                              setSelectedPlayHirysGame(gameAddress);
                              
                              const preset = ON_CHAIN_PRESETS.find(p => p.id === 'play-hirys');
                              const game = preset?.multipleContracts?.find(g => g.contractAddress === gameAddress);
                              
                              if (game) {
                                setContractAddress(game.contractAddress);
                                setAbiInputs(game.abis.map(abi => JSON.stringify(abi, null, 2)));
                                setParsedAbis(game.abis);
                              }
                            }}
                          >
                            <option value="">Select a game</option>
                            {ON_CHAIN_PRESETS.find(p => p.id === 'play-hirys')?.multipleContracts?.map(game => (
                              <option key={game.contractAddress} value={game.contractAddress}>
                                {game.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Only show input fields when no preset is selected */}
                      {!selectedOnChainPreset && (
                        <>
                          {/* Network selection */}
                          <div className="form-group">
                            <label>Network</label>
                            <select
                              value={selectedNetwork}
                              onChange={(e) => setSelectedNetwork(e.target.value)}
                            >
                              <option value="mainnet">Ethereum Mainnet</option>
                              <option value="polygon">Polygon</option>
                              <option value="arbitrum">Arbitrum</option>
                              <option value="avalanche">Avalanche</option>
                              <option value="base">Base</option>
                              <option value="irys-testnet">Irys Testnet</option>
                            </select>
                          </div>

                          {/* RPC URL input */}
                          <div className="form-group">
                            <label>RPC URL *</label>
                            <input
                              type="text"
                              value={rpcUrl}
                              onChange={(e) => setRpcUrl(e.target.value)}
                              placeholder="https://..."
                            />
                          </div>

                          {/* Contract Address input */}
                          <div className="form-group">
                            <label>Contract Address *</label>
                            <input
                              type="text"
                              value={contractAddress}
                              onChange={(e) => setContractAddress(e.target.value)}
                              placeholder="0x..."
                            />
                          </div>

                          {/* ABI input */}
                          <div className="form-group">
                            <label>
                              ABI Functions/Events (Optional)
                              <span className="field-hint"> - Leave empty to track all Transfer events</span>
                            </label>
                            {abiInputs.map((abi, index) => (
                              <div key={index} className="abi-input-row">
                                <textarea
                                  value={abi}
                                  onChange={(e) => {
                                    const newAbis = [...abiInputs];
                                    newAbis[index] = e.target.value;
                                    setAbiInputs(newAbis);
                                    
                                    // Try to parse ABI
                                    try {
                                      if (e.target.value.trim()) {
                                        const parsed = JSON.parse(e.target.value);
                                        // Validate ABI structure
                                        if (parsed.name && parsed.type && (parsed.type === 'event' || parsed.type === 'function')) {
                                          const newParsedAbis = [...parsedAbis];
                                          newParsedAbis[index] = parsed;
                                          setParsedAbis(newParsedAbis);
                                        }
                                      }
                                    } catch (err) {
                                      // Invalid JSON, ignore
                                    }
                                  }}
                                  placeholder='{"name": "Transfer", "type": "event", "inputs": [{"name": "from", "type": "address"}, {"name": "to", "type": "address"}, {"name": "value", "type": "uint256"}]}'
                                  rows={3}
                                />
                                <button
                                  type="button"
                                  className="remove-abi-btn"
                                  onClick={() => {
                                    setAbiInputs(abiInputs.filter((_, i) => i !== index));
                                    setParsedAbis(parsedAbis.filter((_, i) => i !== index));
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="add-abi-btn"
                              onClick={() => setAbiInputs([...abiInputs, ''])}
                            >
                              + Add Function/Event
                            </button>
                          </div>

                          {/* Display mode selection (only when ABI exists) */}
                          {parsedAbis.length > 0 && (
                            <div className="form-group">
                              <label>Display Mode</label>
                              <div className="display-mode-selector">
                                <label>
                                  <input
                                    type="radio"
                                    value="combined"
                                    checked={onChainDisplayMode === 'combined'}
                                    onChange={(e) => setOnChainDisplayMode(e.target.value as 'combined' | 'separated')}
                                  />
                                  Combined (sum of all functions)
                                </label>
                                <label>
                                  <input
                                    type="radio"
                                    value="separated"
                                    checked={onChainDisplayMode === 'separated'}
                                    onChange={(e) => setOnChainDisplayMode(e.target.value as 'combined' | 'separated')}
                                  />
                                  Separated (by function)
                                </label>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {selectedQueries.length > 0 && (
                <div className="form-group">
                  <label>Selected Data Sources</label>
                  <div className="selected-queries">
                    {selectedQueries.map(query => (
                      <div key={query.id} className={`query-chip ${query.isGroup ? 'group-chip' : ''}`}>
                        <span>
                          {query.isGroup && '📦 '}
                          {query.name}
                          {query.isGroup && ` (${query.tags.length} tags)`}
                        </span>
                        <button onClick={() => removeQuery(query.id)}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showCustomOptions && queryMode === 'storage' && (
                <div className="form-group">
                  <label>Custom Tags</label>
                  <div className="custom-tags">
                    {customTags.map((tag, index) => (
                      <div key={index} className="tag-item">
                        <span>{tag.name}: {tag.value}</span>
                        <button onClick={() => removeCustomTag(index)}>×</button>
                      </div>
                    ))}
                    {showTagInput ? (
                      <div className="tag-input-form">
                        <input
                          type="text"
                          placeholder="Tag name"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && newTagValue && addCustomTag()}
                        />
                        <input
                          type="text"
                          placeholder="Tag value"
                          value={newTagValue}
                          onChange={(e) => setNewTagValue(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && newTagName && addCustomTag()}
                        />
                        <button 
                          className="confirm-tag-btn" 
                          onClick={addCustomTag}
                          disabled={!newTagName.trim() || !newTagValue.trim()}
                        >
                          ✓
                        </button>
                        <button 
                          className="cancel-tag-btn" 
                          onClick={() => {
                            setShowTagInput(false);
                            setNewTagName('');
                            setNewTagValue('');
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="tag-buttons">
                        <button className="add-tag-btn" onClick={() => setShowTagInput(true)}>
                          + Add Tag
                        </button>
                        <button className="add-tag-btn" onClick={() => setShowGroupInput(true)}>
                          + Add Tag Group
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {showGroupInput && (
                <div className="form-group">
                  <label>Create Tag Group</label>
                  <div className="tag-group-editor">
                    <input
                      type="text"
                      placeholder="Group name"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="group-name-input"
                    />
                    
                    <div className="group-tags-section">
                      <h5>Tags in this group:</h5>
                      {groupTags.map((tag, index) => (
                        <div key={index} className="tag-item">
                          <span>{tag.name}: {tag.value}</span>
                          <button onClick={() => removeTagFromGroup(index)}>×</button>
                        </div>
                      ))}
                      
                      <div className="tag-input-form">
                        <input
                          type="text"
                          placeholder="Tag name"
                          value={currentGroupTag.name}
                          onChange={(e) => setCurrentGroupTag({ ...currentGroupTag, name: e.target.value })}
                        />
                        <input
                          type="text"
                          placeholder="Tag value"
                          value={currentGroupTag.value}
                          onChange={(e) => setCurrentGroupTag({ ...currentGroupTag, value: e.target.value })}
                        />
                        <button 
                          className="confirm-tag-btn" 
                          onClick={addTagToGroup}
                          disabled={!currentGroupTag.name.trim() || !currentGroupTag.value.trim()}
                        >
                          Add to Group
                        </button>
                      </div>
                    </div>
                    
                    <div className="group-actions">
                      <button 
                        className="create-group-btn"
                        onClick={createTagGroup}
                        disabled={!groupName.trim() || groupTags.length === 0}
                      >
                        Create Group
                      </button>
                      <button 
                        className="cancel-group-btn"
                        onClick={() => {
                          setShowGroupInput(false);
                          setGroupName('');
                          setGroupTags([]);
                          setCurrentGroupTag({ name: '', value: '' });
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Chart Type</label>
                  <select 
                    value={chartType} 
                    onChange={(e) => setChartType(e.target.value as ChartType)}
                  >
                    <option value="line">Line Chart</option>
                    <option value="stacked">Stacked Chart</option>
                    <option value="treemap">Treemap</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Time Period</label>
                  <select 
                    value={timePeriod} 
                    onChange={(e) => setTimePeriod(e.target.value as any)}
                  >
                    <option value="week">Last Week</option>
                    <option value="month">Last Month</option>
                    <option value="quarter">Last Quarter</option>
                    <option value="year">Last Year</option>
                  </select>
                </div>
              </div>

              <button 
                className="add-chart-btn" 
                onClick={addChart}
              >
                {editingChart ? 'Update Chart' : 'Add Chart'}
              </button>
              {editingChart && (
                <button 
                  className="cancel-edit-btn" 
                                     onClick={() => {
                     setEditingChart(null);
                     setChartTitle('');
                     setChartDescription('');
                     setChartType('line');
                     setTimePeriod('month');
                     setCustomTags([]);
                     setSelectedQueries([]);
                   }}
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {/* Chart list */}
            <div className="charts-section">
              <h3>Dashboard Charts ({charts.length})</h3>
              {charts.length === 0 ? (
                <div className="empty-state">
                  <p>No charts added yet</p>
                  <p className="empty-hint">Add a chart above to get started</p>
                </div>
              ) : (
                <div className="charts-list">
                  {charts.map((chart, index) => (
                    <div key={chart.id} className="chart-card">
                      <div className="chart-card-header">
                        <div className="chart-number">{index + 1}</div>
                        <div className="chart-info">
                          <h4>{chart.title}</h4>
                          {chart.description && <p className="chart-description">{chart.description}</p>}
                          <div className="chart-meta">
                            <span className="chart-type">{chart.chartType}</span>
                            <span className="chart-period">{chart.timePeriod}</span>
                            <span className="chart-sources">{chart.queries?.length || 0} sources</span>
                          </div>
                        </div>
                        <div className="chart-actions">
                          <button 
                            className={`preview-btn ${showPreview[chart.id] ? 'active' : ''}`}
                            onClick={() => togglePreview(chart.id)}
                          >
                            {loadingChartId === chart.id ? 'Loading...' : (showPreview[chart.id] ? 'Hide' : 'Preview')}
                          </button>
                          <button className="edit-btn" onClick={() => editChart(chart)}>Edit</button>
                          <button className="remove-btn" onClick={() => removeChart(chart.id)}>Remove</button>
                        </div>
                      </div>
                      
                      {/* Inline preview */}
                      {showPreview[chart.id] && (
                        <div className="chart-preview-inline">
                          {loadingChartId === chart.id && loadingProgress ? (
                            <LoadingProgress progress={loadingProgress} />
                          ) : chartData[chart.id] ? (
                            <Chart 
                              data={generateChartData(
                                typeof chartData[chart.id] === 'object' && !Array.isArray(chartData[chart.id]) 
                                  ? chartData[chart.id] 
                                  : { [chart.id]: chartData[chart.id] },
                                chart.queries || [{ id: chart.id, name: chart.name, tags: chart.tags || [], color: chart.color }],
                                chart.chartType
                              )}
                              chartType={chart.chartType}
                              title=""
                              shareText=""
                              onTypeChange={() => {}}
                            />
                          ) : (
                            <div className="no-data">Click preview to load chart data</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {transactionStatus && (
          <div className="transaction-status" style={{ padding: '10px 20px', color: '#3b82f6' }}>
            {transactionStatus}
            {txHash && (
              <div style={{ fontSize: '0.875rem', marginTop: '4px' }}>
                <a 
                  href={`https://testnet-explorer.irys.xyz/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#60a5fa', textDecoration: 'underline' }}
                >
                  View Transaction
                </a>
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          <button 
            className="cancel-btn" 
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button 
            className="create-btn" 
            onClick={handleCreate}
            disabled={isCreating || charts.length === 0}
          >
            {isCreating ? 
              (transactionStatus ? 'Processing...' : 'Uploading...') : 
              existingDashboard ? 'Update Dashboard' : 
              '✅ Create Dashboard (Cost: 0.1 IRYS + gas)'
            }
          </button>
        </div>
      </div>
    </div>
  );
}; 