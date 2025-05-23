import type { QueryResult, ChartData, ChartType, AppPreset, CustomQuery } from '../types';
import { APP_PRESETS } from '../constants/appPresets';
import { ACTIVITY_CATEGORIES, TAG_ACTIVITY_MAPPINGS } from '../constants/tagActivityMapping';

export function formatDate(timestamp: number): string {
  // timestamp is now in milliseconds
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

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
    return 'white'; // fallback for unknown format
  }
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? 'black' : 'white';
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
      const mappedData = periodTimestamps.map((timestamp, index) => {
        // For the last timestamp, include all data up to end of day
        const effectiveTimestamp = index === periodTimestamps.length - 1 
          ? timestamp + (24 * 60 * 60 * 1000) // Add 24 hours to include full day
          : timestamp;
        
        // Calculate cumulative total for this timestamp
        let cumulativeTotal = 0;
        sortedResults.forEach(result => {
          // Only count data within the selected period and up to this timestamp
          if (result.timestamp >= periodTimestamps[0] && result.timestamp <= effectiveTimestamp) {
            cumulativeTotal += result.count;
          }
        });
        
        return {
          timestamp,
          count: cumulativeTotal
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

  // Check if we need to generate treemap data
  if (chartType === 'treemap') {
    console.log('[generateChartData] Starting DApp Growth treemap generation');
    console.log('[generateChartData] Queries:', queries.map(q => q.name));
    console.log('[generateChartData] Raw data keys:', Object.keys(data));
    console.log('[generateChartData] Timestamps count:', timestamps.length);
    
    // For treemap, use the last cumulative value from the filtered data
    // This ensures consistency with the cumulative chart
    const treeValues: number[] = [];
    const projectNames: string[] = [];
    const projectColors: string[] = [];
    let totalTransactions = 0;
    
    queries.forEach(query => {
      const queryResults = data[query.id] || [];
      console.log(`[generateChartData] ${query.name} - results length: ${queryResults.length}`);
      
      // For treemap, get the last value from the filtered cumulative data
      // The data passed here is already filtered by period and contains cumulative values
      if (queryResults.length > 0) {
        // Get the last result which contains the final cumulative value for this period
        const lastResult = queryResults[queryResults.length - 1];
        const totalCount = lastResult.count;
        
        console.log(`[generateChartData] ${query.name} - total count: ${totalCount}`);
        
        totalTransactions += totalCount;
        
        if (totalCount > 0) {
          treeValues.push(totalCount);
          projectNames.push(query.name);
          projectColors.push(query.color);
        }
      }
    });
    
    // Sort by value descending to ensure larger values appear larger
    const sortedData = treeValues.map((value, index) => ({
      name: projectNames[index],
      value: value,
      color: projectColors[index]
    })).sort((a, b) => b.value - a.value); // Sort descending by value
    
    // Debug log
    console.log('[generateChartData] Sorted data:', sortedData);
    console.log('[generateChartData] Total projects:', sortedData.length);
    console.log('[generateChartData] Max value:', sortedData[0]?.value);
    console.log('[generateChartData] Min value:', sortedData[sortedData.length - 1]?.value);
    
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
    
    console.log('[generateChartData] Top projects:', topProjects);

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
    
    // topProjects is already sorted by value in descending order
    const treemapData = topProjects.map((item, index) => {
      console.log(`[generateChartData] Treemap item ${index}:`, item);
      return {
        label: item.name,
        value: item.value,
        backgroundColor: item.color
      };
    });
    console.log('[generateChartData] Final treemapData:', treemapData);
    
    
    const result = {
      labels: [],
      datasets: [{
        label: 'Projects Activity',
        data: treemapData,
        tree: treemapData,
        key: 'value',
        groups: ['label'],
        spacing: 1,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        backgroundColor: (ctx: any) => {
          // Access data from the tree array using dataIndex
          if (ctx.type === 'data' && ctx.dataIndex !== undefined && treemapData[ctx.dataIndex]) {
            return treemapData[ctx.dataIndex].backgroundColor;
          }
          return '#0ea5e9';
        },
        labels: {
          display: true,
          overflow: true,
          position: 'top',
          align: 'center',
          formatter: (ctx: any) => {
            // Access data from the tree array using dataIndex
            if (ctx.type === 'data' && ctx.dataIndex !== undefined && treemapData[ctx.dataIndex]) {
              const item = treemapData[ctx.dataIndex];
              return [item.label, item.value.toLocaleString()];
            }
            return '';
          },
          color: (ctx: any) => {
            // Access data from the tree array using dataIndex
            if (ctx.type === 'data' && ctx.dataIndex !== undefined && treemapData[ctx.dataIndex]) {
              const bgColor = treemapData[ctx.dataIndex].backgroundColor;
              return getContrastTextColor(bgColor);
            }
            return 'white';
          },
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      }]
    } as any;
    
    console.log('[generateChartData] Final DApp treemap result:', result);
    return result;
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
      value: info.count,
      backgroundColor: info.color
    }));

    return {
      labels: [],
      datasets: [{
        label: 'Ecosystem Projects',
        data: treeMapData,
        tree: treeMapData,
        key: 'value',
        groups: ['label'],
        spacing: 1,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        backgroundColor: (ctx: any) => {
          // Access data from the tree array using dataIndex
          if (ctx.type === 'data' && ctx.dataIndex !== undefined && treeMapData[ctx.dataIndex]) {
            return treeMapData[ctx.dataIndex].backgroundColor;
          }
          return '#0ea5e9';
        },
        labels: {
          display: true,
          overflow: true,
          position: 'top',
          align: 'center',
          formatter: (ctx: any) => {
            // Access data from the tree array using dataIndex
            if (ctx.type === 'data' && ctx.dataIndex !== undefined && treeMapData[ctx.dataIndex]) {
              const item = treeMapData[ctx.dataIndex];
              return [item.label, item.value.toLocaleString()];
            }
            return '';
          },
          color: 'white',
          font: {
            size: 14,
            weight: 'bold'
          }
        }
      }]
    } as any;
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
  
  // Treemap chart has different options
  if (chartType === 'treemap') {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: function(context: any) {
              const item = context[0];
              return item?.raw?.label || '';
            },
            label: function(context: any) {
              const value = context.raw?.value || 0;
              return `Count: ${value.toLocaleString()}`;
            }
          }
        }
      }
    };
  }
  
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
          stacked: false, // Don't stack Y axis - show actual cumulative values
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

