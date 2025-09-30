import type { QueryResult, ChartData, ChartType, AppPreset, CustomQuery } from '../types';
import { APP_PRESETS } from '../constants/appPresets';

export function formatDate(timestamp: number): string {
  // timestamp is now in milliseconds
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

// Generate default data points for a given period
function generateDefaultDataPoints(period: '7d' | '30d' | '3M' | '6M'): number[] {
  const now = Date.now();
  const timestamps: number[] = [];
  
  switch (period) {
    case '7d':
      // Last 7 days, daily points at noon
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now - (i * 24 * 60 * 60 * 1000));
        date.setHours(12, 0, 0, 0);
        timestamps.push(date.getTime());
      }
      break;
    case '30d':
      // Last 30 days, every 2 days at noon
      for (let i = 28; i >= 0; i -= 2) {
        const date = new Date(now - (i * 24 * 60 * 60 * 1000));
        date.setHours(12, 0, 0, 0);
        timestamps.push(date.getTime());
      }
      break;
    case '3M':
      // Last 3 months, weekly points (every Monday at noon)
      for (let i = 12; i >= 0; i--) {
        const date = new Date(now - (i * 7 * 24 * 60 * 60 * 1000));
        // Set to Monday of that week
        const dayOfWeek = date.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        date.setDate(date.getDate() - daysToMonday);
        date.setHours(12, 0, 0, 0);
        timestamps.push(date.getTime());
      }
      break;
    case '6M':
      // Last 6 months, weekly points (every Monday at noon)
      for (let i = 25; i >= 0; i--) {
        const date = new Date(now - (i * 7 * 24 * 60 * 60 * 1000));
        // Set to Monday of that week
        const dayOfWeek = date.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        date.setDate(date.getDate() - daysToMonday);
        date.setHours(12, 0, 0, 0);
        timestamps.push(date.getTime());
      }
      break;
  }
  
  // Remove duplicates and sort
  const uniqueTimestamps = [...new Set(timestamps)].sort((a, b) => a - b);
  return uniqueTimestamps;
}

// Generate data points for a specific date range
function generateDefaultDataPointsForRange(startDate: number, endDate: number, period: '7d' | '30d' | '3M' | '6M'): number[] {
  const timestamps: number[] = [];
  
  switch (period) {
    case '7d':
      // Daily points at noon
      const days = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
      for (let i = 0; i <= days; i++) {
        const date = new Date(startDate + (i * 24 * 60 * 60 * 1000));
        date.setHours(12, 0, 0, 0);
        if (date.getTime() <= endDate) {
          timestamps.push(date.getTime());
        }
      }
      break;
    case '30d':
      // Every 2 days at noon
      const thirtyDays = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
      for (let i = 0; i <= thirtyDays; i += 2) {
        const date = new Date(startDate + (i * 24 * 60 * 60 * 1000));
        date.setHours(12, 0, 0, 0);
        if (date.getTime() <= endDate) {
          timestamps.push(date.getTime());
        }
      }
      break;
    case '3M':
    case '6M':
      // Weekly points (every Monday at noon)
      const weeks = Math.ceil((endDate - startDate) / (7 * 24 * 60 * 60 * 1000));
      for (let i = 0; i <= weeks; i++) {
        const date = new Date(startDate + (i * 7 * 24 * 60 * 60 * 1000));
        // Set to Monday of that week
        const dayOfWeek = date.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        date.setDate(date.getDate() - daysToMonday);
        date.setHours(12, 0, 0, 0);
        if (date.getTime() <= endDate && date.getTime() >= startDate) {
          timestamps.push(date.getTime());
        }
      }
      break;
  }
  
  // Remove duplicates and sort
  const uniqueTimestamps = [...new Set(timestamps)].sort((a, b) => a - b);
  return uniqueTimestamps;
}

