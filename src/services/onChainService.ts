import { ethers, Contract, JsonRpcProvider } from 'ethers';
import type { OnChainQuery, OnChainQueryResult, LoadingProgress } from '../types';
import { getCacheKey, getFromCache, setCache } from '../utils/queryUtils';
import irysflipIcon from '../assets/irysflip.png';
import irysSlotIcon from '../assets/irysslot.png';
import irysCrushIcon from '../assets/irys-crush.png';
import playHirysIcon from '../assets/playhirys.jpg';
import irysTarotIcon from '../assets/irys-tarot.png';
import irysForumIcon from '../assets/irys-forum.png';

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
    const fromBlock = Math.max(0, latestBlock - 100000); // 최근 100000 블록
    
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
            // Always get all events and filter manually
            const filter = contract.filters[abi.name]?.();
            console.log(`[OnChainService] Querying ${abi.name} events`);
            
            if (filter) {
              const events = await contract.queryFilter(filter, fromBlock, latestBlock);
              
              // Filter by wallet address if provided
              let filteredEvents = events;
              if (walletAddress && abi.inputs) {
                // Find address field
                const addressField = abi.inputs.find(input => 
                  input.type === 'address' && 
                  (input.name === 'player' || input.name === 'from' || input.name === 'to' || input.name === 'minter')
                );
                
                if (addressField) {
                  const fieldIndex = abi.inputs.indexOf(addressField);
                  filteredEvents = events.filter(event => {
                    if ('args' in event && event.args && event.args[fieldIndex]) {
                      try {
                        const eventAddress = ethers.getAddress(event.args[fieldIndex]);
                        const targetAddress = ethers.getAddress(walletAddress);
                        return eventAddress === targetAddress;
                      } catch (error) {
                        return false;
                      }
                    }
                    return false;
                  });
                  console.log(`[OnChainService] Filtered ${events.length} events to ${filteredEvents.length} for wallet ${walletAddress}`);
                }
              }
              
              for (const event of filteredEvents) {
                const block = await provider.getBlock(event.blockNumber);
                if (block) {
                  // For ScoreSubmitted events, use the event's timestamp if available
                  let timestamp = Number(block.timestamp) * 1000;
                  if (abi.name === 'ScoreSubmitted' && 'args' in event && event.args && event.args[2]) {
                    // ScoreSubmitted has timestamp as third parameter (already in seconds)
                    timestamp = Number(event.args[2]) * 1000;
                  }
                  
                  eventDetails.push({
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    timestamp,
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
    contractAddress: '0x3ef1a34D98e7Eb2CEB089df23B306328f4a05Aa9', // Primary contract
    network: 'irys-testnet',
    rpcUrl: 'https://testnet-rpc.irys.xyz/v1/execution-rpc',
    description: 'IrysFlip Game Contract',
    color: '#10B981',
    icon: irysflipIcon,
    abis: [
      {
        name: 'BetPlaced',
        type: 'event' as const,
        inputs: [
          { name: 'player', type: 'address', indexed: true },
          { name: 'amount', type: 'uint256', indexed: false },
          { name: 'guess', type: 'bool', indexed: false },
          { name: 'win', type: 'bool', indexed: false }
        ]
      }
    ],
    // Additional IrysFlip specific configuration
    multipleContracts: [
      {
        name: 'IrysFlip Contract 1',
        contractAddress: '0x3ef1a34D98e7Eb2CEB089df23B306328f4a05Aa9',
        abis: [
          {
            name: 'BetPlaced',
            type: 'event' as const,
            inputs: [
              { name: 'player', type: 'address', indexed: true },
              { name: 'amount', type: 'uint256', indexed: false },
              { name: 'guess', type: 'bool', indexed: false },
              { name: 'win', type: 'bool', indexed: false }
            ]
          }
        ]
      },
      {
        name: 'IrysFlip Contract 2',
        contractAddress: '0xC9F9A1e0C2822663e31c0fCdF46aF0dc10081423',
        abis: [
          {
            name: 'BetPlaced',
            type: 'event' as const,
            inputs: [
              { name: 'player', type: 'address', indexed: true },
              { name: 'amount', type: 'uint256', indexed: false },
              { name: 'guess', type: 'bool', indexed: false },
              { name: 'win', type: 'bool', indexed: false }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'irys-slot',
    name: 'IrysSlot',
    contractAddress: '0xf30e6506382defd92c2703a094bda00f17664a82',
    network: 'irys-testnet',
    rpcUrl: 'https://testnet-rpc.irys.xyz/v1/execution-rpc',
    description: 'IrysSlot Machine Bank Contract',
    color: '#ffd700',
    icon: irysSlotIcon,
    abis: [
      {
        name: 'Deposit',
        type: 'event' as const,
        inputs: [
          { name: 'player', type: 'address', indexed: true },
          { name: 'amount', type: 'uint256', indexed: false },
          { name: 'newBalance', type: 'uint256', indexed: false }
        ]
      },
      {
        name: 'Withdrawal',
        type: 'event' as const,
        inputs: [
          { name: 'player', type: 'address', indexed: true },
          { name: 'amount', type: 'uint256', indexed: false },
          { name: 'newBalance', type: 'uint256', indexed: false }
        ]
      },
      {
        name: 'BalanceUpdated',
        type: 'event' as const,
        inputs: [
          { name: 'player', type: 'address', indexed: true },
          { name: 'change', type: 'int256', indexed: false },
          { name: 'newBalance', type: 'uint256', indexed: false },
          { name: 'reason', type: 'string', indexed: false }
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
          { name: 'player', type: 'address', indexed: true },
          { name: 'nickname', type: 'string', indexed: false }
        ]
      },
      {
        name: 'ScoreUpdated',
        type: 'event' as const,
        inputs: [
          { name: 'player', type: 'address', indexed: true },
          { name: 'newScore', type: 'uint256', indexed: false },
          { name: 'oldScore', type: 'uint256', indexed: false }
        ]
      },
      {
        name: 'RoomCreated',
        type: 'event' as const,
        inputs: [
          { name: 'roomId', type: 'uint256', indexed: true },
          { name: 'host', type: 'address', indexed: true },
          { name: 'entryFee', type: 'uint256', indexed: false },
          { name: 'gameTime', type: 'uint256', indexed: false }
        ]
      },
      {
        name: 'PlayerJoinedRoom',
        type: 'event' as const,
        inputs: [
          { name: 'roomId', type: 'uint256', indexed: true },
          { name: 'player', type: 'address', indexed: true }
        ]
      },
      {
        name: 'GameStarted',
        type: 'event' as const,
        inputs: [
          { name: 'roomId', type: 'uint256', indexed: true },
          { name: 'host', type: 'address', indexed: false }
        ]
      },
      {
        name: 'GameFinished',
        type: 'event' as const,
        inputs: [
          { name: 'roomId', type: 'uint256', indexed: true },
          { name: 'winner', type: 'address', indexed: true },
          { name: 'prize', type: 'uint256', indexed: false }
        ]
      },
      {
        name: 'PvPGameFinished',
        type: 'event' as const,
        inputs: [
          { name: 'roomId', type: 'uint256', indexed: true },
          { name: 'winner', type: 'address', indexed: true }
        ]
      }
    ]
  },
  {
    id: 'irys-faucet',
    name: 'Irys Testnet Faucet',
    contractAddress: '0x65b7fd9237df3c64461825f0c722a777d7a53804',
    network: 'irys-testnet',
    rpcUrl: 'https://testnet-rpc.irys.xyz/v1/execution-rpc',
    description: 'Irys Testnet Faucet - Track IRYS token distributions',
    color: '#9333ea',
    icon: null,
    abis: [] // Transfer 이벤트를 자동으로 추적
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
              { name: 'player', type: 'address', indexed: true },
              { name: 'score', type: 'uint256', indexed: false },
              { name: 'timestamp', type: 'uint256', indexed: false }
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
              { name: 'player', type: 'address', indexed: true },
              { name: 'score', type: 'uint256', indexed: false },
              { name: 'timestamp', type: 'uint256', indexed: false }
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
              { name: 'player', type: 'address', indexed: true },
              { name: 'score', type: 'uint256', indexed: false },
              { name: 'timestamp', type: 'uint256', indexed: false }
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
              { name: 'player', type: 'address', indexed: true },
              { name: 'score', type: 'uint256', indexed: false },
              { name: 'timestamp', type: 'uint256', indexed: false }
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
            anonymous: false,
            inputs: [
              { name: 'player', type: 'address', indexed: true },
              { name: 'score', type: 'uint256', indexed: false },
              { name: 'timestamp', type: 'uint256', indexed: false }
            ]
          }
        ]
      },
      {
        name: 'Sprite Glide',
        contractAddress: '0x472f75ADF4598373648B5871c7877913A37AAd72',
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
            anonymous: false,
            inputs: [
              { name: 'player', type: 'address', indexed: true },
              { name: 'score', type: 'uint256', indexed: false },
              { name: 'timestamp', type: 'uint256', indexed: false }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'irys-tarot-card',
    name: 'IrysTarotCard',
    contractAddress: '0xaf34062dddfa12347b81a9d8eaff1b24a8f25215',
    network: 'irys-testnet',
    rpcUrl: 'https://testnet-rpc.irys.xyz/v1/execution-rpc',
    description: 'IrysTarotCard - All events tracking',
    color: '#7c3aed',
    icon: irysTarotIcon,
    abis: [] // 모든 이벤트 로그 수집
  },
  {
    id: 'irys-forum',
    name: 'IrysForum',
    contractAddress: '0xbebfac28e35c7a70eae9df606199e45c85a73a9a',
    network: 'irys-testnet',
    rpcUrl: 'https://testnet-rpc.irys.xyz/v1/execution-rpc',
    description: 'IrysForum - Community forum contract',
    color: '#059669',
    icon: irysForumIcon,
    abis: [
      {
        name: 'PostCreated',
        type: 'event' as const,
        inputs: [
          { name: 'postId', type: 'uint256', indexed: true },
          { name: 'author', type: 'address', indexed: true },
          { name: 'title', type: 'string', indexed: false },
          { name: 'pointsEarned', type: 'uint256', indexed: false }
        ]
      },
      {
        name: 'CommentCreated',
        type: 'event' as const,
        inputs: [
          { name: 'commentId', type: 'uint256', indexed: true },
          { name: 'postId', type: 'uint256', indexed: true },
          { name: 'author', type: 'address', indexed: true },
          { name: 'pointsEarned', type: 'uint256', indexed: false }
        ]
      },
      {
        name: 'UsernameRegistered',
        type: 'event' as const,
        inputs: [
          { name: 'user', type: 'address', indexed: true },
          { name: 'username', type: 'string', indexed: false }
        ]
      },
      {
        name: 'PointsEarned',
        type: 'event' as const,
        inputs: [
          { name: 'user', type: 'address', indexed: true },
          { name: 'points', type: 'uint256', indexed: false },
          { name: 'reason', type: 'string', indexed: false }
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
    
    console.log(`[OnChainService] Found ${events.length} events for ${walletAddress} on ${query.contractAddress}`);
    
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
  'function totalSupply() view returns (uint256)',
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
    
    // Get total supply to verify
    let totalSupply = 0;
    try {
      const totalSupplyBN = await contract.totalSupply();
      totalSupply = Number(totalSupplyBN.toString());
      console.log('[OnChainService] Total NFT supply:', totalSupply);
    } catch (error) {
      console.log('[OnChainService] Could not get total supply:', error);
    }
    
    // Query ALL NFTMinted events from contract deployment (block 0)
    const filter = contract.filters.NFTMinted();
    const events = await contract.queryFilter(filter, 0, 'latest');
    
    console.log('[OnChainService] Found', events.length, 'total NFTMinted events');
    
    const badgeCounts = new Map<string, number>();
    const metadataCache = new Map<string, string>();
    const failedFetches: string[] = [];
    
    // Process events sequentially to avoid rate limiting
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      if ('args' in event && event.args) {
        const [, tokenId, uri] = event.args;
        
        // Check cache first
        let badgeId = metadataCache.get(uri);
        
        if (!badgeId) {
          try {
            console.log(`[OnChainService] Fetching metadata ${i + 1}/${events.length} from: ${uri}`);
            const metadataResponse = await fetch(uri);
            
            if (metadataResponse.ok) {
              const metadata = await metadataResponse.json();
              const badgeTypeAttr = metadata.attributes?.find((attr: any) => 
                attr.trait_type === 'Badge Type'
              );
              
              badgeId = badgeTypeAttr?.value || 'unknown';
              if (badgeId) {
                metadataCache.set(uri, badgeId);
              }
              
              console.log(`[OnChainService] Token #${tokenId} - Badge: ${badgeId}`);
            } else {
              console.error(`[OnChainService] Failed to fetch metadata: ${metadataResponse.status}`);
              badgeId = 'unknown';
              failedFetches.push(uri);
            }
          } catch (error) {
            console.error('[OnChainService] Error fetching metadata:', error);
            badgeId = 'unknown';
            failedFetches.push(uri);
          }
          
          // Add small delay to avoid rate limiting
          if (i < events.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        // Increment count for this badge
        if (badgeId) {
          badgeCounts.set(badgeId, (badgeCounts.get(badgeId) || 0) + 1);
        }
      }
    }
    
    console.log('[OnChainService] Badge mint counts:', Array.from(badgeCounts.entries()));
    if (failedFetches.length > 0) {
      console.log('[OnChainService] Failed to fetch metadata for', failedFetches.length, 'URIs');
    }
    
    return badgeCounts;
  } catch (error) {
    console.error('[OnChainService] Error querying badge mint counts:', error);
    return new Map();
  }
} 