export function generateCategoryGrowthData(
  data: { [key: string]: QueryResult[] },
  chartType: ChartType = 'stacked'
): ChartData {
  
  // Get all unique timestamps
  const allTimestamps = new Set<number>();
  Object.values(data).forEach(results => {
    results.forEach(result => allTimestamps.add(result.timestamp));
  });
  
  const timestamps = Array.from(allTimestamps).sort((a, b) => a - b);
  
  if (timestamps.length === 0) {
    const now = Date.now();
    const emptyTimestamps = [now - 24 * 60 * 60 * 1000, now];
    return { labels: emptyTimestamps.map(formatDate), datasets: [] };
  }
  
  const labels = timestamps.map(formatDate);
  
  // Check if we need to generate treemap data
  if (chartType === 'treemap') {
    console.log('[generateCategoryGrowthData] Starting treemap generation');
    console.log('[generateCategoryGrowthData] Input data:', Object.keys(data));
    console.log('[generateCategoryGrowthData] ChartType:', chartType);
    console.log('[generateCategoryGrowthData] Raw data sample:', Object.entries(data).slice(0, 2));
    
    // For category treemap, group by category
    const categoryTotals: { [key: string]: { count: number, color: string, name: string } } = {};
    
    Object.entries(data).forEach(([projectId, results]) => {
      // Find the category for this project
      const mapping = TAG_ACTIVITY_MAPPINGS.find((m: any) => m.projectId === projectId);
      const categoryId = mapping ? mapping.activityId : 'other';
      const category = ACTIVITY_CATEGORIES[categoryId];
      
      console.log(`[generateCategoryGrowthData] Project: ${projectId}, Category: ${categoryId}, Results length: ${results.length}`);
      
      if (category) {
        // For treemap, we want the final cumulative value (last data point)
        // since the data is already filtered and processed as cumulative
        let totalCount = 0;
        if (results.length > 0) {
          // Get the last (most recent) value which is the cumulative total
          totalCount = results[results.length - 1].count;
        }
        
        console.log(`[generateCategoryGrowthData] ${projectId} total count: ${totalCount}`);
        
        if (!categoryTotals[categoryId]) {
          categoryTotals[categoryId] = {
            count: 0,
            color: category.color,
            name: category.name
          };
        }
        categoryTotals[categoryId].count += totalCount;
      }
    });
    
    console.log('[generateCategoryGrowthData] Category totals:', categoryTotals);
    
    // Sort by value in descending order for better treemap layout
    const treeMapData = Object.entries(categoryTotals)
      .filter(([_, info]) => info.count > 0)
      .sort((a, b) => b[1].count - a[1].count) // Sort by count descending
      .map(([categoryId, info], index) => {
        console.log(`[generateCategoryGrowthData] Category ${index}:`, categoryId, info);
        return {
          label: info.name,
          value: info.count,
          backgroundColor: info.color
        };
      });
    console.log('[generateCategoryGrowthData] Final treeMapData:', treeMapData);


    const result = {
      labels: [],
      datasets: [{
        label: 'Categories',
        data: treeMapData,
        tree: treeMapData,
        key: 'value',
        groups: ['label'],
        spacing: 1,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        backgroundColor: (ctx: any) => {
          // Access data from the tree array using dataIndex
          if (ctx.type === 'data' && ctx.dataIndex !== undefined && treeMapData[ctx.dataIndex]) {
            return treeMapData[ctx.dataIndex].backgroundColor;
          }
          return '#0ea5e9';
        },
        labels: {
          display: true,
          overflow: true,
          position: 'top',
          align: 'center',
          formatter: (ctx: any) => {
            // Access data from the tree array using dataIndex
            if (ctx.type === 'data' && ctx.dataIndex !== undefined && treeMapData[ctx.dataIndex]) {
              const item = treeMapData[ctx.dataIndex];
              return [item.label, item.value.toLocaleString()];
            }
            return '';
          },
          color: (ctx: any) => {
            // Access data from the tree array using dataIndex
            if (ctx.type === 'data' && ctx.dataIndex !== undefined && treeMapData[ctx.dataIndex]) {
              const bgColor = treeMapData[ctx.dataIndex].backgroundColor;
              return getContrastTextColor(bgColor);
            }
            return 'white';
          },
          font: {
            size: 14,
            weight: 'bold'
          }
        }
      }]
    } as any;
    
    console.log('[generateCategoryGrowthData] Final result:', result);
    return result;
  }
  
  // Initialize category data structure
  const categoryData: { [categoryId: string]: { [timestamp: number]: number } } = {};
  
  // Process each project's data
  Object.entries(data).forEach(([projectId, results]) => {
    // Find the category for this project
    const mapping = TAG_ACTIVITY_MAPPINGS.find((m: any) => m.projectId === projectId);
    const categoryId = mapping ? mapping.activityId : 'other';
    
    // Skip projects without proper mapping
    if (!mapping && projectId !== 'other') {
      return;
    }
    
    if (!categoryData[categoryId]) {
      categoryData[categoryId] = {};
      timestamps.forEach(ts => {
        categoryData[categoryId][ts] = 0;
      });
    }
    
    // For cumulative (stacked) chart, we need to add the cumulative values directly
    // For line chart, we need the individual counts
    results.forEach(result => {
      if (categoryData[categoryId][result.timestamp] !== undefined) {
        categoryData[categoryId][result.timestamp] += result.count;
      }
    });
  });
  
  // Create datasets for each category
  const datasets = Object.entries(ACTIVITY_CATEGORIES)
    .filter(([categoryId]) => categoryData[categoryId]) // Only include categories with data
    .map(([categoryId, category]) => {
      const data = timestamps.map(timestamp => categoryData[categoryId][timestamp] || 0);
      
      if (chartType === 'stacked') {
        // For stacked chart, the data is already cumulative from each project
        // Just use it directly - this creates a stacked area chart with absolute values
        return {
          label: category.name,
          data: data,
          backgroundColor: category.color + '80', // Add transparency
          borderColor: category.color,
          borderWidth: 2,
          fill: true,
          yAxisID: 'cumulative'
        };
      } else {
        // Line chart (absolute values)
        return {
          label: category.name,
          data: data,
          backgroundColor: 'transparent',
          borderColor: category.color,
          borderWidth: 3,
          fill: false,
          tension: 0.1,
          yAxisID: 'absolute'
        };
      }
    });
  
  return { labels, datasets };
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