export function filterDataByPeriod(
  data: { [key: string]: QueryResult[] },
  period: '7d' | '30d' | '3M' | '6M',
  isForCumulative: boolean = false,
  absoluteDateRange?: { startDate: number; endDate: number }
): { [key: string]: QueryResult[] } {
  const now = Date.now();
  const periodMs = {
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '3M': 90 * 24 * 60 * 60 * 1000,
    '6M': 180 * 24 * 60 * 60 * 1000
  };
  
  // Use absolute date range if provided, otherwise calculate from period
  const cutoffTime = absoluteDateRange ? absoluteDateRange.startDate : now - periodMs[period];
  
  const filteredData: { [key: string]: QueryResult[] } = {};
  
  // Always generate period-specific timestamps for consistent time axis
  const periodTimestamps = absoluteDateRange 
    ? generateDefaultDataPointsForRange(absoluteDateRange.startDate, absoluteDateRange.endDate, period)
    : generateDefaultDataPoints(period);
  
  // Debug logging
  console.log(`[FilterData] Period: ${period}, isForCumulative: ${isForCumulative}`);
  console.log(`[FilterData] Generated ${periodTimestamps.length} timestamps`);
  if (absoluteDateRange) {
    console.log(`[FilterData] Using absolute date range: ${new Date(absoluteDateRange.startDate).toISOString()} to ${new Date(absoluteDateRange.endDate).toISOString()}`);
  }
  
  // Log actual timestamp range
  if (periodTimestamps.length > 0) {
    console.log(`[FilterData] Actual timestamp range: ${new Date(periodTimestamps[0]).toISOString()} to ${new Date(periodTimestamps[periodTimestamps.length - 1]).toISOString()}`);
  }
  
  Object.entries(data).forEach(([key, results]) => {
    console.log(`[FilterData] Processing ${key}: ${results.length} data points`);
    
    if (isForCumulative) {
      // For cumulative charts, accumulate all data from the first available data point
      // Sort results by timestamp first
      const sortedResults = [...results].sort((a, b) => a.timestamp - b.timestamp);
      
      // Create a map for faster lookup
      const dailyData = new Map<number, number>();
      sortedResults.forEach(result => {
        // Normalize to day start
        const dayStart = new Date(result.timestamp);
        dayStart.setHours(0, 0, 0, 0);
        const dayTimestamp = dayStart.getTime();
        
        // Accumulate counts for the same day
        const existing = dailyData.get(dayTimestamp) || 0;
        dailyData.set(dayTimestamp, existing + result.count);
      });
      
      // Generate cumulative data
      let runningTotal = 0;
      const mappedData = periodTimestamps.map((timestamp, index) => {
        // For the last timestamp, include all data up to end of day
        const effectiveTimestamp = index === periodTimestamps.length - 1 
          ? timestamp + (24 * 60 * 60 * 1000) // Add 24 hours to include full day
          : timestamp;
        
        // Calculate cumulative total within the selected period only
        runningTotal = 0;
        sortedResults.forEach(result => {
          // Only count data within the selected period
          if (result.timestamp >= periodTimestamps[0] && result.timestamp <= effectiveTimestamp) {
            runningTotal += result.count;
          }
        });
        
        return {
          timestamp,
          count: runningTotal
        };
      });
      
      // Debug: log the final counts for cumulative charts
      console.log(`[FilterData] ${key} cumulative chart data:`, {
        firstDataPoint: sortedResults[0]?.timestamp ? new Date(sortedResults[0].timestamp).toISOString() : 'none',
        lastDataPoint: sortedResults[sortedResults.length - 1]?.timestamp ? new Date(sortedResults[sortedResults.length - 1].timestamp).toISOString() : 'none',
        totalRecords: sortedResults.length,
        cumulativeValues: mappedData.map(d => ({ date: new Date(d.timestamp).toISOString().split('T')[0], count: d.count })),
        finalTotal: mappedData[mappedData.length - 1]?.count || 0
      });
      
      filteredData[key] = mappedData;
    } else {
      // For non-cumulative charts, assign each data point to its nearest timestamp
      // to avoid double-counting
      const buckets: { [timestamp: number]: number } = {};
      
      // Initialize buckets
      periodTimestamps.forEach(ts => {
        buckets[ts] = 0;
      });
      
      // Assign each data point to the nearest timestamp
      results.forEach(result => {
        // Only process data within the period
        if (result.timestamp >= cutoffTime) {
          // Find the nearest timestamp
          let nearestTimestamp = periodTimestamps[0];
          let minDistance = Math.abs(result.timestamp - nearestTimestamp);
          
          for (const ts of periodTimestamps) {
            const distance = Math.abs(result.timestamp - ts);
            if (distance < minDistance) {
              minDistance = distance;
              nearestTimestamp = ts;
            }
          }
          
          // Add to the nearest bucket
          buckets[nearestTimestamp] += result.count;
        }
      });
      
      // Convert buckets to array
      const mappedData = periodTimestamps.map(timestamp => ({
        timestamp,
        count: buckets[timestamp]
      }));
      
      // Debug: log the final counts
      if (key.includes('lofty')) {
        console.log(`[FilterData] ${key} daily values:`, mappedData.map(d => d.count));
        const total = mappedData.reduce((sum, d) => sum + d.count, 0);
        console.log(`[FilterData] ${key} total in period: ${total}`);
      }
      
      filteredData[key] = mappedData;
    }
  });
  
  // If no projects exist in data, create empty datasets
  if (Object.keys(data).length === 0) {
    // This shouldn't happen normally, but just in case
    filteredData['placeholder'] = periodTimestamps.map(timestamp => ({
      timestamp,
      count: 0
    }));
  }
  
  return filteredData;
}

