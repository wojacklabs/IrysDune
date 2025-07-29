import React, { useState, useEffect } from 'react';
import type { Dashboard, Tag, ChartType, ChartConfig, QueryResult } from '../types';
import { APP_PRESETS } from '../constants/appPresets';
import { uploadDashboard } from '../services/irysUploadService';
import { queryTagCounts } from '../services/irysService';
import { generateChartData } from '../utils/chartUtils';
import { getCachedData, waitForCache } from '../services/storageService';
import Chart from './Chart';
import LoadingProgress from './LoadingProgress';

interface CreateDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (dashboard: Dashboard) => void;
  authorAddress: string;
  authorName?: string;
  existingDashboard?: Dashboard;
  trendData?: { [key: string]: QueryResult[] };
}

export const CreateDashboardModal: React.FC<CreateDashboardModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  authorAddress,
  authorName,
  existingDashboard,
  trendData
}) => {
  const [name, setName] = useState(existingDashboard?.name || '');
  const [description, setDescription] = useState(existingDashboard?.description || '');
  const [charts, setCharts] = useState<ChartConfig[]>(existingDashboard?.charts || []);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [loadingChartId, setLoadingChartId] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ [chartId: string]: any }>({});
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number; percentage: number } | null>(null);

  // Current chart being edited
  const [editingChart, setEditingChart] = useState<ChartConfig | null>(null);
  const [chartTitle, setChartTitle] = useState('');
  const [chartDescription, setChartDescription] = useState('');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [customTags, setCustomTags] = useState<Tag[]>([]);
  const [selectedQueries, setSelectedQueries] = useState<Array<{
    id: string;
    name: string;
    tags: Tag[];
    color: string;
    isGroup?: boolean;
    groupName?: string;
  }>>([]);

  // State for custom tag input
  const [newTagName, setNewTagName] = useState('');
  const [newTagValue, setNewTagValue] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  
  // State for custom tag groups
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupTags, setGroupTags] = useState<Tag[]>([]);
  const [currentGroupTag, setCurrentGroupTag] = useState({ name: '', value: '' });
  
  // Chart preview state
  const [showPreview, setShowPreview] = useState<{ [chartId: string]: boolean }>({});

  useEffect(() => {
    if (existingDashboard) {
      setName(existingDashboard.name);
      setDescription(existingDashboard.description);
      setCharts(existingDashboard.charts);
    }
  }, [existingDashboard]);

  if (!isOpen) return null;

  const addCustomTag = () => {
    if (!newTagName.trim() || !newTagValue.trim()) {
      return;
    }
    
    const newTag = { name: newTagName.trim(), value: newTagValue.trim() };
    setCustomTags([...customTags, newTag]);
    
    // Add as a query immediately
    const queryName = `${newTag.name}: ${newTag.value}`;
    const newQuery = {
      id: `custom-${Date.now()}`,
      name: queryName,
      tags: [newTag],
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
    };
    setSelectedQueries([...selectedQueries, newQuery]);
    
    setNewTagName('');
    setNewTagValue('');
    setShowTagInput(false);
  };

  const removeCustomTag = (index: number) => {
    const tagToRemove = customTags[index];
    setCustomTags(customTags.filter((_, i) => i !== index));
    // Also remove from selected queries
    setSelectedQueries(selectedQueries.filter(q => 
      !q.tags.some(t => t.name === tagToRemove.name && t.value === tagToRemove.value)
    ));
  };

  const addTagToGroup = () => {
    if (!currentGroupTag.name.trim() || !currentGroupTag.value.trim()) {
      return;
    }
    
    setGroupTags([...groupTags, { 
      name: currentGroupTag.name.trim(), 
      value: currentGroupTag.value.trim() 
    }]);
    setCurrentGroupTag({ name: '', value: '' });
  };

  const removeTagFromGroup = (index: number) => {
    setGroupTags(groupTags.filter((_, i) => i !== index));
  };

  const createTagGroup = () => {
    if (!groupName.trim() || groupTags.length === 0) {
      return;
    }
    
    // Create a group query with all tags
    const newQuery = {
      id: `group-${Date.now()}`,
      name: groupName.trim(),
      tags: [...groupTags],
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      isGroup: true,
      groupName: groupName.trim()
    };
    
    setSelectedQueries([...selectedQueries, newQuery]);
    setCustomTags([...customTags, ...groupTags]);
    
    // Reset group input
    setGroupName('');
    setGroupTags([]);
    setShowGroupInput(false);
  };

  const togglePreset = (presetId: string) => {
    const preset = APP_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    const existingQuery = selectedQueries.find(q => q.id === presetId);
    if (existingQuery) {
      setSelectedQueries(selectedQueries.filter(q => q.id !== presetId));
    } else {
      const newQuery = {
        id: presetId,
        name: preset.name,
        tags: preset.tags,
        color: preset.color
      };
      setSelectedQueries([...selectedQueries, newQuery]);
    }
  };

  const removeQuery = (queryId: string) => {
    setSelectedQueries(selectedQueries.filter(q => q.id !== queryId));
    // If it's a custom query, also remove from customTags
    if (queryId.startsWith('custom-')) {
      const query = selectedQueries.find(q => q.id === queryId);
      if (query && query.tags.length === 1) {
        const tag = query.tags[0];
        setCustomTags(customTags.filter(t => t.name !== tag.name || t.value !== tag.value));
      }
    }
  };

  const addChart = () => {
    if (!chartTitle.trim()) {
      alert('Please enter a chart title');
      return;
    }

    if (selectedQueries.length === 0) {
      alert('Please select at least one data source');
      return;
    }

    const newChart: ChartConfig = {
      id: `chart-${Date.now()}`,
      name: chartTitle.trim(), // for compatibility
      title: chartTitle.trim(),
      description: chartDescription.trim(),
      queries: selectedQueries,
      chartType,
      timePeriod,
      color: '#3b82f6', // default color for compatibility
      tags: [] // legacy support
    };

    if (editingChart) {
      setCharts(charts.map(c => c.id === editingChart.id ? newChart : c));
      setEditingChart(null);
    } else {
      setCharts([...charts, newChart]);
    }

    // Reset chart form
    setChartTitle('');
    setChartDescription('');
    setChartType('line');
    setTimePeriod('month');
    setCustomTags([]);
    setSelectedQueries([]);
  };

  const editChart = (chart: ChartConfig) => {
    setEditingChart(chart);
    setChartTitle(chart.title);
    setChartDescription(chart.description || '');
    setChartType(chart.chartType);
    setTimePeriod(chart.timePeriod);
    setSelectedQueries(chart.queries || []);
    
    // Reconstruct custom tags from queries
    const customFromQueries = chart.queries?.filter(q => q.id.startsWith('custom-')) || [];
    const tags: Tag[] = [];
    customFromQueries.forEach(q => tags.push(...q.tags));
    setCustomTags(tags);
  };

  const removeChart = (chartId: string) => {
    setCharts(charts.filter(c => c.id !== chartId));
    const newChartData = { ...chartData };
    delete newChartData[chartId];
    setChartData(newChartData);
  };

  const togglePreview = (chartId: string) => {
    setShowPreview(prev => ({
      ...prev,
      [chartId]: !prev[chartId]
    }));
    
    // Load data if not already loaded
    if (!chartData[chartId] && !showPreview[chartId]) {
      const chart = charts.find(c => c.id === chartId);
      if (chart) {
        loadChartData(chart);
      }
    }
  };

  const loadChartData = async (chart: ChartConfig) => {
    setLoadingChartId(chart.id);
    setLoadingProgress({ current: 0, total: 1, percentage: 0 });
    
    try {
      // First try to get cached data or wait for it if being loaded
      let cachedData = getCachedData();
      if (!cachedData && !trendData) {
        console.log('[CreateDashboard] No cached data available, waiting for cache...');
        cachedData = await waitForCache(5000); // Wait up to 5 seconds
      }
      
      // Use either cached data or trendData
      const availableData = cachedData || trendData || {};
      
      const allData: { [queryId: string]: QueryResult[] } = {};
      const queries = chart.queries || [];
      
      // If no queries, try legacy tags
      if (queries.length === 0 && chart.tags && chart.tags.length > 0) {
        const monthsMap = {
          'week': 0.25,
          'month': 1,
          'quarter': 3,
          'year': 12
        };
        const months = monthsMap[chart.timePeriod] || 6;
        
        const data = await queryTagCounts(chart.tags, (progress) => {
          setLoadingProgress(progress);
        }, { months });
        allData[chart.id] = data;
      } else {
        // Load data for each query
        for (let i = 0; i < queries.length; i++) {
          const query = queries[i];
          
          // Check if data exists in availableData first
          if (availableData[query.id]) {
            console.log(`[CreateDashboard] Using cached data for ${query.name}`);
            allData[query.id] = availableData[query.id];
            
            // Update progress
            const progress = {
              current: i + 1,
              total: queries.length,
              percentage: Math.round(((i + 1) / queries.length) * 100)
            };
            setLoadingProgress(progress);
          } else {
            // Query new data if not in trendData
            const progress = {
              current: i,
              total: queries.length,
              percentage: Math.round((i / queries.length) * 100)
            };
            setLoadingProgress(progress);
            
            // Get date range from chart time period
            const monthsMap = {
              'week': 0.25,
              'month': 1,
              'quarter': 3,
              'year': 12
            };
            const months = monthsMap[chart.timePeriod] || 6;
            
            const data = await queryTagCounts(query.tags, (subProgress) => {
              const overallProgress = {
                current: i + (subProgress.percentage / 100),
                total: queries.length,
                percentage: Math.round(((i + (subProgress.percentage / 100)) / queries.length) * 100)
              };
              setLoadingProgress(overallProgress);
            }, { months });
            
            allData[query.id] = data;
          }
        }
      }
      
      setChartData(prev => ({ ...prev, [chart.id]: allData }));
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoadingChartId(null);
      setLoadingProgress(null);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Dashboard name is required');
      return;
    }

    if (charts.length === 0) {
      setError('Please add at least one chart');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const dashboard: Dashboard = {
        id: existingDashboard?.id || `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        author: authorName || authorAddress, // Use authorName if available
        authorAddress,
        charts,
        createdAt: existingDashboard?.createdAt || Date.now(),
        updatedAt: Date.now(),
        views: existingDashboard?.views || 0,
        likes: existingDashboard?.likes || 0,
        rootTxId: existingDashboard?.rootTxId
      };

      console.log('[CreateDashboard] Uploading dashboard to Irys...');
      const result = await uploadDashboard(dashboard);

      if (result.success && result.transactionId) {
        console.log('[CreateDashboard] Dashboard uploaded successfully:', result.transactionId);
        dashboard.transactionId = result.transactionId;
        dashboard.mutableAddress = result.mutableAddress;
        dashboard.rootTxId = result.rootTxId;
        
        // Show success message
        alert(`Dashboard successfully ${existingDashboard ? 'updated' : 'created'} and uploaded to Irys!\nTransaction ID: ${result.transactionId}\nMutable Address: ${result.mutableAddress || 'N/A'}\n\nIt will appear in the dashboard list shortly.`);
        
        onSuccess(dashboard);
        onClose();
        
        // Reset form
        setName('');
        setDescription('');
        setCharts([]);
        setChartData({});
      } else {
        console.error('[CreateDashboard] Upload failed:', result.error);
        setError(result.error || 'Failed to create dashboard');
      }
    } catch (err) {
      console.error('[CreateDashboard] Error creating dashboard:', err);
      if (err instanceof Error && err.message.includes('Ethereum provider')) {
        setError('Wallet connection error. Please make sure your wallet is connected and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred while creating the dashboard');
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{existingDashboard ? 'Edit Dashboard' : 'Create New Dashboard'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {error && (
            <div className="error-message">{error}</div>
          )}
          
          <div className="dashboard-info-section">
            <h3>Dashboard Information</h3>
            <div className="form-group">
              <label>Dashboard Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Analytics Dashboard"
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this dashboard tracks..."
                rows={3}
                maxLength={500}
              />
            </div>
          </div>

          <div className="charts-section">
            <h3>Charts</h3>
            
            {/* Chart editor */}
            <div className="chart-editor">
              <h4>{editingChart ? 'Edit Chart' : 'Add New Chart'}</h4>
              
              <div className="form-group">
                <label>Chart Title *</label>
                <input
                  type="text"
                  value={chartTitle}
                  onChange={(e) => setChartTitle(e.target.value)}
                  placeholder="Transaction Activity"
                />
              </div>

              <div className="form-group">
                <label>Chart Description</label>
                <textarea
                  value={chartDescription}
                  onChange={(e) => setChartDescription(e.target.value)}
                  placeholder="Describe what this chart shows..."
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label>Select Data Sources</label>
                <div className="data-sources-grid">
                  {APP_PRESETS.map(preset => (
                    <div 
                      key={preset.id} 
                      className={`data-source-card ${selectedQueries.some(q => q.id === preset.id) ? 'selected' : ''}`}
                      onClick={() => togglePreset(preset.id)}
                    >
                      {preset.icon && (
                        <img src={preset.icon} alt={preset.name} className="source-icon" />
                      )}
                      <div className="source-name">{preset.name}</div>
                      <div className="source-check">
                        {selectedQueries.some(q => q.id === preset.id) && '✓'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedQueries.length > 0 && (
                <div className="form-group">
                  <label>Selected Data Sources</label>
                  <div className="selected-queries">
                    {selectedQueries.map(query => (
                      <div key={query.id} className={`query-chip ${query.isGroup ? 'group-chip' : ''}`}>
                        <span>
                          {query.isGroup && '📦 '}
                          {query.name}
                          {query.isGroup && ` (${query.tags.length} tags)`}
                        </span>
                        <button onClick={() => removeQuery(query.id)}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(true) && (
                <div className="form-group">
                  <label>Custom Tags</label>
                  <div className="custom-tags">
                    {customTags.map((tag, index) => (
                      <div key={index} className="tag-item">
                        <span>{tag.name}: {tag.value}</span>
                        <button onClick={() => removeCustomTag(index)}>×</button>
                      </div>
                    ))}
                    {showTagInput ? (
                      <div className="tag-input-form">
                        <input
                          type="text"
                          placeholder="Tag name"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && newTagValue && addCustomTag()}
                        />
                        <input
                          type="text"
                          placeholder="Tag value"
                          value={newTagValue}
                          onChange={(e) => setNewTagValue(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && newTagName && addCustomTag()}
                        />
                        <button 
                          className="confirm-tag-btn" 
                          onClick={addCustomTag}
                          disabled={!newTagName.trim() || !newTagValue.trim()}
                        >
                          ✓
                        </button>
                        <button 
                          className="cancel-tag-btn" 
                          onClick={() => {
                            setShowTagInput(false);
                            setNewTagName('');
                            setNewTagValue('');
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="tag-buttons">
                        <button className="add-tag-btn" onClick={() => setShowTagInput(true)}>
                          + Add Tag
                        </button>
                        <button className="add-tag-btn" onClick={() => setShowGroupInput(true)}>
                          + Add Tag Group
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {showGroupInput && (
                <div className="form-group">
                  <label>Create Tag Group</label>
                  <div className="tag-group-editor">
                    <input
                      type="text"
                      placeholder="Group name"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="group-name-input"
                    />
                    
                    <div className="group-tags-section">
                      <h5>Tags in this group:</h5>
                      {groupTags.map((tag, index) => (
                        <div key={index} className="tag-item">
                          <span>{tag.name}: {tag.value}</span>
                          <button onClick={() => removeTagFromGroup(index)}>×</button>
                        </div>
                      ))}
                      
                      <div className="tag-input-form">
                        <input
                          type="text"
                          placeholder="Tag name"
                          value={currentGroupTag.name}
                          onChange={(e) => setCurrentGroupTag({ ...currentGroupTag, name: e.target.value })}
                        />
                        <input
                          type="text"
                          placeholder="Tag value"
                          value={currentGroupTag.value}
                          onChange={(e) => setCurrentGroupTag({ ...currentGroupTag, value: e.target.value })}
                        />
                        <button 
                          className="confirm-tag-btn" 
                          onClick={addTagToGroup}
                          disabled={!currentGroupTag.name.trim() || !currentGroupTag.value.trim()}
                        >
                          Add to Group
                        </button>
                      </div>
                    </div>
                    
                    <div className="group-actions">
                      <button 
                        className="create-group-btn"
                        onClick={createTagGroup}
                        disabled={!groupName.trim() || groupTags.length === 0}
                      >
                        Create Group
                      </button>
                      <button 
                        className="cancel-group-btn"
                        onClick={() => {
                          setShowGroupInput(false);
                          setGroupName('');
                          setGroupTags([]);
                          setCurrentGroupTag({ name: '', value: '' });
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Chart Type</label>
                  <select 
                    value={chartType} 
                    onChange={(e) => setChartType(e.target.value as ChartType)}
                  >
                    <option value="line">Line Chart</option>
                    <option value="stacked">Stacked Chart</option>
                    <option value="treemap">Treemap</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Time Period</label>
                  <select 
                    value={timePeriod} 
                    onChange={(e) => setTimePeriod(e.target.value as any)}
                  >
                    <option value="week">Last Week</option>
                    <option value="month">Last Month</option>
                    <option value="quarter">Last Quarter</option>
                    <option value="year">Last Year</option>
                  </select>
                </div>
              </div>

              <button 
                className="add-chart-btn" 
                onClick={addChart}
              >
                {editingChart ? 'Update Chart' : 'Add Chart'}
              </button>
              {editingChart && (
                <button 
                  className="cancel-edit-btn" 
                                     onClick={() => {
                     setEditingChart(null);
                     setChartTitle('');
                     setChartDescription('');
                     setChartType('line');
                     setTimePeriod('month');
                     setCustomTags([]);
                     setSelectedQueries([]);
                   }}
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {/* Chart list */}
            <div className="charts-section">
              <h3>Dashboard Charts ({charts.length})</h3>
              {charts.length === 0 ? (
                <div className="empty-state">
                  <p>No charts added yet</p>
                  <p className="empty-hint">Add a chart above to get started</p>
                </div>
              ) : (
                <div className="charts-list">
                  {charts.map((chart, index) => (
                    <div key={chart.id} className="chart-card">
                      <div className="chart-card-header">
                        <div className="chart-number">{index + 1}</div>
                        <div className="chart-info">
                          <h4>{chart.title}</h4>
                          {chart.description && <p className="chart-description">{chart.description}</p>}
                          <div className="chart-meta">
                            <span className="chart-type">{chart.chartType}</span>
                            <span className="chart-period">{chart.timePeriod}</span>
                            <span className="chart-sources">{chart.queries?.length || 0} sources</span>
                          </div>
                        </div>
                        <div className="chart-actions">
                          <button 
                            className={`preview-btn ${showPreview[chart.id] ? 'active' : ''}`}
                            onClick={() => togglePreview(chart.id)}
                          >
                            {loadingChartId === chart.id ? 'Loading...' : (showPreview[chart.id] ? 'Hide' : 'Preview')}
                          </button>
                          <button className="edit-btn" onClick={() => editChart(chart)}>Edit</button>
                          <button className="remove-btn" onClick={() => removeChart(chart.id)}>Remove</button>
                        </div>
                      </div>
                      
                      {/* Inline preview */}
                      {showPreview[chart.id] && (
                        <div className="chart-preview-inline">
                          {loadingChartId === chart.id && loadingProgress ? (
                            <LoadingProgress progress={loadingProgress} />
                          ) : chartData[chart.id] ? (
                            <Chart 
                              data={generateChartData(
                                typeof chartData[chart.id] === 'object' && !Array.isArray(chartData[chart.id]) 
                                  ? chartData[chart.id] 
                                  : { [chart.id]: chartData[chart.id] },
                                chart.queries || [{ id: chart.id, name: chart.name, tags: chart.tags || [], color: chart.color }],
                                chart.chartType
                              )}
                              chartType={chart.chartType}
                              title=""
                              shareText=""
                              onTypeChange={() => {}}
                            />
                          ) : (
                            <div className="no-data">Click preview to load chart data</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>


          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="cancel-btn" 
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button 
            className="create-btn" 
            onClick={handleCreate}
            disabled={isCreating || charts.length === 0}
          >
            {isCreating ? 'Uploading...' : existingDashboard ? 'Update Dashboard' : 'Create Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}; 