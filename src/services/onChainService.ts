import { ethers, Contract, JsonRpcProvider } from 'ethers';
import type { OnChainQuery, OnChainQueryResult, LoadingProgress } from '../types';
import { getCacheKey, getFromCache, setCache } from '../utils/queryUtils';

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
  limit: number = 100
): Promise<OnChainEventDetail[]> {
  const network = query.network || 'mainnet';
  const rpcUrl = query.rpcUrl;
  
  if (!rpcUrl) {
    throw new Error(`RPC URL is required for on-chain queries`);
  }

  console.log(`[OnChainService] Querying recent events from ${query.contractAddress}`);

  try {
    const provider = new JsonRpcProvider(rpcUrl);
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 1000); // 최근 1000 블록
    
    const eventDetails: OnChainEventDetail[] = [];
    
    if (!query.abis || query.abis.length === 0) {
      // Transfer 이벤트만 조회
      const transferEventSignature = 'Transfer(address,address,uint256)';
      const transferTopic = ethers.id(transferEventSignature);
      
      const logs = await provider.getLogs({
        address: query.contractAddress,
        topics: [transferTopic],
        fromBlock: fromBlock,
        toBlock: latestBlock
      });
      
      // 최근 이벤트부터 정렬
      const sortedLogs = logs.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, limit);
      
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
              
              for (const event of events) {
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
    id: 'uniswap-v3',
    name: 'Uniswap V3 Factory',
    contractAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    network: 'mainnet',
    rpcUrl: 'https://ethereum.publicnode.com',
    description: 'Uniswap V3 Factory - Pool Creation',
    abis: [
      {
        name: 'PoolCreated',
        type: 'event' as const,
        inputs: [
          { name: 'token0', type: 'address' },
          { name: 'token1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'pool', type: 'address' }
        ]
      }
    ]
  },
  {
    id: 'aave-v3',
    name: 'Aave V3 Pool',
    contractAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    network: 'mainnet',
    rpcUrl: 'https://ethereum.publicnode.com',
    description: 'Aave V3 Lending Pool',
    abis: [
      {
        name: 'Supply',
        type: 'event' as const,
        inputs: [
          { name: 'reserve', type: 'address' },
          { name: 'user', type: 'address' },
          { name: 'onBehalfOf', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'referralCode', type: 'uint16' }
        ]
      },
      {
        name: 'Borrow',
        type: 'event' as const,
        inputs: [
          { name: 'reserve', type: 'address' },
          { name: 'user', type: 'address' },
          { name: 'onBehalfOf', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'interestRateMode', type: 'uint8' },
          { name: 'borrowRate', type: 'uint256' },
          { name: 'referralCode', type: 'uint16' }
        ]
      }
    ]
  },
  {
    id: 'lens-hub',
    name: 'Lens Protocol Hub',
    contractAddress: '0xDb46d1Dc155634FbC732f92E853b10B288AD5a1d',
    network: 'polygon',
    rpcUrl: 'https://polygon-rpc.com',
    description: 'Lens Protocol Main Hub',
    abis: [
      {
        name: 'ProfileCreated',
        type: 'event' as const,
        inputs: [
          { name: 'profileId', type: 'uint256' },
          { name: 'creator', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'handle', type: 'string' },
          { name: 'imageURI', type: 'string' },
          { name: 'followModule', type: 'address' },
          { name: 'followModuleReturnData', type: 'bytes' },
          { name: 'followNFTURI', type: 'string' },
          { name: 'timestamp', type: 'uint256' }
        ]
      }
    ]
  },
  {
    id: 'irys-flip',
    name: 'IrysFlip',
    contractAddress: '0x3ef1a34D98e7Eb2CEB089df23B306328f4a05Aa9',
    network: 'irys-testnet',
    rpcUrl: 'https://testnet-rpc.irys.xyz/v1/execution-rpc',
    description: 'IrysFlip Game Contract',
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
  }
]; 