export function generateChartData(
  data: { [key: string]: QueryResult[] | any[] },
  queries: AppPreset[] | CustomQuery[],
  chartType: ChartType = 'line',
  cumulative: boolean = false,
  isOnChainData: boolean = false,
  displayMode?: 'combined' | 'separated'
): ChartData {
  // Validate inputs
  if (!queries || queries.length === 0) {
    console.warn('[GenerateChartData] No queries provided, returning empty chart data');
    return {
      labels: [],
      datasets: [{
        label: 'No Data',
        data: [],
        backgroundColor: 'transparent',
        borderColor: '#94a3b8',
        borderWidth: 2
      }]
    };
  }
  // 온체인 데이터 처리
  if (isOnChainData && data) {
    const results = Object.values(data)[0] as any[];
    
    if (!results || results.length === 0) {
      return {
        labels: [],
        datasets: [{
          label: 'No Data',
          data: [],
          backgroundColor: 'transparent',
          borderColor: '#e2e8f0',
          borderWidth: 2,
          fill: false
        }]
      };
    }

    // 날짜별 데이터 그룹화
    const dateMap: { [date: string]: { [functionName: string]: number } } = {};
    const functionNames = new Set<string>();
    
    results.forEach(result => {
      const date = result.date;
      const functionName = result.functionName || 'Total Transactions';
      
      if (!dateMap[date]) {
        dateMap[date] = {};
      }
      
      dateMap[date][functionName] = (dateMap[date][functionName] || 0) + result.count;
      functionNames.add(functionName);
    });
    
    const labels = Object.keys(dateMap).sort();
    
    if (displayMode === 'combined' || functionNames.size === 1) {
      // 합쳐서 표시
      const combinedData = labels.map(date => {
        return Object.values(dateMap[date]).reduce((sum, count) => sum + count, 0);
      });
      
      return {
        labels,
        datasets: [{
          label: 'Total Activity',
          data: cumulative ? combinedData.reduce((acc: number[], val, idx) => {
            acc.push((acc[idx - 1] || 0) + val);
            return acc;
          }, []) : combinedData,
          backgroundColor: 'transparent',
          borderColor: '#3b82f6',
          borderWidth: 2,
          fill: false,
          tension: 0.1
        }]
      };
    } else {
      // 함수별로 분리해서 표시
      const datasets = Array.from(functionNames).map((functionName, index) => {
        const functionData = labels.map(date => dateMap[date][functionName] || 0);
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        const color = colors[index % colors.length];
        
        return {
          label: functionName,
          data: cumulative ? functionData.reduce((acc: number[], val, idx) => {
            acc.push((acc[idx - 1] || 0) + val);
            return acc;
          }, []) : functionData,
          backgroundColor: 'transparent',
          borderColor: color,
          borderWidth: 2,
          fill: false,
          tension: 0.1
        };
      });
      
      return { labels, datasets };
    }
  }
  
  // 기존 스토리지 쿼리 로직
  // Get all unique timestamps and sort them
  const allTimestamps = new Set<number>();
  Object.values(data).forEach(results => {
    (results as QueryResult[]).forEach(result => allTimestamps.add(result.timestamp));
  });
  
  const timestamps = Array.from(allTimestamps).sort((a, b) => a - b);
  
  // If no timestamps, create a minimal dataset to show empty chart
  if (timestamps.length === 0) {
    const now = Date.now();
    const emptyTimestamps = [now - 24 * 60 * 60 * 1000, now]; // Yesterday and today
    const emptyLabels = emptyTimestamps.map(formatDate);
    
    const emptyDatasets = queries.map(preset => ({
      label: preset.name,
      data: [0, 0],
      backgroundColor: 'transparent',
      borderColor: preset.color,
      borderWidth: 2,
      fill: false,
      tension: 0.1,
      yAxisID: chartType === 'stacked' ? 'cumulative' : 'absolute'
    }));
    
    return { labels: emptyLabels, datasets: emptyDatasets };
  }
  
  const labels = timestamps.map(formatDate);


  // Helper function to calculate color brightness and determine text color
  function getContrastTextColor(backgroundColor: string): string {
    // Convert hex color to RGB
    let r, g, b;
    
    if (backgroundColor.startsWith('#')) {
      const hex = backgroundColor.slice(1);
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    } else if (backgroundColor.startsWith('rgb')) {
      const matches = backgroundColor.match(/\d+/g);
      if (matches && matches.length >= 3) {
        r = parseInt(matches[0]);
        g = parseInt(matches[1]);
        b = parseInt(matches[2]);
      } else {
        return 'white'; // fallback
      }
    } else {
      // Handle named colors or fallback
      return 'white';
    }
    
    // Calculate brightness using luminance formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Return white text for dark backgrounds, black text for light backgrounds
    return brightness > 128 ? 'black' : 'white';
  }

  // Check if we need to generate treemap data
  if (chartType === 'treemap') {
    // Get all unique timestamps and sort them (same as regular charts)
    const allTimestamps = new Set<number>();
    Object.values(data).forEach(results => {
      results.forEach(result => allTimestamps.add(result.timestamp));
    });
    const timestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    
    // Generate treemap data for each project using SAME method as regular charts
    const treeValues: number[] = [];
    const projectNames: string[] = [];
    const projectColors: string[] = [];
    let totalTransactions = 0;
    
    queries.forEach(query => {
      const queryResults = data[query.id] || [];
      
      // For treemap, always use cumulative data within the selected time range
      let cumulativeCount = 0;
      timestamps.forEach(timestamp => {
        const result = queryResults.find(r => r.timestamp === timestamp);
        if (result) {
          cumulativeCount += result.count;
        }
      });
      
      const totalCount = cumulativeCount;
      totalTransactions += totalCount;
      
      if (totalCount > 0) {
        treeValues.push(totalCount);
        projectNames.push(query.name);
        projectColors.push(query.color);
      }
    });
    
    // Sort by value descending to ensure larger values appear larger
    const sortedData = treeValues.map((value, index) => ({
      name: projectNames[index],
      value: value,
      color: projectColors[index]
    })).sort((a, b) => b.value - a.value); // Sort descending by value
    
    // Debug log
    console.log('[Treemap] Generated data:', sortedData);
    console.log('[Treemap] Total projects:', sortedData.length);
    console.log('[Treemap] Max value:', sortedData[0]?.value);
    console.log('[Treemap] Min value:', sortedData[sortedData.length - 1]?.value);
    
    // Limit to top 15 projects for better visibility
    const topProjects = sortedData.slice(0, 15);
    const othersValue = sortedData.slice(15).reduce((sum, item) => sum + item.value, 0);
    
    // Add "Others" category if there are more projects
    if (othersValue > 0) {
      topProjects.push({
        name: 'Others',
        value: othersValue,
        color: '#94a3b8'
      });
    }
    
    console.log('[Treemap] Showing top projects:', topProjects);

    // If no data, return empty chart structure for normal charts
    if (topProjects.length === 0 || totalTransactions === 0) {
      const now = Date.now();
      const emptyTimestamps = [now - 24 * 60 * 60 * 1000, now];
      const emptyLabels = emptyTimestamps.map(formatDate);
      
      return {
        labels: emptyLabels,
        datasets: [{
          label: 'No Data',
          data: [0, 0],
          backgroundColor: '#e2e8f0',
          borderColor: '#cbd5e1'
        }]
      };
    }

    // Treemap structure using tree/key/groups format
    // Ensure minimum value for visibility - use 2% of max for better visibility
    const maxValue = Math.max(...topProjects.map(d => d.value));
    const minValue = maxValue * 0.02; // 2% of max value
    const adjustedData = topProjects.map(item => ({
      ...item,
      adjustedValue: Math.max(item.value, minValue)
    }));
    
    return {
      labels: [],
      datasets: [{
        label: 'Projects Activity',
        data: [], // Not used for treemap
        tree: adjustedData.map(item => item.adjustedValue), // Use adjusted values for display
        backgroundColor: (ctx: any) => {
          const index = ctx.dataIndex;
          if (typeof index === 'number' && index < topProjects.length) {
            const color = topProjects[index].color;
            return color;
          }
          return '#0ea5e9';
        },
        borderColor: 'rgba(255, 255, 255, 0.8)',
        borderWidth: 2,
        spacing: 1,
        labels: {
          display: true,
          align: 'center',
          position: 'middle',
          color: (ctx: any) => {
            const index = ctx.dataIndex;
            if (typeof index === 'number' && index < topProjects.length) {
              const backgroundColor = topProjects[index].color;
              const textColor = getContrastTextColor(backgroundColor);
              return textColor;
            }
            return 'white';
          },
          font: {
            size: (ctx: any) => {
              // Dynamic font size based on rectangle size
              const area = ctx.raw._data?.area || 0;
              const totalArea = ctx.chart.width * ctx.chart.height;
              const percentage = area / totalArea;
              
              // Minimum font size of 10, maximum of 16
              return Math.max(10, Math.min(16, Math.sqrt(percentage * 1000)));
            },
            weight: 'bold'
          },
          // Add text outline for better visibility
          backgroundColor: (ctx: any) => {
            // Add semi-transparent background behind text
            const index = ctx.dataIndex;
            if (typeof index === 'number' && index < topProjects.length) {
              const bgColor = topProjects[index].color;
              const textColor = getContrastTextColor(bgColor);
              // Return opposite color with transparency for outline effect
              return textColor === 'white' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)';
            }
            return 'rgba(0, 0, 0, 0.5)';
          },
          padding: 4,
          formatter: (ctx: any) => {
            const index = ctx.dataIndex;
            if (typeof index === 'number' && index < topProjects.length) {
              const item = topProjects[index];
              // Show actual value, not adjusted value
              return [item.name, item.value.toLocaleString()];
            }
            return '';
          }
        }
      }]
    };
  }

  // Calculate data for each preset
  const rawDatasets = queries
    .filter(preset => preset && preset.id) // Filter out undefined or invalid presets
    .map(preset => {
      const results = data[preset.id] || [];
      
      const dataPoints = timestamps.map(timestamp => {
        const result = results.find(r => r.timestamp === timestamp);
        return result ? result.count : 0;
      });
      
      return { preset, dataPoints };
    });

  if (chartType === 'stacked') {
    // Cumulative chart: values are already cumulative from filterDataByPeriod
    // No need to accumulate again
    const datasets = rawDatasets.map(({ preset, dataPoints }) => {
      // Check if this dataset has any non-zero values
      const hasData = dataPoints.some(value => value > 0);
      
      if (!hasData) {
        console.log(`[GenerateChartData] Warning: ${preset?.name || 'Unknown'} has no data for stacked chart, all values are 0`);
      }
      
              return {
          label: preset?.name || 'Unknown',
          data: dataPoints,
          backgroundColor: 'transparent',
          borderColor: preset?.color || '#94a3b8',
          borderWidth: 2,
          fill: false,
          tension: 0.1,
          yAxisID: 'cumulative',
          pointRadius: 3,
          pointHoverRadius: 6
        };
    });

    return { labels, datasets };
  } else {
    // Line chart: daily values (not cumulative)
    // Always use absolute values for all line charts
    const datasets = rawDatasets.map(({ preset, dataPoints }) => {
      return {
        label: `${preset?.name || 'Unknown'} (Daily)`,
        data: dataPoints,
        backgroundColor: 'transparent',
        borderColor: preset?.color || '#94a3b8',
        fill: false,
        tension: 0.1,
        yAxisID: 'absolute',
        pointRadius: 3,
        pointHoverRadius: 6
      };
    });

    return { labels, datasets };
  }
}

