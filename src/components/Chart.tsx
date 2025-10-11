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
import type { ChartData, ChartType, DataDisplayType, ChartShape } from '../types';
import { captureAndShare, downloadImage, captureElement } from '../utils/captureUtils';
import { getChartOptions } from '../utils/chartUtils';
import { APP_PRESETS } from '../constants/appPresets';
import { ON_CHAIN_PRESETS } from '../services/onChainService';

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
  // New props for separated controls
  dataDisplayType?: DataDisplayType;
  chartShape?: ChartShape;
  onDataDisplayTypeChange?: (type: DataDisplayType) => void;
  onChartShapeChange?: (shape: ChartShape) => void;
  hideTreemap?: boolean;
}

const Chart: React.FC<ChartProps> = ({ 
  data, 
  chartType, 
  title, 
  shareText, 
  onTypeChange, 
  hideTypeButtons = false,
  hideActions = false,
  captureContainerRef,
  dataDisplayType,
  chartShape,
  onDataDisplayTypeChange,
  onChartShapeChange,
  hideTreemap = false
}) => {
  console.log('[Chart Component] Rendering with:', {
    chartType,
    title,
    datasetCount: data.datasets?.length,
    dataDisplayType,
    chartShape
  });
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  // Create a stable key based on chart type and title
  // Avoid including data in the key as it causes unnecessary re-renders
  const chartKey = `${chartType}-${title}`;
  
  console.log('[Chart Component] Rendering with:', {
    chartType,
    title,
    chartKey,
    datasetCount: data.datasets?.length,
    firstDatasetLength: data.datasets?.[0]?.data?.length
  });

  // Store loaded images to avoid reloading
  const [loadedImages, setLoadedImages] = useState<{ [key: string]: HTMLImageElement }>({});

  // Preload images when component mounts or data changes
  useEffect(() => {
    const images: { [key: string]: HTMLImageElement } = {};
    
    data.datasets.forEach((dataset: any) => {
      const label = dataset.label || '';
      let projectName = label.replace(' (Relative)', '').replace(' (Daily)', '').replace(' (Cumulative)', '');
      
      let preset = APP_PRESETS.find(p => p.name === projectName);
      if (!preset) {
        preset = ON_CHAIN_PRESETS.find(p => p.name === projectName) as any;
      }
      
      if (preset && preset.icon) {
        const img = new Image();
        img.src = preset.icon;
        img.onload = () => {
          images[projectName] = img;
          setLoadedImages({ ...images });
        };
      }
    });
  }, [data]);

  // Custom plugin to draw logos at the end of lines
  const logoPlugin = {
    id: 'logoPlugin',
    afterDatasetsDraw: (chart: any) => {
      if (chartType !== 'line' && chartType !== 'stacked') return;
      
      const ctx = chart.ctx;
      
      chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (!meta.hidden && dataset.data && dataset.data.length > 0) {
          // Get last visible data point
          const lastIndex = dataset.data.length - 1;
          const lastPoint = meta.data[lastIndex];
          
          if (lastPoint && lastPoint.x && lastPoint.y) {
            // Extract project name from label
            const label = dataset.label || '';
            let projectName = label.replace(' (Relative)', '').replace(' (Daily)', '').replace(' (Cumulative)', '');
            
            // Find the corresponding preset
            let preset = APP_PRESETS.find(p => p.name === projectName);
            if (!preset) {
              preset = ON_CHAIN_PRESETS.find(p => p.name === projectName) as any;
            }
            
            if (preset && preset.icon && loadedImages[projectName]) {
              const img = loadedImages[projectName];
              
              // Draw logo instead of the last point
              const logoSize = 20;
              
              ctx.save();
              
              // Draw white background circle for better visibility
              ctx.beginPath();
              ctx.arc(lastPoint.x, lastPoint.y, logoSize/2 + 2, 0, 2 * Math.PI);
              ctx.fillStyle = 'white';
              ctx.fill();
              ctx.strokeStyle = dataset.borderColor || preset.color;
              ctx.lineWidth = 2;
              ctx.stroke();
              
              // Draw the logo
              ctx.beginPath();
              ctx.arc(lastPoint.x, lastPoint.y, logoSize/2, 0, 2 * Math.PI);
              ctx.clip();
              ctx.drawImage(img, lastPoint.x - logoSize/2, lastPoint.y - logoSize/2, logoSize, logoSize);
              
              ctx.restore();
            }
          }
        }
      });
    }
  };

  // Register/update the plugin
  useEffect(() => {
    // Unregister if exists
    const existingPlugin = ChartJS.registry.plugins.get('logoPlugin');
    if (existingPlugin) {
      ChartJS.unregister(existingPlugin);
    }
    // Register the new plugin
    ChartJS.register(logoPlugin);
    
    // Cleanup on unmount
    return () => {
      const plugin = ChartJS.registry.plugins.get('logoPlugin');
      if (plugin) {
        ChartJS.unregister(plugin);
      }
    };
  }, [logoPlugin, loadedImages, chartType]);

  // Check if multiple datasets for chart options
  const isMultipleDatasets = data.datasets.length > 1;
  const baseOptions = getChartOptions(isMultipleDatasets, chartType);
  const options = {
    ...baseOptions,
    animation: {
      duration: isCapturing ? 0 : 1000,
      easing: 'easeInOutQuart' as const
    },
    plugins: {
      ...baseOptions.plugins,
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
        ...baseOptions.plugins.legend,
        display: data.datasets.length > 1, // Show legend when there are multiple datasets
        position: 'bottom' as const,
        align: 'center' as const,
        labels: {
          usePointStyle: true,
          pointStyle: chartType === 'stacked' ? 'rect' : 'circle',
          padding: 15,
          font: {
            size: 11,
            family: 'Inter'
          },
          generateLabels: (chart: any) => {
            const datasets = chart.data.datasets;
            return datasets.map((dataset: any, i: number) => {
              // For stacked charts, use borderColor (which is opaque) instead of backgroundColor (which may have transparency)
              const color = chartType === 'stacked' ? dataset.borderColor : (dataset.backgroundColor || dataset.borderColor);
              return {
                text: dataset.label?.replace(' (Cumulative)', '').replace(' (Daily)', '').replace(' (Relative)', ''),
                fillStyle: color,
                strokeStyle: dataset.borderColor,
                lineWidth: chartType === 'line' ? 2 : 0,
                hidden: !chart.isDatasetVisible(i),
                datasetIndex: i
              };
            });
          }
        }
      },
      tooltip: {
        ...baseOptions.plugins.tooltip,
        displayColors: false, // Remove color boxes
        itemSort: function(a: any, b: any) {
          // Sort by value in descending order
          return b.parsed.y - a.parsed.y;
        },
        callbacks: {
          ...baseOptions.plugins.tooltip.callbacks,
          label: function(context: any) {
            // Only show project name without color box
            const label = context.dataset.label || '';
            const cleanLabel = label.replace(' (Relative)', '').replace(' (Daily)', '').replace(' (Cumulative)', '');
            const value = context.parsed.y;
            if (value !== null) {
              return `${cleanLabel}: ${new Intl.NumberFormat('en-US').format(value)}`;
            }
            return cleanLabel;
          }
        }
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
      // Force chart to update without animation
      if (chartInstanceRef.current) {
        chartInstanceRef.current.update('none');
      }
      
      // Wait for chart to stabilize and logos to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force a chart update to ensure logos are drawn
      if (chartInstanceRef.current) {
        chartInstanceRef.current.update('none'); // Update without animation
      }
      
      // Additional wait for logos to be rendered
      await new Promise(resolve => setTimeout(resolve, 300));
      
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
      // Re-enable animations
      if (chartInstanceRef.current) {
        chartInstanceRef.current.update();
      }
    }
  };

  const handleDownload = async () => {
    // Use captureContainerRef if provided, otherwise use chartRef
    const captureTarget = captureContainerRef?.current || chartRef.current;
    if (!captureTarget) return;
    
    setIsCapturing(true);
    try {
      // Force chart to update without animation
      if (chartInstanceRef.current) {
        chartInstanceRef.current.update('none');
      }
      
      // Wait for chart to stabilize and logos to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force a chart update to ensure logos are drawn
      if (chartInstanceRef.current) {
        chartInstanceRef.current.update('none'); // Update without animation
      }
      
      // Additional wait for logos to be rendered
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const blob = await captureElement(captureTarget);
      const filename = `irys-dune-chart-${Date.now()}.png`;
      downloadImage(blob, filename);
    } catch (error) {
      console.error('Error downloading chart:', error);
      alert('Error occurred while downloading chart.');
    } finally {
      setIsCapturing(false);
      // Re-enable animations
      if (chartInstanceRef.current) {
        chartInstanceRef.current.update();
      }
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
            <div className="chart-controls">
              {/* Chart Type Controls */}
              {dataDisplayType && onDataDisplayTypeChange && chartShape && onChartShapeChange && (
                <div className="chart-types">
                  <button
                    onClick={() => onDataDisplayTypeChange('absolute')}
                    className={`chart-type-button ${dataDisplayType === 'absolute' && chartShape !== 'treemap' ? 'active' : ''}`}
                  >
                    Absolute
                  </button>
                  <button
                    onClick={() => onDataDisplayTypeChange('cumulative')}
                    className={`chart-type-button ${dataDisplayType === 'cumulative' && chartShape !== 'treemap' ? 'active' : ''}`}
                  >
                    Cumulative
                  </button>
                  {!hideTreemap && (
                    <button
                      onClick={() => onChartShapeChange(chartShape === 'treemap' ? 'line' : 'treemap')}
                      className={`chart-type-button ${chartShape === 'treemap' ? 'active' : ''}`}
                    >
                      Treemap
                    </button>
                  )}
                </div>
              )}
              
              {/* Legacy buttons for backward compatibility */}
              {!dataDisplayType && !chartShape && (
                <div className="chart-types">
                  {chartTypeButtons.map(type => (
                    <button
                      key={type}
                      onClick={() => onTypeChange(type)}
                      className={`chart-type-button ${chartType === type ? 'active' : ''}`}
                    >
                      {type === 'line' ? 'Absolute' : type === 'stacked' ? 'Cumulative' : 'Treemap'}
                    </button>
                  ))}
                </div>
              )}
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
        <div className="chart-canvas-container">
          {chartType === 'treemap' ? (
            <ChartReact
              key={chartKey}
              ref={(ref) => {
                chartInstanceRef.current = ref;
                // Store chart instance on canvas element for capture
                if (ref && ref.canvas) {
                  (ref.canvas as any).chart = ref;
                }
              }}
              type='treemap'
              data={data}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                  duration: isCapturing ? 0 : 1000,
                  easing: 'easeInOutQuart' as const
                },
                plugins: {
                  legend: {
                    display: false
                  },
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
                  tooltip: {
                    displayColors: false,
                    callbacks: {
                      title: (items: any) => {
                        const item = items[0];
                        const dataIndex = item.dataIndex;
                        const dataset = item.dataset;
                        
                        // Access from tree array
                        if (dataset?.tree && dataset.tree[dataIndex]) {
                          return dataset.tree[dataIndex].label || '';
                        }
                        // Fallback
                        return item?.raw?.label || '';
                      },
                      label: (item: any) => {
                        const dataIndex = item.dataIndex;
                        const dataset = item.dataset;
                        
                        // Access from tree array
                        if (dataset?.tree && dataset.tree[dataIndex]) {
                          const value = dataset.tree[dataIndex].value || 0;
                          return `Count: ${value.toLocaleString()}`;
                        }
                        // Fallback
                        const value = item.raw?.value || 0;
                        return `Count: ${value.toLocaleString()}`;
                      }
                    }
                  }
                }
              } as any}
            />
          ) : (
            <Line 
              key={chartKey}
              ref={(ref) => {
                chartInstanceRef.current = ref;
                // Store chart instance on canvas element for capture
                if (ref && ref.canvas) {
                  (ref.canvas as any).chart = ref;
                }
              }}
              data={data} 
              options={options} 
              plugins={[logoPlugin]}
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

export default Chart; 