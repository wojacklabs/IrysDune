import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Clock, Download, Share2, AlertCircle, ExternalLink, Package, ChevronLeft, ChevronRight, Award, Lock, X } from 'lucide-react';
import { getUserTransactions, queryBadgeEligibility } from '../services/irysService';
import { queryUserOnChainData, queryOnChainEvents, ON_CHAIN_PRESETS } from '../services/onChainService';
import { ACTIVITY_CATEGORIES, getActivityFromTags, getProjectFromTags, getActivityFromEvent } from '../constants/tagActivityMapping';
import { APP_PRESETS } from '../constants/appPresets';
import type { LoadingProgress as LoadingProgressType } from '../types';
import LoadingProgress from './LoadingProgress';
import { captureAndShare, downloadImage, captureElement } from '../utils/captureUtils';
import { ethers } from 'ethers';
import { ensureUploaderReady } from '../services/irysUploadService';

type TimePeriod = '24h' | '3d' | '7d';

interface MyHistorySectionProps {
  walletAddress: string | null;
}

interface ProjectData {
  projectId: string;
  projectName: string;
  projectIcon?: string;
  count: number;
  percentage: number;
  source: 'storage' | 'onchain' | 'both'; // 소스 추가
  storageCount?: number;
  onchainCount?: number;
}

interface UnifiedTransaction {
  id: string;
  timestamp: number;
  source: 'storage' | 'onchain';
  project?: string;
  projectIcon?: string;
  activity: string;
  activityIcon?: string;
  detail: string; // endpoint 또는 event
  network?: string;
  url: string;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  image: string;
  requirements: string;
  checkEligibility: (data: { dashboardCount: number }) => boolean;
}

const BADGES: Badge[] = [
  {
    id: 'community-member',
    name: 'Community Member',
    description: 'Welcome to IrysDune community!',
    image: 'https://uploader.irys.xyz/DsqhyusYWuJGnWU7e2EgRyNwU6iCC18mSV65ZNfvtvHT',
    requirements: 'Available for everyone',
    checkEligibility: () => true
  },
  {
    id: 'dashboard-creator',
    name: 'Dashboard Creator',
    description: 'Created your first dashboard on IrysDune',
    image: 'https://uploader.irys.xyz/9N7TDkXGcwJGnWU7e2EgRyNwU6iCC18mSV65ZNfvDash', 
    requirements: 'Create at least 1 dashboard',
    checkEligibility: (data) => data.dashboardCount >= 1
  }
];

// Contract configuration
const NFT_CONTRACT_ADDRESS = '0x5Aa61c497B4e3592cD69FC88B7303e3Aac5DA5FD';
const IRYS_TESTNET_RPC = 'https://testnet-rpc.irys.xyz/v1/execution-rpc';
const NFT_ABI = [
  'function publicMint(address to, string memory uri) payable',
  'function getMintPrice() pure returns (uint256)',
  'event NFTMinted(address indexed minter, uint256 indexed tokenId, string uri)'
];