export function generateWholeEcosystemData(
  data: { [key: string]: QueryResult[] },
  chartType: ChartType = 'stacked'
): ChartData {
  // Get all unique timestamps and sort them
  const allTimestamps = new Set<number>();
  Object.values(data).forEach(results => {
    results.forEach(result => allTimestamps.add(result.timestamp));
  });
  
  const timestamps = Array.from(allTimestamps).sort((a, b) => a - b);
  
  // If no timestamps, create a minimal dataset to show empty chart
  if (timestamps.length === 0) {
    const now = Date.now();
    const emptyTimestamps = [now - 24 * 60 * 60 * 1000, now]; // Yesterday and today
    const emptyLabels = emptyTimestamps.map(formatDate);
    
    const emptyDataset = [{
      label: 'Total Ecosystem Activity',
      data: [0, 0],
      backgroundColor: 'transparent',
      borderColor: '#0ea5e9',
      borderWidth: 3,
      fill: false,
      tension: 0.1,
      yAxisID: chartType === 'stacked' ? 'cumulative' : 'absolute'
    }];
    
    return { labels: emptyLabels, datasets: emptyDataset };
  }
  
  const labels = timestamps.map(formatDate);

  // Check if we need to generate treemap data
  if (chartType === 'treemap') {
    // For ecosystem treemap, group by project
    const projectTotals: { [key: string]: { count: number, color: string } } = {};
    
    Object.entries(data).forEach(([projectId, results]) => {
      const preset = APP_PRESETS.find(p => p.id === projectId);
      const totalCount = results.reduce((sum, result) => sum + result.count, 0);
      
      if (preset && totalCount > 0) {
        projectTotals[preset.name] = {
          count: totalCount,
          color: preset.color
        };
      }
    });

    const treeMapData = Object.entries(projectTotals).map(([name, info]) => ({
      label: name,
      data: info.count,
      backgroundColor: info.color,
      key: name,
      groups: ['root'],
      value: info.count
    }));

    return {
      labels: [],
      datasets: [{
        label: 'Ecosystem Projects',
        data: treeMapData,
        backgroundColor: (ctx: any) => {
          const dataItem = ctx.raw;
          return dataItem.backgroundColor || '#0ea5e9';
        },
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderWidth: 2,
        spacing: 1,
        key: 'value',
        groups: ['groups'],
        captions: {
          align: 'center',
          display: true,
          color: 'white',
          font: {
            size: 14,
            weight: 'bold'
          },
          formatter: (ctx: any) => {
            return ctx.raw.label;
          }
        }
      }]
    };
  }

  // Sum all counts for each timestamp
  const totalCounts = timestamps.map(timestamp => {
    let total = 0;
    Object.values(data).forEach(results => {
      const result = results.find(r => r.timestamp === timestamp);
      if (result) total += result.count;
    });
    return total;
  });

  if (chartType === 'stacked') {
    // For cumulative chart, totalCounts already contains cumulative values from filterDataByPeriod
    // Just make sure we have cumulative totals
    console.log('[GenerateWholeEcosystemData] Stacked chart total counts:', {
      timestamps: timestamps.map(t => new Date(t).toISOString().split('T')[0]),
      counts: totalCounts,
      hasNonZeroValues: totalCounts.some(v => v > 0)
    });
    
    const datasets = [{
      label: 'Total Ecosystem Activity (Cumulative)',
      data: totalCounts,
      backgroundColor: 'transparent',
      borderColor: '#0ea5e9',
      borderWidth: 3,
      fill: false,
      tension: 0.1,
      yAxisID: 'cumulative',
      pointRadius: 3,
      pointHoverRadius: 6
    }];

    return { labels, datasets };
  } else {
    // Daily totals
    const datasets = [{
      label: 'Total Ecosystem Activity (Daily)',
      data: totalCounts,
      backgroundColor: 'transparent',
      borderColor: '#0ea5e9',
      borderWidth: 3,
      fill: false,
      tension: 0.1,
      yAxisID: 'absolute',
      pointRadius: 3,
      pointHoverRadius: 6
    }];

    return { labels, datasets };
  }
}

