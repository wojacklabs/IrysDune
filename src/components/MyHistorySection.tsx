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
}

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

const MyHistorySection: React.FC<MyHistorySectionProps> = ({ walletAddress }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('6m');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<LoadingProgressType | null>(null);
  const [queryMode, setQueryMode] = useState<'storage' | 'onchain'>('storage');
  const [onChainData, setOnChainData] = useState<OnChainActivity[]>([]);
  const [onChainTransactions, setOnChainTransactions] = useState<OnChainTransaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
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
    setProgress({ current: 0, total: 100, percentage: 0 });

    try {
      if (queryMode === 'onchain') {
        // 온체인 모드: 모든 preset에 대해 조회
        console.log('[MyHistory] Loading all on-chain presets for user:', walletAddress);
        
        const allOnChainData: OnChainActivity[] = [];
        const allTransactions: OnChainTransaction[] = [];
        
        // 색상 팔레트
        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#6366f1'];
        
        const periodMap = {
          '1m': 1,
          '3m': 3,
          '6m': 6
        };
        
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
              undefined, // progressCallback은 개별 preset에서는 사용하지 않음
              { months: periodMap[timePeriod] }
            );

            const totalCount = results.reduce((sum, r) => sum + r.count, 0);
            
            if (totalCount > 0) {
              allOnChainData.push({
                contractName: preset.name,
                contractAddress: preset.contractAddress,
                network: preset.network,
                count: totalCount,
                color: colors[index % colors.length] // 각 preset에 대해 다른 색상 할당
              });

              // 이벤트 상세 조회
              const events = await queryOnChainEvents({
                contractAddress: preset.contractAddress,
                network: preset.network,
                rpcUrl: preset.rpcUrl,
                abis: preset.abis
              }, 20, walletAddress); // 각 preset당 최대 20개
              
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
              current: completedPresets,
              total: totalPresets,
              percentage: Math.round((completedPresets / totalPresets) * 100)
            });
          } catch (error) {
            console.error(`[MyHistory] Error querying ${preset.name}:`, error);
            completedPresets++;
            setProgress({
              current: completedPresets,
              total: totalPresets,
              percentage: Math.round((completedPresets / totalPresets) * 100)
            });
          }
        });
        
        // 모든 preset 조회 완료 대기
        await Promise.all(presetPromises);
        
        // 카운트 기준으로 정렬
        allOnChainData.sort((a, b) => b.count - a.count);
        
        // 시간순으로 정렬 (최신 먼저)
        allTransactions.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        // 최대 100개만 유지
        const limitedTransactions = allTransactions.slice(0, 100);
        
        setOnChainData(allOnChainData);
        setOnChainTransactions(limitedTransactions);
        setTotalTransactions(allOnChainData.reduce((sum, d) => sum + d.count, 0));
        
        // 스토리지 데이터는 초기화
        setTransactions([]);
        setActivityData([]);
        
        console.log('[MyHistory] On-chain data loaded:', {
          presets: allOnChainData.length,
          transactions: limitedTransactions.length
        });
      } else {
        // 기존 스토리지 쿼리 로직
        console.log('[MyHistory] Loading transactions for period:', timePeriod);
        const fetchedTransactions = await getUserTransactions(walletAddress, timePeriod, setProgress);
        
        // Group by activity
        const activityCounts: { [key: string]: number } = {};
        
        fetchedTransactions.forEach(tx => {
          const activityId = getActivityFromTags(tx.tags);
          activityCounts[activityId] = (activityCounts[activityId] || 0) + 1;
        });
        
        // Create activity data with counts
        const activities: ActivityData[] = Object.entries(activityCounts)
          .map(([activityId, count]) => ({
            activityId,
            count,
            percentage: 100 // 스토리지 모드에서는 모든 활동의 비율을 100%로 고정
          }))
          .sort((a, b) => b.count - a.count);

        // Adjust percentages to ensure they sum to exactly 100%
        const total = fetchedTransactions.length;
        if (activities.length > 0 && total > 0) {
          // Calculate actual percentages
          activities.forEach(activity => {
            activity.percentage = (activity.count / total) * 100;
          });
          
          // Adjust for rounding errors
          const percentageSum = activities.reduce((sum, a) => sum + a.percentage, 0);
          if (percentageSum !== 100 && percentageSum > 0) {
            const adjustment = 100 - percentageSum;
            activities[0].percentage += adjustment;
          }
        }

        setTransactions(fetchedTransactions);
        setActivityData(activities);
        setTotalTransactions(fetchedTransactions.length);
        setOnChainData([]);
        setOnChainTransactions([]);
      }
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
  }, [walletAddress, timePeriod, queryMode]);

  // Share chart (capture and share)
  const handleCapture = async () => {
    if (!sectionRef.current) return;
    
    // setIsCapturing(true); // This state was removed, so this line is removed.
    try {
      const shareText = `My Irys Activity (${periodLabels[timePeriod]}):\n\n` +
        activityData.map(activity => {
          const category = ACTIVITY_CATEGORIES[activity.activityId];
          return `${category.name}: ${activity.count} (${activity.percentage.toFixed(1)}%)`;
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
    if (queryMode === 'onchain') {
      // 온체인 데이터용 파이 차트
      if (onChainData.length === 0) return [];
      
      // 전체 카운트 계산
      const totalCount = onChainData.reduce((sum, d) => sum + d.count, 0);
      if (totalCount === 0) return [];
      
      // 단일 항목인 경우 전체 원을 그림
      if (onChainData.length === 1) {
        return [{
          path: `M 50 50 L 50 10 A 40 40 0 0 1 50 90 A 40 40 0 0 1 50 10 Z`,
          color: onChainData[0].color,
          activity: onChainData[0]
        }];
      }
      
      // 여러 항목인 경우 각 세그먼트 계산
      let cumulativePercentage = 0;
      return onChainData.map((contract) => {
        const percentage = (contract.count / totalCount) * 100;
        const startAngle = (cumulativePercentage * 360) / 100;
        let endAngle = ((cumulativePercentage + percentage) * 360) / 100;
        
        // Prevent exact 360 degrees (use 359.99 instead)
        if (endAngle - startAngle >= 360) {
          endAngle = startAngle + 359.99;
        }
        
        cumulativePercentage += percentage;

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
            color: contract.color,
            activity: contract,
            percentage
          };
        }

        return {
          path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`,
          color: contract.color,
          activity: contract,
          percentage
        };
      });
    }
    
    // 기존 스토리지 데이터용 파이 차트 로직
    if (activityData.length === 0) return [];
    
    // Special case: if only one activity (100%), draw a full circle
    if (activityData.length === 1) {
      const category = ACTIVITY_CATEGORIES[activityData[0].activityId];
      // Draw a full circle using two semicircles
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

  // Get activity name from tags
  const getActivityLabel = (activityId: string) => {
    const category = ACTIVITY_CATEGORIES[activityId];
    return category ? `${category.icon} ${category.name}` : 'Others';
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
                disabled={loading || (queryMode === 'storage' ? activityData.length === 0 : onChainData.length === 0)}
              >
                <Share2 size={16} />
                {/* {isCapturing ? 'Capturing...' : 'Share'} */}
                Share
              </button>
              <button
                onClick={handleDownload}
                className="action-button download-button"
                disabled={loading || (queryMode === 'storage' ? activityData.length === 0 : onChainData.length === 0)}
              >
                <Download size={16} />
                Download
              </button>
            </div>
          </div>
        </div>

        {/* 쿼리 모드 선택기 */}
        <div className="query-mode-section">
          <div className="query-mode-selector">
            <button
              type="button"
              className={`mode-btn ${queryMode === 'storage' ? 'active' : ''}`}
              onClick={() => setQueryMode('storage')}
            >
              💾 Storage Activity
            </button>
            <button
              type="button"
              className={`mode-btn ${queryMode === 'onchain' ? 'active' : ''}`}
              onClick={() => setQueryMode('onchain')}
            >
              ⛓️ On-chain Activity
            </button>
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
          ) : (queryMode === 'storage' ? activityData.length === 0 : onChainData.length === 0) ? (
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
                {queryMode === 'storage' ? (
                  activityData.map(activity => {
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
                        </div>
                      </div>
                    );
                  })
                ) : (
                  onChainData.map((contract, index) => (
                    <div key={index} className="legend-item">
                      <div 
                        className="legend-color"
                        style={{ backgroundColor: contract.color }}
                      ></div>
                      <div className="legend-info">
                        <div className="legend-label">
                          ⛓️ {contract.contractName}
                        </div>
                        <div className="legend-stats">
                          <span className="count">{contract.count}</span>
                          <span className="percentage">({contract.network})</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User info inside card */}
        {!loading && walletAddress && ((queryMode === 'storage' ? activityData.length > 0 : onChainData.length > 0)) && (
          <div className="user-info">
            <span className="wallet">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
          </div>
        )}
      </div>

      {/* Transaction table - for both storage and on-chain */}
      {!loading && ((queryMode === 'storage' && transactions.length > 0) || 
                    (queryMode === 'onchain' && onChainTransactions.length > 0)) && (
        <div className="card transaction-table-container">
          <h3>{queryMode === 'storage' ? 'Recent Uploads' : 'Recent On-chain Events'}</h3>
          <div className="table-wrapper">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>{queryMode === 'storage' ? 'Project' : 'Contract'}</th>
                  <th>Activity</th>
                  <th>{queryMode === 'storage' ? 'Endpoint' : 'Event'}</th>
                  <th>Transaction ID</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {queryMode === 'storage' ? (
                  transactions.map(tx => {
                    const project = getProjectFromTags(tx.tags);
                    return (
                      <tr key={tx.id}>
                        <td>{formatTimestamp(tx.timestamp)}</td>
                        <td>
                          <div className="project-cell">
                            {project ? (
                              <img 
                                src={project.icon} 
                                alt={project.name} 
                                className="project-icon"
                                title={project.name}
                              />
                            ) : (
                              <div className="project-icon-placeholder" title="Others">
                                <Package size={20} />
                              </div>
                            )}
                          </div>
                        </td>
                        <td>{getActivityLabel(getActivityFromTags(tx.tags))}</td>
                        <td>
                          <span className="endpoint-tag">{tx.endpoint}</span>
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
                    );
                  })
                ) : (
                  onChainTransactions.map(tx => {
                    const activityId = getActivityFromEvent(tx.eventName);
                    const activity = ACTIVITY_CATEGORIES[activityId];
                    return (
                      <tr key={tx.id}>
                        <td>{formatTimestamp(tx.timestamp)}</td>
                        <td>
                          <div className="contract-cell">
                            <span className="contract-name">{tx.contractName}</span>
                            <span className="network-badge">{tx.network}</span>
                          </div>
                        </td>
                        <td>
                          <div className="activity-cell">
                            <span className="activity-icon">{activity.icon}</span>
                            <span className="activity-name">{activity.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="event-tag">{tx.eventName}</span>
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
                    );
                  })
                )}
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