import { ethers, Contract, JsonRpcProvider } from 'ethers';
import type { OnChainQuery, OnChainQueryResult, LoadingProgress } from '../types';
import { getCacheKey, getFromCache, setCache } from '../utils/queryUtils';
import irysflipIcon from '../assets/irysflip.png';
import irysCrushIcon from '../assets/irys-crush.png';
import playHirysIcon from '../assets/playhirys.jpg';

// 네트워크별 블록 생성 시간 (초)
const BLOCK_TIME: { [key: string]: number } = {
  'mainnet': 12,
  'polygon': 2,
  'arbitrum': 0.25,
  'avalanche': 2,
  'base': 2,
  'irys-testnet': 2
};

// 온체인 쿼리 실행
export async function queryOnChainData(
  query: OnChainQuery,
  progressCallback?: (progress: LoadingProgress) => void,
  dateRange?: { months: number }
): Promise<OnChainQueryResult[]> {
  // 캐시 체크
  const cacheKey = getCacheKey('onchain-query', {
    address: query.contractAddress,
    abis: query.abis?.map(a => a.name).join(','),
    network: query.network || 'mainnet',
    months: dateRange?.months || 6
  });
  
  const cached = getFromCache<OnChainQueryResult[]>(cacheKey);
  if (cached) {
    console.log('[OnChainService] Using cached data');
    if (progressCallback) {
      progressCallback({ current: 1, total: 1, percentage: 100 });
    }
    return cached;
  }

  const network = query.network || 'mainnet';
  const rpcUrl = query.rpcUrl;
  
  if (!rpcUrl) {
    throw new Error(`RPC URL is required for on-chain queries`);
  }

  console.log(`[OnChainService] Querying contract ${query.contractAddress} on ${network}`);

  try {
    const provider = new JsonRpcProvider(rpcUrl);
    
    // 날짜 범위 설정
    const months = dateRange?.months || 6;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    // 블록 번호 가져오기
    const latestBlock = await provider.getBlockNumber();
    const blockTime = BLOCK_TIME[network] || 12; // 초 단위
    const blocksPerDay = (24 * 60 * 60) / blockTime;
    const daysRange = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const startBlock = Math.max(0, latestBlock - Math.floor(blocksPerDay * daysRange));
    
    console.log(`[OnChainService] Block range: ${startBlock} to ${latestBlock}`);

    const results: OnChainQueryResult[] = [];
    
    if (!query.abis || query.abis.length === 0) {
      // Contract address만 있는 경우 - Transfer 이벤트를 통해 활동 추적
      console.log('[OnChainService] Querying Transfer events for activity');
      
      try {
        // ERC20/ERC721 Transfer 이벤트 시그니처
        const transferEventSignature = 'Transfer(address,address,uint256)';
        const transferTopic = ethers.id(transferEventSignature);
        
        // 로그 필터링
        const logs = await provider.getLogs({
          address: query.contractAddress,
          topics: [transferTopic],
          fromBlock: startBlock,
          toBlock: latestBlock
        });
        
        console.log(`[OnChainService] Found ${logs.length} Transfer events`);
        
        // 일별 트랜잭션 수 집계
        const dailyCounts: { [date: string]: number } = {};
        
        for (const log of logs) {
          const block = await provider.getBlock(log.blockNumber);
          if (block) {
            const date = new Date(Number(block.timestamp) * 1000).toISOString().split('T')[0];
            dailyCounts[date] = (dailyCounts[date] || 0) + 1;
          }
        }
        
        // 결과 생성
        Object.entries(dailyCounts).forEach(([date, count]) => {
          results.push({ date, count });
        });
        
      } catch (error) {
        console.error('[OnChainService] Error querying Transfer events:', error);
        // Transfer 이벤트가 없는 경우, 트랜잭션 수로 대체
        const txCount = await provider.getTransactionCount(query.contractAddress);
        results.push({
          date: new Date().toISOString().split('T')[0],
          count: txCount
        });
      }
      
    } else {
      // ABI가 있는 경우 - 특정 함수/이벤트 추적
      console.log('[OnChainService] Querying specific events/functions');
      
      const contract = new Contract(query.contractAddress, query.abis, provider);
      
      // 각 ABI 항목별로 처리
      for (const abi of query.abis) {
        if (abi.type === 'event') {
          // 이벤트 필터링
          try {
            const filter = contract.filters[abi.name]?.();
            if (filter) {
              const events = await contract.queryFilter(filter, startBlock, latestBlock);
              console.log(`[OnChainService] Found ${events.length} ${abi.name} events`);
              
              // 일별 이벤트 수 집계
              const eventCounts: { [date: string]: number } = {};
              
              for (const event of events) {
                const block = await provider.getBlock(event.blockNumber);
                if (block) {
                  const date = new Date(Number(block.timestamp) * 1000).toISOString().split('T')[0];
                  eventCounts[date] = (eventCounts[date] || 0) + 1;
                }
              }
              
              // 결과에 추가
              Object.entries(eventCounts).forEach(([date, count]) => {
                const existing = results.find(r => r.date === date && r.functionName === abi.name);
                if (existing) {
                  existing.count += count;
                } else {
                  results.push({
                    date,
                    count,
                    functionName: abi.name
                  });
                }
              });
            }
          } catch (error) {
            console.error(`[OnChainService] Error querying ${abi.name} events:`, error);
          }
        } else if (abi.type === 'function') {
          // 함수 호출은 로그를 통해 간접적으로 추적
          console.log(`[OnChainService] Function calls cannot be directly queried, skipping ${abi.name}`);
        }
      }
    }
    
    // 날짜순 정렬
    results.sort((a, b) => a.date.localeCompare(b.date));
    
    // 빈 날짜 채우기
    if (results.length > 0) {
      const filledResults: OnChainQueryResult[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        if (query.abis && query.abis.length > 0) {
          // 함수별로 데이터 생성
          for (const abi of query.abis) {
            if (abi.type === 'event') {
              const existing = results.find(r => r.date === dateStr && r.functionName === abi.name);
              filledResults.push({
                date: dateStr,
                count: existing ? existing.count : 0,
                functionName: abi.name
              });
            }
          }
        } else {
          // 전체 트랜잭션
          const existing = results.find(r => r.date === dateStr);
          filledResults.push({
            date: dateStr,
            count: existing ? existing.count : 0
          });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // 캐시 저장 (10분)
      setCache(cacheKey, filledResults, 10 * 60 * 1000);
      
      if (progressCallback) {
        progressCallback({ current: 1, total: 1, percentage: 100 });
      }
      
      return filledResults;
    }
    
    // 데이터가 없는 경우 빈 배열 반환
    return [];
    
  } catch (error) {
    console.error('[OnChainService] Error querying on-chain data:', error);
    throw error;
  }
}

// 온체인 쿼리 결과 인터페이스 확장
export interface OnChainEventDetail {
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  eventName: string;
  contractAddress: string;
  network: string;
  args?: any;
}

// 온체인 이벤트 상세 조회
export async function queryOnChainEvents(
  query: OnChainQuery,
  limit: number = 100,
  walletAddress?: string
): Promise<OnChainEventDetail[]> {
  const network = query.network || 'mainnet';
  const rpcUrl = query.rpcUrl;
  
  if (!rpcUrl) {
    throw new Error(`RPC URL is required for on-chain queries`);
  }

  console.log(`[OnChainService] Querying recent events from ${query.contractAddress}`);
  if (walletAddress) {
    console.log(`[OnChainService] Filtering by wallet address: ${walletAddress}`);
  }

  try {
    const provider = new JsonRpcProvider(rpcUrl);
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 10000); // 최근 10000 블록
    
    const eventDetails: OnChainEventDetail[] = [];
    
    if (!query.abis || query.abis.length === 0) {
      // Transfer 이벤트만 조회
      const transferEventSignature = 'Transfer(address,address,uint256)';
      const transferTopic = ethers.id(transferEventSignature);
      
      // walletAddress가 있으면 from 또는 to 주소로 필터링
      const logs = await provider.getLogs({
        address: query.contractAddress,
        topics: walletAddress ? [
          transferTopic,
          null, // from (any)
          null  // to (any)
        ] : [transferTopic],
        fromBlock: fromBlock,
        toBlock: latestBlock
      });
      
      // walletAddress로 추가 필터링 (from 또는 to가 walletAddress인 경우만)
      const filteredLogs = walletAddress ? logs.filter(log => {
        // Transfer 이벤트의 경우 topics[1]이 from, topics[2]가 to
        const fromAddress = log.topics[1] ? ethers.getAddress('0x' + log.topics[1].slice(26)) : null;
        const toAddress = log.topics[2] ? ethers.getAddress('0x' + log.topics[2].slice(26)) : null;
        const userAddress = ethers.getAddress(walletAddress);
        return fromAddress === userAddress || toAddress === userAddress;
      }) : logs;
      
      // 최근 이벤트부터 정렬
      const sortedLogs = filteredLogs.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, limit);
      
      for (const log of sortedLogs) {
        const block = await provider.getBlock(log.blockNumber);
        if (block) {
          eventDetails.push({
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: Number(block.timestamp) * 1000,
            eventName: 'Transfer',
            contractAddress: query.contractAddress,
            network: network
          });
        }
      }
    } else {
      // 특정 이벤트 조회
      const contract = new Contract(query.contractAddress, query.abis, provider);
      
      for (const abi of query.abis) {
        if (abi.type === 'event') {
          try {
            const filter = contract.filters[abi.name]?.();
            if (filter) {
              const events = await contract.queryFilter(filter, fromBlock, latestBlock);
              
              // walletAddress로 필터링
              const filteredEvents = walletAddress ? events.filter(event => {
                // 이벤트 args에서 address 타입 필드를 찾아서 확인
                if ('args' in event && event.args) {
                  const userAddress = ethers.getAddress(walletAddress);
                  // args의 모든 값을 확인하여 walletAddress와 일치하는지 확인
                  return Object.values(event.args).some(arg => {
                    if (typeof arg === 'string') {
                      try {
                        return ethers.getAddress(arg) === userAddress;
                      } catch {
                        return false;
                      }
                    }
                    return false;
                  });
                }
                return false;
              }) : events;
              
              for (const event of filteredEvents) {
                const block = await provider.getBlock(event.blockNumber);
                if (block) {
                  eventDetails.push({
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    timestamp: Number(block.timestamp) * 1000,
                    eventName: abi.name,
                    contractAddress: query.contractAddress,
                    network: network,
                    args: 'args' in event ? event.args : undefined
                  });
                }
              }
            }
          } catch (error) {
            console.error(`[OnChainService] Error querying ${abi.name} events:`, error);
          }
        }
      }
      
      // 시간순 정렬 (최신 먼저)
      eventDetails.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    return eventDetails.slice(0, limit);
  } catch (error) {
    console.error('[OnChainService] Error querying event details:', error);
    return [];
  }
}

// 온체인 프리셋 정의
export const ON_CHAIN_PRESETS = [
  {
    id: 'irys-flip',
    name: 'IrysFlip',
    contractAddress: '0x3ef1a34D98e7Eb2CEB089df23B306328f4a05Aa9',
    network: 'irys-testnet',
    rpcUrl: 'https://testnet-rpc.irys.xyz/v1/execution-rpc',
    description: 'IrysFlip Game Contract',
    color: '#ff6b6b',
    icon: irysflipIcon,
    abis: [
      {
        name: 'BetPlaced',
        type: 'event' as const,
        inputs: [
          { name: 'player', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'guess', type: 'bool' },
          { name: 'win', type: 'bool' }
        ]
      }
    ]
  },
  {
    id: 'irys-crush',
    name: 'IrysCrush',
    contractAddress: '0xb99b47558cA055919752D659C8a43FdA47Cb56E2',
    network: 'irys-testnet',
    rpcUrl: 'https://testnet-rpc.irys.xyz/v1/execution-rpc',
    description: 'IrysCrush Game Contract',
    color: '#4ecdc4',
    icon: irysCrushIcon,
    abis: [
      {
        name: 'PlayerRegistered',
        type: 'event' as const,
        inputs: [
          { name: 'player', type: 'address' },
          { name: 'nickname', type: 'string' }
        ]
      },
      {
        name: 'ScoreUpdated',
        type: 'event' as const,
        inputs: [
          { name: 'player', type: 'address' },
          { name: 'newScore', type: 'uint256' },
          { name: 'oldScore', type: 'uint256' }
        ]
      },
      {
        name: 'RoomCreated',
        type: 'event' as const,
        inputs: [
          { name: 'roomId', type: 'uint256' },
          { name: 'host', type: 'address' },
          { name: 'entryFee', type: 'uint256' },
          { name: 'gameTime', type: 'uint256' }
        ]
      },
      {
        name: 'PlayerJoinedRoom',
        type: 'event' as const,
        inputs: [
          { name: 'roomId', type: 'uint256' },
          { name: 'player', type: 'address' }
        ]
      },
      {
        name: 'GameStarted',
        type: 'event' as const,
        inputs: [
          { name: 'roomId', type: 'uint256' },
          { name: 'host', type: 'address' }
        ]
      },
      {
        name: 'GameFinished',
        type: 'event' as const,
        inputs: [
          { name: 'roomId', type: 'uint256' },
          { name: 'winner', type: 'address' },
          { name: 'prize', type: 'uint256' }
        ]
      },
      {
        name: 'PvPGameFinished',
        type: 'event' as const,
        inputs: [
          { name: 'roomId', type: 'uint256' },
          { name: 'winner', type: 'address' }
        ]
      }
    ]
  },
  {
    id: 'play-hirys',
    name: 'PlayHirys',
    contractAddress: '', // Multiple contracts
    network: 'irys-testnet',
    rpcUrl: 'https://testnet-rpc.irys.xyz/v1/execution-rpc',
    description: 'PlayHirys Games',
    color: '#303a4d',
    icon: playHirysIcon,
    // Multiple game contracts
    multipleContracts: [
      {
        name: 'Picnic with Sprite',
        contractAddress: '0x1B9dD6EB6F54C31a2aE886e4341e02eD6AE2D77C',
        abis: [
          {
            name: 'submitScore',
            type: 'function' as const,
            inputs: [
              { name: 'newScore', type: 'uint256' }
            ]
          },
          {
            name: 'ScoreSubmitted',
            type: 'event' as const,
            inputs: [
              { name: 'player', type: 'address' },
              { name: 'score', type: 'uint256' },
              { name: 'timestamp', type: 'uint256' }
            ]
          }
        ]
      },
      {
        name: '100 NAs vs 1 Sprite (Easy)',
        contractAddress: '0x885252F2f4CA67c577F521221642Fc3c6e8a1Ac7',
        abis: [
          {
            name: 'submitScore',
            type: 'function' as const,
            inputs: [
              { name: 'score', type: 'uint256' }
            ]
          },
          {
            name: 'ScoreSubmitted',
            type: 'event' as const,
            inputs: [
              { name: 'player', type: 'address' },
              { name: 'score', type: 'uint256' },
              { name: 'timestamp', type: 'uint256' }
            ]
          }
        ]
      },
      {
        name: '100 NAs vs 1 Sprite (Hard)',
        contractAddress: '0x97fB70fa421a5d2010dD93Fd1cfB5c2A2670bA86',
        abis: [
          {
            name: 'submitScore',
            type: 'function' as const,
            inputs: [
              { name: 'score', type: 'uint256' }
            ]
          },
          {
            name: 'ScoreSubmitted',
            type: 'event' as const,
            inputs: [
              { name: 'player', type: 'address' },
              { name: 'score', type: 'uint256' },
              { name: 'timestamp', type: 'uint256' }
            ]
          }
        ]
      },
      {
        name: '100 NAs vs 1 Sprite (Super Hard)',
        contractAddress: '0xF41CFa950FDA43d0D06f64017840BFf0010B09d6',
        abis: [
          {
            name: 'submitScore',
            type: 'function' as const,
            inputs: [
              { name: 'score', type: 'uint256' }
            ]
          },
          {
            name: 'ScoreSubmitted',
            type: 'event' as const,
            inputs: [
              { name: 'player', type: 'address' },
              { name: 'score', type: 'uint256' },
              { name: 'timestamp', type: 'uint256' }
            ]
          }
        ]
      },
      {
        name: 'Bubble Sprite',
        contractAddress: '0x2023B787cB13A538E93FE58d57eA661760666efe',
        abis: [
          {
            name: 'submitScore',
            type: 'function' as const,
            inputs: [
              { name: 'score', type: 'uint256' }
            ]
          },
          {
            name: 'ScoreSubmitted',
            type: 'event' as const,
            inputs: [
              { name: 'player', type: 'address' },
              { name: 'score', type: 'uint256' },
              { name: 'timestamp', type: 'uint256' }
            ]
          }
        ]
      }
    ]
  }
]; 

// 사용자별 온체인 활동 쿼리
export async function queryUserOnChainData(
  query: OnChainQuery,
  walletAddress: string,
  progressCallback?: (progress: LoadingProgress) => void,
  dateRange?: { months?: number; days?: number }
): Promise<OnChainQueryResult[]> {
  // 캐시 체크
  const cacheKey = getCacheKey('user-onchain-query', {
    address: query.contractAddress,
    wallet: walletAddress,
    abis: query.abis?.map(a => a.name).join(','),
    network: query.network || 'mainnet',
    months: dateRange?.months || 6
  });
  
  const cached = getFromCache<OnChainQueryResult[]>(cacheKey);
  if (cached) {
    console.log('[OnChainService] Using cached user data');
    if (progressCallback) {
      progressCallback({ current: 1, total: 1, percentage: 100 });
    }
    return cached;
  }

  const network = query.network || 'mainnet';
  const rpcUrl = query.rpcUrl;
  
  if (!rpcUrl) {
    throw new Error(`RPC URL is required for on-chain queries`);
  }

  console.log(`[OnChainService] Querying user ${walletAddress} activity on ${query.contractAddress}`);

  try {
    const provider = new JsonRpcProvider(rpcUrl);
    
    // 날짜 범위 설정
    const endDate = new Date();
    const startDate = new Date();
    
    if (dateRange?.days) {
      startDate.setDate(startDate.getDate() - dateRange.days);
    } else if (dateRange?.months) {
      startDate.setMonth(startDate.getMonth() - dateRange.months);
    } else {
      // 기본값 6개월
      startDate.setMonth(startDate.getMonth() - 6);
    }
    
    // 블록 번호 가져오기
    const latestBlock = await provider.getBlockNumber();
    const blockTime = BLOCK_TIME[network] || 12;
    const blocksPerDay = (24 * 60 * 60) / blockTime;
    const daysRange = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const startBlock = Math.max(0, latestBlock - Math.floor(blocksPerDay * daysRange));
    
    console.log(`[OnChainService] Block range: ${startBlock} to ${latestBlock}`);

    // walletAddress로 필터링된 이벤트 조회
    const events = await queryOnChainEvents(query, 10000, walletAddress);
    
    // 날짜별 집계
    const dailyCounts: { [key: string]: { [functionName: string]: number } } = {};
    
    events.forEach(event => {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      if (!dailyCounts[date]) {
        dailyCounts[date] = {};
      }
      
      const functionName = event.eventName;
      dailyCounts[date][functionName] = (dailyCounts[date][functionName] || 0) + 1;
    });
    
    // 결과 생성
    const results: OnChainQueryResult[] = [];
    
    Object.entries(dailyCounts).forEach(([date, functionCounts]) => {
      if (query.abis && query.abis.length > 0) {
        // 함수별로 분리
        Object.entries(functionCounts).forEach(([functionName, count]) => {
          results.push({
            date,
            count,
            functionName
          });
        });
      } else {
        // 전체 합계
        const totalCount = Object.values(functionCounts).reduce((sum, count) => sum + count, 0);
        results.push({
          date,
          count: totalCount
        });
      }
    });
    
    // 날짜순 정렬
    results.sort((a, b) => a.date.localeCompare(b.date));
    
    // 캐시 저장 (10분)
    setCache(cacheKey, results, 10 * 60 * 1000);
    
    if (progressCallback) {
      progressCallback({ current: 1, total: 1, percentage: 100 });
    }
    
    return results;
    
  } catch (error) {
    console.error('[OnChainService] Error querying user on-chain data:', error);
    throw error;
  }
}

// Badge NFT contract configuration
const NFT_CONTRACT_ADDRESS = '0x5Aa61c497B4e3592cD69FC88B7303e3Aac5DA5FD';
const IRYS_TESTNET_RPC = 'https://testnet-rpc.irys.xyz/v1/execution-rpc';
const NFT_ABI = [
  'function publicMint(address to, string memory uri) payable',
  'function getMintPrice() pure returns (uint256)',
  'event NFTMinted(address indexed minter, uint256 indexed tokenId, string uri)'
];

// Query minted badges from on-chain NFT contract
export async function queryMintedBadgesOnChain(
  walletAddress: string
): Promise<Map<string, { 
  badgeId: string; 
  txHash: string; 
  tokenId: string;
  timestamp: number; 
  metadataUri: string 
}>> {
  console.log('[OnChainService] Querying minted badges on-chain for wallet:', walletAddress);
  
  try {
    const provider = new JsonRpcProvider(IRYS_TESTNET_RPC);
    const contract = new Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
    
    // Get latest block number
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 100000); // Look back ~100k blocks
    
    // Query NFTMinted events for this wallet
    const filter = contract.filters.NFTMinted(walletAddress);
    const events = await contract.queryFilter(filter, fromBlock, latestBlock);
    
    console.log('[OnChainService] Found', events.length, 'NFTMinted events');
    
    const mintedBadges = new Map<string, {
      badgeId: string;
      txHash: string;
      tokenId: string;
      timestamp: number;
      metadataUri: string;
    }>();
    
    // Process each minting event
    for (const event of events) {
      if ('args' in event && event.args && event.transactionHash) {
        const [, tokenId, uri] = event.args;
        
        // Get block timestamp
        const block = await provider.getBlock(event.blockNumber);
        const timestamp = block ? Number(block.timestamp) * 1000 : Date.now();
        
        // Extract badge ID from metadata URI if possible
        // First, try to fetch metadata from Irys to get badge ID
        let badgeId = 'unknown';
        try {
          const metadataResponse = await fetch(uri);
          if (metadataResponse.ok) {
            const metadata = await metadataResponse.json();
            // Look for badge ID in attributes
            const badgeTypeAttr = metadata.attributes?.find((attr: any) => 
              attr.trait_type === 'Badge Type'
            );
            if (badgeTypeAttr) {
              badgeId = badgeTypeAttr.value;
            }
          }
        } catch (error) {
          console.error('[OnChainService] Error fetching metadata:', error);
        }
        
        mintedBadges.set(badgeId, {
          badgeId,
          txHash: event.transactionHash,
          tokenId: tokenId.toString(),
          timestamp,
          metadataUri: uri
        });
        
        console.log('[OnChainService] Found minted badge:', {
          badgeId,
          tokenId: tokenId.toString(),
          txHash: event.transactionHash
        });
      }
    }
    
    return mintedBadges;
  } catch (error) {
    console.error('[OnChainService] Error querying minted badges on-chain:', error);
    return new Map();
  }
}