export function getChartOptions(isMultipleDatasets: boolean, chartType: ChartType) {
  const isCumulative = chartType === 'stacked';
  
  // Check if mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        display: !isMobile || isMultipleDatasets, // Hide legend on mobile for single datasets
        labels: {
          font: {
            family: 'Inter',
            size: isMobile ? 10 : 12
          },
          padding: isMobile ? 8 : 16,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: isMobile ? 8 : 12, // Reduced from 12/20 to 8/12
          boxHeight: isMobile ? 8 : 12 // Added to maintain circular shape
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1e293b',
        bodyColor: '#475569',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        cornerRadius: 8,
        padding: isMobile ? 8 : 12,
        titleFont: {
          family: 'Inter',
          size: isMobile ? 12 : 14,
          weight: 'bold' as const
        },
        bodyFont: {
          family: 'Inter',
          size: isMobile ? 11 : 12
        },
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US').format(context.parsed.y);
            }
            return label;
          }
        }
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: !isMobile, // Hide axis titles on mobile to save space
          text: 'Date',
          font: {
            family: 'Inter',
            size: 12,
            weight: 'bold' as const
          },
          color: '#64748b'
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          drawBorder: false,
          display: !isMobile // Hide grid on mobile for cleaner look
        },
        ticks: {
          font: {
            family: 'Inter',
            size: isMobile ? 9 : 10
          },
          color: '#64748b',
          maxRotation: isMobile ? 45 : 0, // Rotate labels on mobile if needed
          autoSkip: true,
          maxTicksLimit: isMobile ? 6 : 12 // Show fewer ticks on mobile
        }
      },
      ...(isCumulative ? {
        cumulative: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          title: {
            display: !isMobile,
            text: 'Cumulative Transactions',
            font: {
              family: 'Inter',
              size: isMobile ? 10 : 12,
              weight: 'bold' as const
            },
            color: '#64748b'
          },
          beginAtZero: true,
          min: 0,
          suggestedMax: 10, // Minimum suggested max for better visualization when data is zero
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
            drawBorder: false,
            display: !isMobile
          },
          ticks: {
            font: {
              family: 'Inter',
              size: isMobile ? 9 : 10
            },
            color: '#64748b',
            maxTicksLimit: isMobile ? 6 : 10,
            callback: function(value: any) {
              return new Intl.NumberFormat('en-US', {
                notation: 'compact',
                maximumFractionDigits: 1
              }).format(value);
            }
          }
        }
      } : {
        absolute: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          title: {
            display: !isMobile,
            text: 'Daily Transactions',
            font: {
              family: 'Inter',
              size: isMobile ? 10 : 12,
              weight: 'bold' as const
            },
            color: '#64748b'
          },
          beginAtZero: true,
          min: 0,
          suggestedMax: 10, // Minimum suggested max for better visualization when data is zero
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
            drawBorder: false,
            display: !isMobile
          },
          ticks: {
            font: {
              family: 'Inter',
              size: isMobile ? 9 : 10
            },
            color: '#64748b',
            maxTicksLimit: isMobile ? 6 : 10,
            callback: function(value: any) {
              return new Intl.NumberFormat('en-US', {
                notation: 'compact',
                maximumFractionDigits: 1
              }).format(value);
            }
          }
        }
      })
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
    elements: {
      line: {
        tension: 0.2,
        borderWidth: 2
      },
      point: {
        radius: 3,
        hoverRadius: 6,
        borderWidth: 2,
        hoverBorderWidth: 2,
        backgroundColor: 'white'
      },
    },
  };

  return baseOptions;
}

