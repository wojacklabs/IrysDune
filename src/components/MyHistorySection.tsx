import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Clock, Download, Share2, AlertCircle, ExternalLink, Package } from 'lucide-react';
import { getUserTransactions } from '../services/irysService';
import { queryUserOnChainData, queryOnChainEvents, ON_CHAIN_PRESETS } from '../services/onChainService';
import { ACTIVITY_CATEGORIES, getActivityFromTags, getProjectFromTags, getActivityFromEvent } from '../constants/tagActivityMapping';
import type { LoadingProgress as LoadingProgressType } from '../types';
import LoadingProgress from './LoadingProgress';
import { captureAndShare, downloadImage, captureElement } from '../utils/captureUtils';

type TimePeriod = '1m' | '3m' | '6m';

interface MyHistorySectionProps {
  walletAddress: string | null;
}

interface ActivityData {
  activityId: string;
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

const MyHistorySection: React.FC<MyHistorySectionProps> = ({ walletAddress }) => {
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('6m');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<LoadingProgressType | null>(null);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [unifiedTransactions, setUnifiedTransactions] = useState<UnifiedTransaction[]>([]);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Time period labels
  const periodLabels: Record<TimePeriod, string> = {
    '1m': 'Last 1 Month',
    '3m': 'Last 3 Months',
    '6m': 'Last 6 Months'
  };

  // Load user transaction history
  const loadUserHistory = async () => {
    if (!walletAddress) return;

    setLoading(true);
    setProgress({ current: 0, total: 200, percentage: 0 }); // storage + onchain 로딩을 위해 200으로 설정

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
        '1m': 1,
        '3m': 3,
        '6m': 6
      };

      // 병렬로 storage와 on-chain 데이터 로드
      const [storageData, onchainData] = await Promise.all([
        // Storage 데이터 로드
        (async () => {
          console.log('[MyHistory] Loading storage transactions for period:', timePeriod);
          const fetchedTransactions: Transaction[] = await getUserTransactions(walletAddress, timePeriod, (prog) => {
            setProgress({
              current: prog.current / 2, // storage는 전체의 절반
              total: 200,
              percentage: prog.percentage / 2
            });
          });
          
          // Group by activity
          const activityCounts: { [key: string]: number } = {};
          
          fetchedTransactions.forEach(tx => {
            const activityId = getActivityFromTags(tx.tags);
            activityCounts[activityId] = (activityCounts[activityId] || 0) + 1;
          });
          
          return { transactions: fetchedTransactions, activityCounts };
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
                { months: periodMap[timePeriod] }
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
                current: 100 + (completedPresets / totalPresets * 100), // onchain은 100부터 시작
                total: 200,
                percentage: 50 + Math.round((completedPresets / totalPresets) * 50)
              });
            } catch (error) {
              console.error(`[MyHistory] Error querying ${preset.name}:`, error);
              completedPresets++;
              setProgress({
                current: 100 + (completedPresets / totalPresets * 100),
                total: 200,
                percentage: 50 + Math.round((completedPresets / totalPresets) * 50)
              });
            }
          });
          
          // 모든 preset 조회 완료 대기
          await Promise.all(presetPromises);
          
          // Group on-chain by activity
          const activityCounts: { [key: string]: number } = {};
          
          allTransactions.forEach(tx => {
            const activityId = getActivityFromEvent(tx.eventName);
            activityCounts[activityId] = (activityCounts[activityId] || 0) + 1;
          });
          
