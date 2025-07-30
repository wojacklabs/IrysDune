import React, { useRef, useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { TreemapController, TreemapElement } from 'chartjs-chart-treemap';
import { Line, Chart as ChartReact } from 'react-chartjs-2';
import { Download, Share2 } from 'lucide-react';
import type { ChartData, ChartType } from '../types';
import { captureAndShare, downloadImage, captureElement } from '../utils/captureUtils';
import { getChartOptions } from '../utils/chartUtils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TreemapController,
  TreemapElement
);

interface ChartProps {
  data: ChartData;
  chartType: ChartType;
  title: string;
  shareText: string;
  onTypeChange: (type: ChartType) => void;
  hideTypeButtons?: boolean;
  hideActions?: boolean;
  captureContainerRef?: React.RefObject<HTMLElement | null>;
}

const Chart: React.FC<ChartProps> = ({ 
  data, 
  chartType, 
  title, 
  shareText, 
  onTypeChange,
  hideTypeButtons = false,
  hideActions = false,
  captureContainerRef
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  // Force re-render when chart type changes
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [chartType]);

  // Check if multiple datasets for chart options
  const isMultipleDatasets = data.datasets.length > 1;
  const options = {
    ...getChartOptions(isMultipleDatasets, chartType),
    plugins: {
      ...getChartOptions(isMultipleDatasets, chartType).plugins,
      title: {
        display: !!title,
        text: title,
        font: {
          family: 'Inter',
          size: 16,
          weight: 'bold' as const
        },
        color: '#1e293b',
        padding: { bottom: 20 }
      }
    }
  };

  // Determine available chart types based on context
  const isWholeEcosystem = shareText.includes('Whole Ecosystem');
  const chartTypeButtons = isWholeEcosystem
    ? ['line', 'stacked'] as ChartType[]  // No treemap for Whole Ecosystem
    : chartType === 'treemap' 
      ? ['line', 'stacked', 'treemap'] as ChartType[]
      : isMultipleDatasets 
        ? ['line', 'stacked', 'treemap'] as ChartType[]
        : ['line', 'treemap'] as ChartType[];

  const handleCapture = async () => {
    // Use captureContainerRef if provided, otherwise use chartRef
    const captureTarget = captureContainerRef?.current || chartRef.current;
    if (!captureTarget) return;
    
    setIsCapturing(true);
    try {
      const filename = `irys-dune-chart-${Date.now()}.png`;
      const result = await captureAndShare(captureTarget, shareText, filename);
      
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

  const handleDownload = async () => {
    // Use captureContainerRef if provided, otherwise use chartRef
    const captureTarget = captureContainerRef?.current || chartRef.current;
    if (!captureTarget) return;
    
    try {
      const blob = await captureElement(captureTarget);
      const filename = `irys-dune-chart-${Date.now()}.png`;
      downloadImage(blob, filename);
    } catch (error) {
      console.error('Error downloading chart:', error);
      alert('Error occurred while downloading chart.');
    }
  };

  const getChartTypeDescription = () => {
    if (chartType === 'stacked') {
      return 'Cumulative - Shows total accumulated over time';
    } else if (isMultipleDatasets) {
      return 'Daily - Shows relative daily activity for comparison';
    } else {
      return 'Daily - Shows daily transaction counts';
    }
  };

  return (
    <div className="chart-container">
      {(!hideTypeButtons || !hideActions) && (
        <div className="chart-header">
          {!hideTypeButtons && (
            <div className="chart-types">
              {chartTypeButtons.map(type => (
                <button
                  key={type}
                  onClick={() => onTypeChange(type)}
                  className={`chart-type-button ${chartType === type ? 'active' : ''}`}
                >
                  {type === 'line' ? 'Line' : type === 'stacked' ? 'Stacked' : 'Treemap'}
                </button>
              ))}
            </div>
          )}
          {!hideActions && (
            <div className="chart-actions">
              <button 
                onClick={handleCapture} 
                className="action-button share-button"
                disabled={isCapturing}
              >
              <Share2 size={16} />
              {isCapturing ? 'Capturing...' : 'Share'}
            </button>
            <button onClick={handleDownload} className="action-button download-button">
              <Download size={16} />
              Download
            </button>
          </div>
          )}
        </div>
      )}
      
      <div ref={chartRef} className="chart-wrapper">
        <div style={{ position: 'relative', height: '250px', minHeight: '250px', maxHeight: '250px', overflow: 'hidden' }}>
          {chartType === 'treemap' ? (
            <ChartReact
              key={`treemap-${renderKey}`}
              type='treemap'
              data={data}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  title: {
                    display: !!title,
                    text: title,
                    font: {
                      family: 'Inter',
                      size: 16,
                      weight: 'bold' as const
                    },
                    color: '#1e293b',
                    padding: { bottom: 20 }
                  },
                  legend: {
                    display: false
                  },
                  tooltip: {
                    displayColors: false,
                    callbacks: {
                      title: (items: any) => {
                        const item = items[0];
                        
                        // For treemap with tree/key/groups structure
                        if (item?.raw?.name) {
                          return item.raw.name;
                        }
                        
                        // Fallback for other structures
                        if (typeof item.dataIndex === 'number' && data.labels) {
                          return data.labels[item.dataIndex] || '';
                        }
                        
                        return item?.raw?.x || item?.raw?.project || item?.dataset?.label || '';
                      },
                      label: (item: any) => {
                        // For treemap with tree/key/groups structure
                        if (item?.raw?.value !== undefined) {
                          const value = item.raw.value;
                          return `Transactions: ${value.toLocaleString()}`;
                        }
                        
                        // Try other structures
                        let value = 0;
                        if (item.raw?.v !== undefined) {
                          value = item.raw.v;
                        } else if (item.raw?.y !== undefined) {
                          value = item.raw.y;
                        } else if (item.parsed !== undefined) {
                          value = item.parsed;
                        } else if (item.formattedValue !== undefined) {
                          value = item.formattedValue;
                        } else if (typeof item.dataIndex === 'number' && data.datasets?.[0]?.tree) {
                          // Fallback to tree data
                          const treeItem = data.datasets[0].tree[item.dataIndex];
                          value = treeItem?.value || 0;
                        }
                        
                        return `Transactions: ${typeof value === 'number' ? value.toLocaleString() : value}`;
                      }
                    }
                  }
                }
              }}
            />
          ) : (
            <Line 
              key={`line-${renderKey}`}
              data={data} 
              options={options} 
            />
          )}
        </div>
      </div>
      
      <div className="chart-description">
        <span className="chart-description-badge">
          💡 {getChartTypeDescription()}
        </span>
      </div>
    </div>
  );
};

export default React.memo(Chart, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders unless data or chartType changes
  return (
    prevProps.chartType === nextProps.chartType &&
    prevProps.title === nextProps.title &&
    prevProps.shareText === nextProps.shareText &&
    prevProps.hideTypeButtons === nextProps.hideTypeButtons &&
    prevProps.hideActions === nextProps.hideActions &&
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
  );
}); 