// Query total mint counts for all badges
export async function queryBadgeMintCounts(): Promise<Map<string, number>> {
  console.log('[OnChainService] Querying total badge mint counts');
  
  try {
    const provider = new JsonRpcProvider(IRYS_TESTNET_RPC);
    const contract = new Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
    
    // Get latest block number
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 100000); // Look back ~100k blocks
    
    // Query ALL NFTMinted events (no wallet filter)
    const filter = contract.filters.NFTMinted();
    const events = await contract.queryFilter(filter, fromBlock, latestBlock);
    
    console.log('[OnChainService] Found', events.length, 'total NFTMinted events');
    
    const badgeCounts = new Map<string, number>();
    
    // Create a cache for metadata
    const metadataCache = new Map<string, string>();
    
    // Process events in batches for better performance
    const batchSize = 10;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (event) => {
        if ('args' in event && event.args) {
          const [, , uri] = event.args;
          
          // Check cache first
          let badgeId = metadataCache.get(uri) || 'unknown';
          
          if (badgeId === 'unknown') {
            try {
              const metadataResponse = await fetch(uri);
              if (metadataResponse.ok) {
                const metadata = await metadataResponse.json();
                const badgeTypeAttr = metadata.attributes?.find((attr: any) => 
                  attr.trait_type === 'Badge Type'
                );
                if (badgeTypeAttr) {
                  badgeId = badgeTypeAttr.value;
                  metadataCache.set(uri, badgeId);
                }
              }
            } catch (error) {
              console.error('[OnChainService] Error fetching metadata:', error);
            }
          }
          
          // Increment count for this badge
          badgeCounts.set(badgeId, (badgeCounts.get(badgeId) || 0) + 1);
        }
      }));
    }
    
    console.log('[OnChainService] Badge mint counts:', Array.from(badgeCounts.entries()));
    return badgeCounts;
  } catch (error) {
    console.error('[OnChainService] Error querying badge mint counts:', error);
    return new Map();
  }
} 