export function downloadChart(canvasElement: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvasElement.toDataURL();
  link.click();
}

export function generateShareText(
  presets: (AppPreset | CustomQuery)[],
  chartType: ChartType
): string {
  const appNames = presets.map(p => p.name).join(', ');
  const typeText = chartType === 'stacked' ? 'Cumulative' : 'Daily';
  
  return `Irys Ecosystem Activity Analysis\n\nApps: ${appNames}\nChart Type: ${typeText}\n\n#Irys #Web3 #Analytics #IrysDune \n made by @wojacklabs`;
}

export function calculateTotalActivity(data: { [key: string]: QueryResult[] }): number {
  let total = 0;
  Object.values(data).forEach(results => {
    results.forEach(result => {
      total += result.count;
    });
  });
  return total;
}

export function calculateGrowthRate(data: QueryResult[]): number {
  if (data.length < 2) return 0;
  
  const recent = data.slice(-7); // Last 7 days
  const previous = data.slice(-14, -7); // Previous 7 days
  
  const recentTotal = recent.reduce((sum, r) => sum + r.count, 0);
  const previousTotal = previous.reduce((sum, r) => sum + r.count, 0);
  
  if (previousTotal === 0) return recentTotal > 0 ? 100 : 0;
  
  return ((recentTotal - previousTotal) / previousTotal) * 100;
} 