const MyHistorySection: React.FC<MyHistorySectionProps> = ({ walletAddress }) => {
  const [projectData, setProjectData] = useState<ProjectData[]>([]);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('7d');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<LoadingProgressType | null>(null);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [unifiedTransactions, setUnifiedTransactions] = useState<UnifiedTransaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 8;
  const sectionRef = useRef<HTMLDivElement>(null);
  
  // Badge states
  const [dashboardCount, setDashboardCount] = useState(0);
  const [badgeEligibilityLoading, setBadgeEligibilityLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);

  // Time period labels
  const periodLabels: Record<TimePeriod, string> = {
    '24h': 'Last 24 Hours',
    '3d': 'Last 3 Days',
    '7d': 'Last 7 Days'
  };

  // Load user transaction history
  const loadUserHistory = async () => {
    if (!walletAddress) return;

    setLoading(true);
    setProgress({ current: 0, total: 1, percentage: 0, message: 'Starting to fetch transactions...' });

    // 함수 내부에서만 사용되는 타입 정의
    interface Transaction {
      id: string;
      timestamp: number;
      tags: Array<{ name: string; value: string }>;
      endpoint: string;
      url: string;
    }

    interface OnChainActivity {
      contractName: string;
      contractAddress: string;
      network: string;
      count: number;
      color: string;
    }

    interface OnChainTransaction {
      id: string;
      timestamp: number;
      eventName: string;
      contractName: string;
      network: string;
      url: string;
    }

    try {
      const periodMap = {
        '24h': 1,
        '3d': 3,
        '7d': 7
      };

      // 병렬로 storage와 on-chain 데이터 로드
      const [storageData, onchainData] = await Promise.all([
        // Storage 데이터 로드
        (async () => {
          console.log('[MyHistory] Loading storage transactions for period:', timePeriod);
          const fetchedTransactions: Transaction[] = await getUserTransactions(walletAddress, timePeriod, (prog) => {
            setProgress({
              current: prog.current,
              total: prog.total,
              percentage: prog.percentage,
              message: prog.message || 'Loading storage transactions...'
            });
          });
          
          // Group by project (not activity)
          const projectCounts: { [key: string]: number } = {};
          
          fetchedTransactions.forEach(tx => {
            const project = getProjectFromTags(tx.tags);
            const projectId = project?.id || 'other';
            projectCounts[projectId] = (projectCounts[projectId] || 0) + 1;
          });
          
          return { transactions: fetchedTransactions, projectCounts };
        })(),
        
        // On-chain 데이터 로드
        (async () => {
          console.log('[MyHistory] Loading all on-chain presets for user:', walletAddress);
          
          const allOnChainData: OnChainActivity[] = [];
          const allTransactions: OnChainTransaction[] = [];
          
          // 색상 팔레트
          const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#6366f1'];
          
          // Progress tracking
          const totalPresets = ON_CHAIN_PRESETS.length;
          let completedPresets = 0;
          
          // 각 preset에 대해 병렬로 조회
          const presetPromises = ON_CHAIN_PRESETS.map(async (preset, index) => {
            try {
              console.log(`[MyHistory] Querying ${preset.name}...`);
              
              const results = await queryUserOnChainData(
                {
                  contractAddress: preset.contractAddress,
                  network: preset.network,
                  rpcUrl: preset.rpcUrl,
                  abis: preset.abis
                },
                walletAddress,
                undefined,
                { days: periodMap[timePeriod] }
              );

              const totalCount = results.reduce((sum, r) => sum + r.count, 0);
              
              if (totalCount > 0) {
                allOnChainData.push({
                  contractName: preset.name,
                  contractAddress: preset.contractAddress,
                  network: preset.network,
                  count: totalCount,
                  color: colors[index % colors.length]
                });

                // 이벤트 상세 조회
                const events = await queryOnChainEvents({
                  contractAddress: preset.contractAddress,
                  network: preset.network,
                  rpcUrl: preset.rpcUrl,
                  abis: preset.abis
                }, 20, walletAddress);
                
                // 이벤트를 트랜잭션 형태로 변환
                const presetTransactions = events.map(event => {
                  // 네트워크별 익스플로러 URL 매핑
                  let explorerUrl = '';
                  switch (preset.network) {
                    case 'mainnet':
                      explorerUrl = `https://etherscan.io/tx/${event.transactionHash}`;
                      break;
                    case 'polygon':
                      explorerUrl = `https://polygonscan.com/tx/${event.transactionHash}`;
                      break;
                    case 'arbitrum':
                      explorerUrl = `https://arbiscan.io/tx/${event.transactionHash}`;
                      break;
                    case 'avalanche':
                      explorerUrl = `https://snowtrace.io/tx/${event.transactionHash}`;
                      break;
                    case 'base':
                      explorerUrl = `https://basescan.org/tx/${event.transactionHash}`;
                      break;
                    case 'irys-testnet':
                      explorerUrl = `https://testnet.explorer.irys.xyz/tx/${event.transactionHash}`;
                      break;
                    default:
                      explorerUrl = `https://etherscan.io/tx/${event.transactionHash}`;
                  }
                  
                  return {
                    id: event.transactionHash,
                    timestamp: event.timestamp,
                    eventName: event.eventName,
                    contractName: preset.name,
                    network: preset.network,
                    url: explorerUrl
                  };
                });
                
                allTransactions.push(...presetTransactions);
              }
              
              // Update progress
              completedPresets++;
              setProgress({
                current: allTransactions.length,
                total: allTransactions.length + 1,
                percentage: Math.round((completedPresets / totalPresets) * 100),
                message: `Loading on-chain data: ${preset.name} (${completedPresets}/${totalPresets})`
              });
            } catch (error) {
              console.error(`[MyHistory] Error querying ${preset.name}:`, error);
              completedPresets++;
              setProgress({
                current: allTransactions.length,
                total: allTransactions.length + 1,
                percentage: Math.round((completedPresets / totalPresets) * 100),
                message: `Error loading ${preset.name}, continuing...`
              });
            }
          });
          
          // 모든 preset 조회 완료 대기
          await Promise.all(presetPromises);
          
          // Group on-chain by project/contract
          const projectCounts: { [key: string]: number } = {};
          
          allTransactions.forEach(tx => {
            // Find if this contract is in our presets
            const preset = ON_CHAIN_PRESETS.find(p => p.name === tx.contractName);
            const projectId = preset?.id || 'other';
            projectCounts[projectId] = (projectCounts[projectId] || 0) + 1;
          });
          
          return { 
            contracts: allOnChainData,
            transactions: allTransactions,
            projectCounts 
          };
        })()
      ]);

      // Storage와 on-chain 프로젝트 통합
      const combinedProjectCounts: { [key: string]: { storage: number, onchain: number } } = {};
      
      // Storage 프로젝트 추가
      Object.entries(storageData.projectCounts).forEach(([projectId, count]) => {
        if (!combinedProjectCounts[projectId]) {
          combinedProjectCounts[projectId] = { storage: 0, onchain: 0 };
        }
        combinedProjectCounts[projectId].storage = count;
      });
      
      // On-chain 프로젝트 추가
      Object.entries(onchainData.projectCounts).forEach(([projectId, count]) => {
        if (!combinedProjectCounts[projectId]) {
          combinedProjectCounts[projectId] = { storage: 0, onchain: 0 };
        }
        combinedProjectCounts[projectId].onchain = count;
      });
      
      // APP_PRESETS와 ON_CHAIN_PRESETS에서 프로젝트 정보 가져오기
      const getProjectInfo = (projectId: string) => {
        if (projectId === 'other') {
          return { name: 'Others', icon: undefined };
        }
        const appPreset = APP_PRESETS.find(p => p.id === projectId);
        if (appPreset) {
          return { name: appPreset.name, icon: appPreset.icon };
        }
        const onChainPreset = ON_CHAIN_PRESETS.find(p => p.id === projectId);
        if (onChainPreset) {
          return { name: onChainPreset.name, icon: undefined };
        }
        return { name: 'Others', icon: undefined };
      };
      
      // 통합된 project data 생성
      const projects: ProjectData[] = Object.entries(combinedProjectCounts)
        .map(([projectId, counts]) => {
          const totalCount = counts.storage + counts.onchain;
          const source: 'storage' | 'onchain' | 'both' = counts.storage > 0 && counts.onchain > 0 ? 'both' : 
                        counts.storage > 0 ? 'storage' : 'onchain';
          const projectInfo = getProjectInfo(projectId);
          
          return {
            projectId,
            projectName: projectInfo.name,
            projectIcon: projectInfo.icon,
            count: totalCount,
            percentage: 0, // 나중에 계산
            source,
            storageCount: counts.storage,
            onchainCount: counts.onchain
          };
        })
        .sort((a, b) => b.count - a.count);

      // 퍼센티지 계산
      const totalCount = projects.reduce((sum, a) => sum + a.count, 0);
      if (projects.length > 0 && totalCount > 0) {
        projects.forEach(project => {
          project.percentage = (project.count / totalCount) * 100;
        });
        
        // 반올림 오차 조정
        const percentageSum = projects.reduce((sum, a) => sum + a.percentage, 0);
        if (percentageSum !== 100 && percentageSum > 0) {
          const adjustment = 100 - percentageSum;
          projects[0].percentage += adjustment;
        }
      }

      // 통합된 트랜잭션 리스트 생성
      const allUnifiedTransactions: UnifiedTransaction[] = [];
      
      // Storage 트랜잭션 추가
      storageData.transactions.forEach(tx => {
        const project = getProjectFromTags(tx.tags);
        const activityId = getActivityFromTags(tx.tags);
        const category = ACTIVITY_CATEGORIES[activityId];
        
        allUnifiedTransactions.push({
          id: tx.id,
          timestamp: tx.timestamp,
          source: 'storage',
          project: project?.name || 'Others',
          projectIcon: project?.icon,
          activity: category.name,
          activityIcon: category.icon,
          detail: tx.endpoint,
          url: tx.url
        });
      });
      
      // On-chain 트랜잭션 추가
      onchainData.transactions.forEach(tx => {
        const activityId = getActivityFromEvent(tx.eventName);
        const category = ACTIVITY_CATEGORIES[activityId];
        const preset = ON_CHAIN_PRESETS.find(p => p.name === tx.contractName);
        
        allUnifiedTransactions.push({
          id: tx.id,
          timestamp: tx.timestamp,
          source: 'onchain',
          project: preset?.name || 'Others',
          activity: category.name,
          activityIcon: category.icon,
          detail: tx.eventName,
          network: tx.network,
          url: tx.url
        });
      });
      
      // 시간순으로 정렬 (최신 먼저)
      allUnifiedTransactions.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // 최대 100개만 유지
      const limitedTransactions = allUnifiedTransactions.slice(0, 100);

      // 상태 업데이트
      setProjectData(projects);
      setUnifiedTransactions(limitedTransactions);
      setTotalTransactions(totalCount);
      
      console.log('[MyHistory] All data loaded:', {
        projects: projects.length,
        storageTransactions: storageData.transactions.length,
        onchainTransactions: onchainData.transactions.length,
        unifiedTransactions: limitedTransactions.length
      });
      

      
      // 완료 progress 표시
      setProgress({
        current: totalCount,
        total: totalCount,
        percentage: 100,
        message: `Completed! Found ${totalCount} transactions in total.`
      });
      
      // 2초 후 progress 숨기기
      setTimeout(() => {
        setProgress(null);
      }, 2000);
      
    } catch (error) {
      console.error('[MyHistory] Error loading history:', error);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  // Load user history when component mounts or when parameters change
  useEffect(() => {
    setCurrentPage(1); // Reset to first page when period changes
    loadUserHistory();
  }, [walletAddress, timePeriod]);

  // Fetch badge eligibility data separately (independent of time period)
  useEffect(() => {
    if (!walletAddress) {
      setBadgeEligibilityLoading(false);
      return;
    }

    const fetchBadgeEligibility = async () => {
      console.log('[MyHistory] Fetching badge eligibility data...');
      setBadgeEligibilityLoading(true);
      
      try {
        const eligibility = await queryBadgeEligibility(walletAddress);
        setDashboardCount(eligibility.dashboardCount);
        console.log('[MyHistory] Badge eligibility:', eligibility);
      } catch (error) {
        console.error('[MyHistory] Error fetching badge eligibility:', error);
      } finally {
        setBadgeEligibilityLoading(false);
      }
    };

    fetchBadgeEligibility();
  }, [walletAddress]);

  useEffect(() => {

  // Share chart (capture and share)
  const handleCapture = async () => {
    if (!sectionRef.current) return;
    
    // setIsCapturing(true); // This state was removed, so this line is removed.
    try {
      const shareText = `My Irys Activity (${periodLabels[timePeriod]}):\n\n` +
        projectData.map(project => {
          let text = `${project.projectName}: ${project.count} (${project.percentage.toFixed(1)}%)`;
          if (project.source === 'both') {
            text += ` [💾${project.storageCount} | ⛓️${project.onchainCount}]`;
          } else if (project.source === 'storage') {
            text += ' [💾 Storage]';
          } else {
            text += ' [⛓️ On-chain]';
          }
          return text;
        }).join('\n') +
        `\n\nTotal: ${totalTransactions} transactions\n\n#Irys #IrysDune\n\nmade by @wojacklabs`;
      
      const filename = `my-irys-activity-${timePeriod}-${Date.now()}.png`;
      const result = await captureAndShare(sectionRef.current, shareText, filename);
      
      if (result.success) {
        console.log('Chart captured and shared successfully');
      } else {
        alert('Failed to capture chart.');
      }
    } catch (error) {
      console.error('Error capturing chart:', error);
      alert('Error occurred while capturing chart.');
    } finally {
      // setIsCapturing(false); // This state was removed, so this line is removed.
    }
  };

  // Download chart
  const handleDownload = async () => {
    if (!sectionRef.current) return;
    
    try {
      const blob = await captureElement(sectionRef.current);
      const filename = `my-irys-activity-${timePeriod}-${Date.now()}.png`;
      downloadImage(blob, filename);
    } catch (error) {
      console.error('Error downloading chart:', error);
      alert('Error occurred while downloading chart.');
    }
  };

  const calculatePieSegments = () => {
    // 통합된 데이터를 사용하여 파이 차트 계산
    if (projectData.length === 0) return [];
    
    // 전체 카운트 계산
    const totalCount = projectData.reduce((sum, d) => sum + d.count, 0);
    if (totalCount === 0) return [];
    
    // 색상 팔레트 정의
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#6366f1', '#f97316', '#84cc16'];
    
    // 단일 항목인 경우 전체 원을 그림
    if (projectData.length === 1) {
      return [{
        path: `M 50 50 L 50 10 A 40 40 0 0 1 50 90 A 40 40 0 0 1 50 10 Z`,
        color: projectData[0].projectId === 'other' ? '#6b7280' : colors[0],
        project: projectData[0]
      }];
    }
    
    let cumulativePercentage = 0;
    return projectData.map((project, index) => {
      const startAngle = (cumulativePercentage * 360) / 100;
      let endAngle = ((cumulativePercentage + project.percentage) * 360) / 100;
      
      // Prevent exact 360 degrees (use 359.99 instead)
      if (endAngle - startAngle >= 360) {
        endAngle = startAngle + 359.99;
      }
      
      cumulativePercentage += project.percentage;
      
      // Calculate SVG path
      const startAngleRad = (startAngle * Math.PI) / 180;
      const endAngleRad = (endAngle * Math.PI) / 180;
      
      const x1 = 50 + 40 * Math.cos(startAngleRad - Math.PI / 2);
      const y1 = 50 + 40 * Math.sin(startAngleRad - Math.PI / 2);
      const x2 = 50 + 40 * Math.cos(endAngleRad - Math.PI / 2);
      const y2 = 50 + 40 * Math.sin(endAngleRad - Math.PI / 2);
      
      const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
      
      // Special case for near-complete circle
      if (endAngle - startAngle > 359) {
        return {
          path: `M 50 50 L 50 10 A 40 40 0 0 1 50 90 A 40 40 0 0 1 50 10 Z`,
          color: project.projectId === 'other' ? '#6b7280' : colors[index % colors.length],
          project
        };
      }

      return {
        path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`,
        color: project.projectId === 'other' ? '#6b7280' : colors[index % colors.length],
        project
      };
    });
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Upload metadata to Irys
  const uploadMetadataToIrys = async (badge: Badge) => {
    try {
      const uploader = await ensureUploaderReady();
      if (!uploader) {
        throw new Error("Failed to initialize Irys uploader");
      }

      const metadata = {
        name: badge.name,
        description: badge.description,
        image: badge.image,
        attributes: [
          { trait_type: "Badge Type", value: badge.id },
          { trait_type: "Minted Date", value: new Date().toISOString() },
          { trait_type: "Minter", value: walletAddress }
        ]
      };

      const data = JSON.stringify(metadata);
      const tags = [
        { name: 'App-Name', value: 'IrysDune-Badge-NFT' },
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Type', value: 'badge-nft-metadata' },
        { name: 'Badge-Id', value: badge.id },
        { name: 'Creator', value: walletAddress || 'unknown' }
      ];

      const result = await uploader.upload(data, { tags });
      const metadataUrl = `https://gateway.irys.xyz/${result.id}`;
      
      return metadataUrl;
    } catch (error) {
      console.error('[MyHistory] Error uploading metadata:', error);
      throw error;
    }
  };

  // Handle badge minting
  const handleMintBadge = async (badge: Badge) => {
    if (!walletAddress) {
      setMintError("Please connect your wallet first");
      return;
    }

    setIsMinting(true);
    setMintError(null);
    setMintSuccess(null);
    setMintTxHash(null);

    try {
      // Check eligibility
      const isEligible = badge.checkEligibility({ dashboardCount });
      if (!isEligible) {
        throw new Error("You are not eligible to mint this badge yet");
      }

      // Switch to Irys testnet
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed");
      }

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x4F6' }], // 1270 in hex
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
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
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      
      // Check network
      const network = await provider.getNetwork();
      if (network.chainId !== 1270n) {
        throw new Error('Not connected to Irys testnet. Please switch networks.');
      }
      
      // Check balance
      const balance = await provider.getBalance(signerAddress);
      const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
      const mintPrice = await contract.getMintPrice();
      
      if (balance < mintPrice) {
        throw new Error(`Insufficient funds. You need at least ${ethers.formatEther(mintPrice)} IRYS to mint this badge.`);
      }

      // Upload metadata
      setMintSuccess("Uploading metadata to Irys...");
      const metadataUri = await uploadMetadataToIrys(badge);
      
      setMintSuccess("Metadata uploaded. Minting badge NFT...");
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mint NFT
      const contractWithSigner = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, signer);
      const tx = await contractWithSigner.publicMint(signerAddress, metadataUri, {
        value: mintPrice
      });

      setMintTxHash(tx.hash);
      setMintSuccess("Transaction submitted. Waiting for confirmation...");

      const receipt = await tx.wait();
      
      // Get token ID from event
      const mintEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = contractWithSigner.interface.parseLog(log);
          return parsed?.name === 'NFTMinted';
        } catch {
          return false;
        }
      });

      let tokenId = null;
      if (mintEvent) {
        const parsed = contractWithSigner.interface.parseLog(mintEvent);
        tokenId = parsed?.args[1]?.toString();
      }

      setMintSuccess(`Badge minted successfully! ${tokenId ? `Token ID: #${tokenId}` : ''}`);
      
    } catch (error: any) {
      console.error('[MyHistory] Minting error:', error);
      setMintError(error.message || 'Failed to mint badge');
    } finally {
      setIsMinting(false);
    }
  };


  if (!walletAddress) {
    return (
      <div className="my-history-section">
        <div className="card">
          <div className="empty-state">
            <AlertCircle size={48} />
            <h3>Wallet Connection Required</h3>
            <p>Please connect your wallet to view activity history</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-history-section" ref={sectionRef}>
      {/* Badge Section */}
      {walletAddress && (
        <div className="badge-section">
          <h3>Achievement Badges</h3>
          {badgeEligibilityLoading ? (
            <div className="badge-grid">
              {/* Badge skeleton */}
              {[1, 2].map((i) => (
                <div key={`skeleton-${i}`} className="badge-card skeleton">
                  <div className="badge-image-container skeleton-box"></div>
                  <div className="badge-info">
                    <div className="skeleton-text" style={{ width: '80%', height: '1.2rem', marginBottom: '0.5rem' }}></div>
                    <div className="skeleton-text" style={{ width: '100%', height: '0.875rem' }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="badge-grid">
              {BADGES.map(badge => {
                const isEligible = badge.checkEligibility({ dashboardCount });
                return (
                  <div
                    key={badge.id}
                    className={`badge-card ${isEligible ? 'eligible' : 'locked'}`}
                    onClick={() => setSelectedBadge(badge)}
                  >
                    <div className="badge-image-container">
                      <img src={badge.image} alt={badge.name} className="badge-image" />
                      {!isEligible && (
                        <div className="badge-lock-overlay">
                          <Lock size={24} />
                        </div>
                      )}
                    </div>
                    <div className="badge-info">
                      <h4>{badge.name}</h4>
                      <p className="badge-requirement">{badge.requirements}</p>
                    </div>
                    {isEligible && (
                      <div className="badge-eligible-indicator">
                        <Award size={16} />
                        <span>Eligible</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="card">
        {/* Header */}
        <div className="ecosystem-header">
          <div className="ecosystem-title">
            <PieChart className="ecosystem-icon" size={20} />
            <h3>My Activity History</h3>
          </div>
          
          <div className="header-actions">
            {/* Time period selector */}
            <div className="time-period-selector">
              {(['24h', '3d', '7d'] as TimePeriod[]).map(period => (
                <button
                  key={period}
                  onClick={() => setTimePeriod(period)}
                  className={`period-button ${timePeriod === period ? 'active' : ''}`}
                >
                  {periodLabels[period]}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="chart-actions">
              <button
                onClick={handleCapture}
                className="action-button share-button"
                disabled={loading || projectData.length === 0}
              >
                <Share2 size={16} />
                {/* {isCapturing ? 'Capturing...' : 'Share'} */}
                Share
              </button>
              <button
                onClick={handleDownload}
                className="action-button download-button"
                disabled={loading || projectData.length === 0}
              >
                <Download size={16} />
                Download
              </button>
            </div>
          </div>
        </div>



        {/* Chart area */}
        <div className="chart-container">
          {loading ? (
            <div className="loading-container">
              <div className="skeleton-loader">
                <div className="skeleton-circle"></div>
                <div className="skeleton-legend">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton-legend-item">
                      <div className="skeleton-color"></div>
                      <div className="skeleton-text"></div>
                    </div>
                  ))}
                </div>
              </div>
              {progress && <LoadingProgress progress={progress} />}
            </div>
                      ) : (projectData.length === 0) ? (
              <div className="empty-state">
                <Clock size={48} />
                <h3>No Activity Found</h3>
                <p>No transactions found for {periodLabels[timePeriod].toLowerCase()}</p>
              </div>
            ) : (
            <div className="chart-content">
              {/* Pie chart */}
              <div className="pie-chart-wrapper">
                <svg
                  viewBox="0 0 100 100"
                  className="pie-chart"
                  width="300"
                  height="300"
                >
                  {calculatePieSegments().map((slice, index) => (
                    <path
                      key={index}
                      d={slice.path}
                      fill={slice.color}
                      stroke="#ffffff"
                      strokeWidth="0.5"
                      className="pie-slice"
                    />
                  ))}
                  
                  {/* Center text */}
                  <text
                    x="50"
                    y="50"
                    textAnchor="middle"
                    className="center-text"
                    fill="#1e293b"
                  >
                    <tspan x="50" dy="-0.2em" fontSize="8" fontWeight="bold">
                      {totalTransactions}
                    </tspan>
                    <tspan x="50" dy="1.2em" fontSize="4">
                      Transactions
                    </tspan>
                  </text>
                </svg>
              </div>

              {/* Legend */}
              <div className="legend">
                {projectData.map((project, index) => {
                  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#6366f1', '#f97316', '#84cc16'];
                  const color = project.projectId === 'other' ? '#6b7280' : colors[index % colors.length];
                  
                  return (
                    <div key={project.projectId} className="legend-item">
                      <div 
                        className="legend-color"
                        style={{ backgroundColor: color }}
                      ></div>
                      <div className="legend-info">
                        <div className="legend-label">
                          {project.projectIcon && (
                            <img 
                              src={project.projectIcon} 
                              alt={project.projectName}
                              style={{ width: '20px', height: '20px', marginRight: '4px', borderRadius: '4px' }}
                            />
                          )}
                          {!project.projectIcon && project.projectId === 'other' && '📦 '}
                          {project.projectName}
                        </div>
                        <div className="legend-stats">
                          <span className="count">{project.count}</span>
                          <span className="percentage">({project.percentage.toFixed(1)}%)</span>
                        </div>
                        {project.source === 'both' && (
                          <div className="legend-detail">
                            <span className="source-info">💾 {project.storageCount || 0} | ⛓️ {project.onchainCount || 0}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* User info inside card */}
        {!loading && walletAddress && projectData.length > 0 && (
          <div className="user-info">
            <span className="wallet">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
          </div>
        )}
      </div>

      {/* Transaction table - for both storage and on-chain */}
      {loading ? (
        <div className="card transaction-table-container">
          <h3>Recent Activity</h3>
          <div className="table-wrapper">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Project</th>
                  <th>Detail</th>
                  <th>Transaction ID</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(5)].map((_, i) => (
                  <tr key={`skeleton-row-${i}`}>
                    <td><div className="skeleton-text" style={{ width: '120px', height: '1rem' }}></div></td>
                    <td><div className="skeleton-text" style={{ width: '80px', height: '1rem' }}></div></td>
                    <td><div className="skeleton-text" style={{ width: '100px', height: '1rem' }}></div></td>
                    <td><div className="skeleton-text" style={{ width: '80px', height: '1rem' }}></div></td>
                    <td><div className="skeleton-text" style={{ width: '140px', height: '1rem' }}></div></td>
                    <td><div className="skeleton-text" style={{ width: '40px', height: '1rem' }}></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : unifiedTransactions.length > 0 ? (
        <div className="card transaction-table-container">
          <h3>Recent Activity</h3>
          
          {/* Pagination controls */}
          <div className="pagination-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              Showing {((currentPage - 1) * transactionsPerPage) + 1} to {Math.min(currentPage * transactionsPerPage, unifiedTransactions.length)} of {unifiedTransactions.length}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  background: currentPage === 1 ? '#f9fafb' : 'white',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              
              <span style={{ padding: '0 16px', fontSize: '14px' }}>
                {currentPage} of {Math.ceil(unifiedTransactions.length / transactionsPerPage)}
              </span>
              
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(unifiedTransactions.length / transactionsPerPage), prev + 1))}
                disabled={currentPage === Math.ceil(unifiedTransactions.length / transactionsPerPage)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  background: currentPage === Math.ceil(unifiedTransactions.length / transactionsPerPage) ? '#f9fafb' : 'white',
                  cursor: currentPage === Math.ceil(unifiedTransactions.length / transactionsPerPage) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          
          <div className="table-wrapper">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Project</th>
                  <th>Detail</th>
                  <th>Transaction ID</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {unifiedTransactions
                  .slice((currentPage - 1) * transactionsPerPage, currentPage * transactionsPerPage)
                  .map(tx => (
                  <tr key={tx.id}>
                    <td>{formatTimestamp(tx.timestamp)}</td>
                    <td>
                      {tx.source === 'storage' ? (
                        <span className="source-badge storage-badge">💾 Storage</span>
                      ) : (
                        <span className="source-badge onchain-badge">
                          ⛓️ {tx.network || 'On-chain'}
                        </span>
                      )}
                    </td>
                    <td>
                      {tx.source === 'storage' && tx.projectIcon ? (
                        <div className="project-cell">
                          <img 
                            src={tx.projectIcon} 
                            alt={tx.project || 'Others'} 
                            className="project-icon"
                            title={tx.project || 'Others'}
                          />
                        </div>
                      ) : tx.source === 'storage' ? (
                        <div className="project-cell">
                          <div className="project-icon-placeholder" title="Others">
                            <Package size={20} />
                          </div>
                        </div>
                      ) : (
                        <span className="contract-name">{tx.project}</span>
                      )}
                    </td>
                    <td>
                      <span className={tx.source === 'storage' ? 'endpoint-tag' : 'event-tag'}>
                        {tx.detail}
                      </span>
                    </td>
                    <td className="tx-id">{tx.id.slice(0, 8)}...</td>
                    <td>
                      <a
                        href={tx.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tx-link"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      
      {/* Loading Progress Modal */}
      {loading && loadingProgress && (
        <LoadingProgress progress={loadingProgress} />
      )}
      
      {/* Badge Minting Modal */}
      {selectedBadge && (
        <div className="modal-overlay" onClick={() => setSelectedBadge(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedBadge(null)}>
              <X size={24} />
            </button>
            
            <div className="modal-header">
              <img src={selectedBadge.image} alt={selectedBadge.name} className="modal-badge-image" />
              <h2>{selectedBadge.name}</h2>
            </div>
            
            <div className="modal-body">
              <p className="badge-description">{selectedBadge.description}</p>
              <div className="badge-requirements">
                <h4>Requirements</h4>
                <p>{selectedBadge.requirements}</p>
              </div>
              
              {walletAddress && (
                <div className="eligibility-status">
                  {selectedBadge.checkEligibility({ dashboardCount }) ? (
                    <div className="eligible-message">
                      <Award size={20} />
                      <span>You are eligible to mint this badge!</span>
                    </div>
                  ) : (
                    <div className="not-eligible-message">
                      <Lock size={20} />
                      <span>Requirements not met yet</span>
                    </div>
                  )}
                </div>
              )}
              
              {mintError && (
                <div className="alert-message error">
                  <AlertCircle size={20} />
                  <span>{mintError}</span>
                </div>
              )}
              
              {mintSuccess && (
                <div className="alert-message success">
                  <Award size={20} />
                  <span>{mintSuccess}</span>
                </div>
              )}
              
              {mintTxHash && (
                <div className="tx-info">
                  <span>Transaction: </span>
                  <a 
                    href={`https://testnet.explorer.irys.xyz/tx/${mintTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tx-link"
                  >
                    {mintTxHash.slice(0, 8)}...{mintTxHash.slice(-6)}
                    <ExternalLink size={16} />
                  </a>
                </div>
              )}
              
              <button
                className="create-btn"
                onClick={() => handleMintBadge(selectedBadge)}
                disabled={
                  isMinting || 
                  !walletAddress || 
                  !selectedBadge.checkEligibility({ dashboardCount })
                }
              >
                {isMinting ? (
                  <>
                    <span className="spinner"></span>
                    <span>Minting...</span>
                  </>
                ) : (
                  <span>Mint Badge</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyHistorySection; 