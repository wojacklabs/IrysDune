import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Clock, Download, Share2, AlertCircle, ExternalLink, Package } from 'lucide-react';
import { getUserTransactions } from '../services/irysService';
import { queryUserOnChainData, queryOnChainEvents, ON_CHAIN_PRESETS } from '../services/onChainService';
import { ACTIVITY_CATEGORIES, getActivityFromTags, getProjectFromTags, getActivityFromEvent } from '../constants/tagActivityMapping';
import type { LoadingProgress as LoadingProgressType } from '../types';
import LoadingProgress from './LoadingProgress';
import { captureAndShare, downloadImage, captureElement } from '../utils/captureUtils';

type TimePeriod = '24h' | '3d' | '7d';
type QueryMode = 'storage' | 'onchain';

interface MyHistorySectionProps {
  walletAddress: string | null;
  username: string | null;
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
  network: string;
  count: number;
  percentage: number;
}

interface OnChainTransaction {
  id: string;
  timestamp: number;
  eventName: string;
  contractName: string;
  network: string;
  url: string;
}

const MyHistorySection: React.FC<MyHistorySectionProps> = ({ walletAddress, username }) => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('7d');
  const [queryMode, setQueryMode] = useState<QueryMode>('storage');
  const [selectedOnChainPreset, setSelectedOnChainPreset] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<LoadingProgressType>({ current: 0, total: 100, percentage: 0 });
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [onChainData, setOnChainData] = useState<OnChainActivity[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [onChainTransactions, setOnChainTransactions] = useState<OnChainTransaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

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
    setProgress({ current: 0, total: 100, percentage: 0 });

    try {
      if (queryMode === 'onchain' && selectedOnChainPreset) {
        // 온체인 쿼리 처리
        const preset = ON_CHAIN_PRESETS.find(p => p.id === selectedOnChainPreset);
        if (!preset) return;

        console.log('[MyHistory] Loading on-chain data for preset:', preset.name);
        
        const periodMap = {
          '24h': 0.03, // ~1 day
          '3d': 0.1,   // ~3 days
          '7d': 0.25   // ~7 days
        };
        
        const results = await queryUserOnChainData(
          {
            contractAddress: preset.contractAddress,
            network: preset.network,
            rpcUrl: preset.rpcUrl,
            abis: preset.abis
          },
          walletAddress,
          setProgress,
          { months: periodMap[timePeriod] }
        );

        // 집계
        let totalCount = 0;
        const functionCounts: { [key: string]: number } = {};
        
        // 함수별로 집계
        results.forEach(result => {
          totalCount += result.count;
          if (result.functionName) {
            functionCounts[result.functionName] = (functionCounts[result.functionName] || 0) + result.count;
          }
        });
        
        setTotalTransactions(totalCount);
        
        // 온체인 데이터 설정
        if (preset.abis && preset.abis.length > 0) {
          // 여러 이벤트가 있는 경우
          const activities: OnChainActivity[] = Object.entries(functionCounts).map(([functionName, count]) => ({
            contractName: `${preset.name} - ${functionName}`,
            network: preset.network || 'mainnet',
            count,
            percentage: totalCount > 0 ? (count / totalCount) * 100 : 0
          }));
          setOnChainData(activities);
        } else {
          // 단일 컨트랙트 전체 활동
          setOnChainData([{
            contractName: preset.name,
            network: preset.network || 'mainnet',
            count: totalCount,
            percentage: 100
          }]);
        }
        
        // 온체인 이벤트 상세 조회 (walletAddress로 필터링)
        try {
          const events = await queryOnChainEvents({
            contractAddress: preset.contractAddress,
            network: preset.network,
            rpcUrl: preset.rpcUrl,
            abis: preset.abis
          }, 50, walletAddress); // walletAddress 추가
          
          // 이벤트를 트랜잭션 형태로 변환
          const onChainTxs: OnChainTransaction[] = events.map(event => {
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
              network: preset.network || 'mainnet',
              url: explorerUrl
            };
          });
          
          setOnChainTransactions(onChainTxs);
        } catch (error) {
          console.error('[MyHistory] Error loading on-chain events:', error);
          setOnChainTransactions([]);
        }
        
        // 스토리지 트랜잭션은 비워둠
        setTransactions([]);
        setActivityData([]);
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

        // Calculate percentages
        const total = fetchedTransactions.length;
        setTotalTransactions(total);
        setTransactions(fetchedTransactions);
        
        const activities: ActivityData[] = Object.entries(activityCounts)
          .map(([activityId, count]) => ({
            activityId,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0
          }))
          .sort((a, b) => b.count - a.count);

        // Adjust percentages to ensure they sum to exactly 100%
        if (activities.length > 0 && total > 0) {
          const rawTotal = activities.reduce((sum, act) => sum + act.percentage, 0);
          if (rawTotal !== 100) {
            // Normalize percentages
            activities.forEach(act => {
              act.percentage = (act.percentage / rawTotal) * 100;
            });
          }
        }

        setActivityData(activities);
        setOnChainData([]);
      }
    } catch (error) {
      console.error('[MyHistory] Error loading user history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (walletAddress) {
      loadUserHistory();
    }
  }, [walletAddress, timePeriod, queryMode, selectedOnChainPreset]);

  // Share chart (capture and share)
  const handleCapture = async () => {
    if (!sectionRef.current) return;
    
    setIsCapturing(true);
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
      setIsCapturing(false);
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

  // Calculate pie chart paths
  const calculatePieChart = () => {
    if (queryMode === 'onchain') {
      // 온체인 데이터용 파이 차트
      if (onChainData.length === 0) return [];
      
      // 온체인은 단일 컨트랙트이므로 전체 원을 그림
      return [{
        path: `M 50 50 L 50 10 A 40 40 0 0 1 50 90 A 40 40 0 0 1 50 10 Z`,
        color: '#3b82f6',
        activity: onChainData[0]
      }];
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
      
      // largeArcFlag should be 1 if the arc angle is greater than 180 degrees
      const angleSpan = endAngle - startAngle;
      const largeArcFlag = angleSpan > 180 ? 1 : 0;

      // Special handling for very large segments (> 359 degrees)
      if (angleSpan >= 359) {
        // Draw almost full circle using two arcs
        const midAngle = startAngle + 180;
        const midAngleRad = (midAngle * Math.PI) / 180;
        const xMid = 50 + 40 * Math.cos(midAngleRad - Math.PI / 2);
        const yMid = 50 + 40 * Math.sin(midAngleRad - Math.PI / 2);
        
        return {
          path: `M 50 50 L ${x1} ${y1} A 40 40 0 0 1 ${xMid} ${yMid} A 40 40 0 0 1 ${x2} ${y2} Z`,
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
                disabled={loading || (queryMode === 'storage' ? activityData.length === 0 : onChainData.length === 0) || isCapturing}
              >
                <Share2 size={16} />
                {isCapturing ? 'Capturing...' : 'Share'}
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
              📦 Storage Activity
            </button>
            <button
              type="button"
              className={`mode-btn ${queryMode === 'onchain' ? 'active' : ''}`}
              onClick={() => setQueryMode('onchain')}
            >
              ⛓️ On-chain Activity
            </button>
          </div>

          {queryMode === 'onchain' && (
            <div className="onchain-preset-selector">
              <label>Select Contract</label>
              <select
                value={selectedOnChainPreset}
                onChange={(e) => setSelectedOnChainPreset(e.target.value)}
                className="preset-select"
              >
                <option value="">Select a preset contract</option>
                {ON_CHAIN_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} ({preset.network})
                  </option>
                ))}
              </select>
            </div>
          )}
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
              <LoadingProgress progress={progress} />
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
                  {calculatePieChart().map((slice, index) => (
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
                        style={{ backgroundColor: '#3b82f6' }}
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
        {username && !loading && (queryMode === 'storage' ? activityData.length > 0 : onChainData.length > 0) && (
          <div className="user-info">
            <span className="username">{username}</span>
            <span className="wallet">{walletAddress!.slice(0, 6)}...{walletAddress!.slice(-4)}</span>
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