          return { 
            contracts: allOnChainData,
            transactions: allTransactions,
            activityCounts 
          };
        })()
      ]);

      // Storage와 on-chain 활동 통합
      const combinedActivityCounts: { [key: string]: { storage: number, onchain: number } } = {};
      
      // Storage 활동 추가
      Object.entries(storageData.activityCounts).forEach(([activityId, count]) => {
        if (!combinedActivityCounts[activityId]) {
          combinedActivityCounts[activityId] = { storage: 0, onchain: 0 };
        }
        combinedActivityCounts[activityId].storage = count;
      });
      
      // On-chain 활동 추가
      Object.entries(onchainData.activityCounts).forEach(([activityId, count]) => {
        if (!combinedActivityCounts[activityId]) {
          combinedActivityCounts[activityId] = { storage: 0, onchain: 0 };
        }
        combinedActivityCounts[activityId].onchain = count;
      });
      
      // 통합된 activity data 생성
      const activities: ActivityData[] = Object.entries(combinedActivityCounts)
        .map(([activityId, counts]) => {
          const totalCount = counts.storage + counts.onchain;
          const source: 'storage' | 'onchain' | 'both' = counts.storage > 0 && counts.onchain > 0 ? 'both' : 
                        counts.storage > 0 ? 'storage' : 'onchain';
          
          return {
            activityId,
            count: totalCount,
            percentage: 0, // 나중에 계산
            source,
            storageCount: counts.storage,
            onchainCount: counts.onchain
          };
        })
        .sort((a, b) => b.count - a.count);

      // 퍼센티지 계산
      const totalCount = activities.reduce((sum, a) => sum + a.count, 0);
      if (activities.length > 0 && totalCount > 0) {
        activities.forEach(activity => {
          activity.percentage = (activity.count / totalCount) * 100;
        });
        
        // 반올림 오차 조정
        const percentageSum = activities.reduce((sum, a) => sum + a.percentage, 0);
        if (percentageSum !== 100 && percentageSum > 0) {
          const adjustment = 100 - percentageSum;
          activities[0].percentage += adjustment;
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
          project: project?.name,
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
        
        allUnifiedTransactions.push({
          id: tx.id,
          timestamp: tx.timestamp,
          source: 'onchain',
          project: tx.contractName,
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
      setActivityData(activities);
      setUnifiedTransactions(limitedTransactions);
      setTotalTransactions(totalCount);
      
      console.log('[MyHistory] All data loaded:', {
        activities: activities.length,
        storageTransactions: storageData.transactions.length,
        onchainTransactions: onchainData.transactions.length,
        unifiedTransactions: limitedTransactions.length
      });
    } catch (error) {
      console.error('[MyHistory] Error loading history:', error);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  // Load user history when component mounts or when parameters change
  useEffect(() => {
    loadUserHistory();
  }, [walletAddress, timePeriod]);

  // Share chart (capture and share)
  const handleCapture = async () => {
    if (!sectionRef.current) return;
    
    // setIsCapturing(true); // This state was removed, so this line is removed.
    try {
      const shareText = `My Irys Activity (${periodLabels[timePeriod]}):\n\n` +
        activityData.map(activity => {
          const category = ACTIVITY_CATEGORIES[activity.activityId];
          let text = `${category.name}: ${activity.count} (${activity.percentage.toFixed(1)}%)`;
          if (activity.source === 'both') {
            text += ` [💾${activity.storageCount} | ⛓️${activity.onchainCount}]`;
          } else if (activity.source === 'storage') {
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
    if (activityData.length === 0) return [];
    
    // 전체 카운트 계산
    const totalCount = activityData.reduce((sum, d) => sum + d.count, 0);
    if (totalCount === 0) return [];
    
    // 단일 항목인 경우 전체 원을 그림
    if (activityData.length === 1) {
      const category = ACTIVITY_CATEGORIES[activityData[0].activityId];
      return [{
        path: `M 50 50 L 50 10 A 40 40 0 0 1 50 90 A 40 40 0 0 1 50 10 Z`,
        color: category.color,
        activity: activityData[0]
      }];
    }
    
    let cumulativePercentage = 0;
    return activityData.map((activity) => {
      const startAngle = (cumulativePercentage * 360) / 100;
      let endAngle = ((cumulativePercentage + activity.percentage) * 360) / 100;
      
      // Prevent exact 360 degrees (use 359.99 instead)
      if (endAngle - startAngle >= 360) {
        endAngle = startAngle + 359.99;
      }
      
      cumulativePercentage += activity.percentage;

      const category = ACTIVITY_CATEGORIES[activity.activityId];
      
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
          color: category.color,
          activity
        };
      }

      return {
        path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`,
        color: category.color,
        activity
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
              {(['1m', '3m', '6m'] as TimePeriod[]).map(period => (
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
                disabled={loading || activityData.length === 0}
              >
                <Share2 size={16} />
                {/* {isCapturing ? 'Capturing...' : 'Share'} */}
                Share
              </button>
              <button
                onClick={handleDownload}
                className="action-button download-button"
                disabled={loading || activityData.length === 0}
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
          ) : (activityData.length === 0) ? (
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
                {activityData.map(activity => {
                  const category = ACTIVITY_CATEGORIES[activity.activityId];
                  return (
                    <div key={activity.activityId} className="legend-item">
                      <div 
                        className="legend-color"
                        style={{ backgroundColor: category.color }}
                      ></div>
                      <div className="legend-info">
                        <div className="legend-label">
                          {category.icon} {category.name}
                        </div>
                        <div className="legend-stats">
                          <span className="count">{activity.count}</span>
                          <span className="percentage">({activity.percentage.toFixed(1)}%)</span>
                        </div>
                        {activity.source === 'both' && (
                          <div className="legend-detail">
                            <span className="source-info">💾 {activity.storageCount || 0} | ⛓️ {activity.onchainCount || 0}</span>
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
        {!loading && walletAddress && activityData.length > 0 && (
          <div className="user-info">
            <span className="wallet">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
          </div>
        )}
      </div>

      {/* Transaction table - for both storage and on-chain */}
      {!loading && unifiedTransactions.length > 0 && (
        <div className="card transaction-table-container">
          <h3>Recent Activity</h3>
          <div className="table-wrapper">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Project</th>
                  <th>Activity</th>
                  <th>Detail</th>
                  <th>Transaction ID</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {unifiedTransactions.map(tx => (
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
                      <div className="activity-cell">
                        <span className="activity-icon">{tx.activityIcon}</span>
                        <span className="activity-name">{tx.activity}</span>
                      </div>
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
      )}

      {/* On-chain activity summary - remove the old summary */}
    </div>
  );
};

export default MyHistorySection; 