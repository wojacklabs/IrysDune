import React, { useState } from 'react';
import { Plus, Minus, Play, Trash2, Save, Filter } from 'lucide-react';
import type { CustomQuery, ChartType, QueryResult, LoadingProgress as LoadingProgressType } from '../types';
import { queryTagCounts } from '../services/irysService';
import { generateChartData, generateShareText, filterDataByPeriod } from '../utils/chartUtils';
import Chart from './Chart';
import LoadingProgress from './LoadingProgress';

type TimePeriod = '7d' | '30d' | '3M' | '6M';

const QuerySection: React.FC = () => {
  const [queries, setQueries] = useState<CustomQuery[]>([]);
  const [currentQuery, setCurrentQuery] = useState<Partial<CustomQuery>>({
    name: '',
    tags: [{ name: '', value: '' }],
    color: '#3B82F6'
  });
  const [chartType, setChartType] = useState<ChartType>('stacked');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d');
  const [data, setData] = useState<{ [key: string]: QueryResult[] }>({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<LoadingProgressType>({ current: 0, total: 100, percentage: 0 });

  const addTag = () => {
    setCurrentQuery(prev => ({
      ...prev,
      tags: [...(prev.tags || []), { name: '', value: '' }]
    }));
  };

  const removeTag = (index: number) => {
    setCurrentQuery(prev => ({
      ...prev,
      tags: prev.tags?.filter((_, i) => i !== index) || []
    }));
  };

  const updateTag = (index: number, field: 'name' | 'value', value: string) => {
    setCurrentQuery(prev => ({
      ...prev,
      tags: prev.tags?.map((tag, i) => 
        i === index ? { ...tag, [field]: value } : tag
      ) || []
    }));
  };

  const saveQuery = () => {
    if (!currentQuery.name || !currentQuery.tags?.length) return;
    
    const validTags = currentQuery.tags.filter(tag => tag.name && tag.value);
    if (validTags.length === 0) return;

    const newQuery: CustomQuery = {
      id: `custom-${Date.now()}`,
      name: currentQuery.name,
      tags: validTags,
      color: currentQuery.color || '#3B82F6'
    };

    setQueries(prev => [...prev, newQuery]);
    setCurrentQuery({
      name: '',
      tags: [{ name: '', value: '' }],
      color: '#3B82F6'
    });
  };

  const deleteQuery = (queryId: string) => {
    setQueries(prev => prev.filter(q => q.id !== queryId));
    setData(prev => {
      const newData = { ...prev };
      delete newData[queryId];
      return newData;
    });
  };

  const runQueries = async () => {
    if (queries.length === 0) return;

    setLoading(true);
    setData({});
    
    try {
      const total = queries.length;
      const newData: { [key: string]: QueryResult[] } = {};
      
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        
        // Create a progress callback for this specific query
        const queryProgressCallback = (queryProgress: LoadingProgressType) => {
          // Calculate overall progress based on completed queries + current query progress
          const overallPercentage = Math.round(
            ((i / total) + (queryProgress.percentage / 100 / total)) * 100
          );
          setProgress({
            current: i,
            total,
            percentage: overallPercentage
          });
        };

        console.log(`[QuerySection] Running query: ${query.name}`, query.tags);
        
        // Use original GraphQL query function
        const results = await queryTagCounts(query.tags, queryProgressCallback);
        newData[query.id] = results;
      }

      setProgress({ current: total, total, percentage: 100 });
      setData(newData);
    } catch (error) {
      console.error('[QuerySection] Error running queries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on selected time period
  const filteredData = filterDataByPeriod(data, timePeriod, chartType === 'stacked', undefined);
  const chartData = generateChartData(filteredData, queries, chartType);
  const shareText = generateShareText(queries, chartType);

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
    '#8B5CF6', '#06B6D4', '#F97316', '#84CC16'
  ];

  return (
    <div className="query-section">
      <div className="card">
        <div className="section-header">
          <div className="section-title">
            <div className="section-icon">
              <Filter size={24} />
            </div>
            <div className="section-text">
              <h2>Custom Query</h2>
              <p>Build custom queries to analyze specific tag combinations</p>
            </div>
          </div>
        </div>

        {/* Query Builder */}
        <div className="query-builder">
          <div className="query-builder-header">
            <Plus size={16} />
            New Query
          </div>
          
          <div className="query-form">
            <div className="input-group">
              <label className="input-label">Query Name</label>
              <input
                type="text"
                value={currentQuery.name || ''}
                onChange={(e) => setCurrentQuery(prev => ({ ...prev, name: e.target.value }))}
                className="input"
                placeholder="e.g., My Custom Analysis"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Color</label>
              <div className="color-picker">
                {colorOptions.map(color => (
                  <button
                    key={color}
                    onClick={() => setCurrentQuery(prev => ({ ...prev, color }))}
                    className={`color-option ${currentQuery.color === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="input-group">
              <div className="tags-header">
                <label className="input-label">Tags</label>
                <button
                  onClick={addTag}
                  className="button button-ghost"
                >
                  <Plus size={14} />
                  Add Tag
                </button>
              </div>
              
              <div className="tags-list">
                {currentQuery.tags?.map((tag, index) => (
                  <div key={index} className="tag-inputs">
                    <input
                      type="text"
                      value={tag.name}
                      onChange={(e) => updateTag(index, 'name', e.target.value)}
                      className="input"
                      placeholder="Tag name (e.g., App-Name)"
                    />
                    <input
                      type="text"
                      value={tag.value}
                      onChange={(e) => updateTag(index, 'value', e.target.value)}
                      className="input"
                      placeholder="Tag value (e.g., MyApp)"
                    />
                    {currentQuery.tags && currentQuery.tags.length > 1 && (
                      <button
                        onClick={() => removeTag(index)}
                        className="remove-tag-button"
                      >
                        <Minus size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={saveQuery}
              disabled={!currentQuery.name || !currentQuery.tags?.some(tag => tag.name && tag.value)}
              className="button button-primary save-button"
            >
              <Save size={16} />
              Save Query
            </button>
          </div>
        </div>

        {/* Saved Queries */}
        {queries.length > 0 && (
          <div className="saved-queries">
            <div className="saved-queries-header">
              <h3>Saved Queries</h3>
              <div className="header-actions">
                <div className="time-period-selector">
                  {(['7d', '30d', '3M', '6M'] as TimePeriod[]).map(period => (
                    <button
                      key={period}
                      onClick={() => setTimePeriod(period)}
                      className={`period-button ${timePeriod === period ? 'active' : ''}`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
                <button
                  onClick={runQueries}
                  disabled={loading || queries.length === 0}
                  className="button button-primary"
                >
                  <Play size={16} />
                  Run Queries
                </button>
              </div>
            </div>
            
            <div className="queries-list">
              {queries.map(query => (
                <div key={query.id} className="query-item">
                  <div className="query-item-info">
                    <div 
                      className="query-color"
                      style={{ backgroundColor: query.color }}
                    />
                    <div className="query-details">
                      <div className="query-name">{query.name}</div>
                      <div className="query-tags">
                        {query.tags.map(tag => `${tag.name}:${tag.value}`).join(', ')}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteQuery(query.id)}
                    className="delete-query-button"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {queries.length === 0 && (
          <div className="empty-state">
            <Filter className="empty-icon" />
            <div className="empty-title">No queries saved yet</div>
            <div className="empty-description">
              Create a query above to get started
            </div>
          </div>
        )}
      </div>

      {queries.length > 0 && (
        loading ? (
          <LoadingProgress 
            progress={progress} 
            message="Running queries..."
          />
        ) : Object.keys(data).length > 0 ? (
          <Chart
            data={chartData}
            chartType={chartType}
            title="Custom Query Results"
            shareText={shareText}
            onTypeChange={setChartType}
          />
        ) : null
      )}
    </div>
  );
};

export default QuerySection; 