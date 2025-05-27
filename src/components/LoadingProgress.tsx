import React from 'react';
import { Cloud } from 'lucide-react';
import type { LoadingProgress as LoadingProgressType } from '../types';

interface LoadingProgressProps {
  progress: LoadingProgressType;
  message?: string;
}

const LoadingProgress: React.FC<LoadingProgressProps> = ({ progress, message }) => {
  const getThematicMessage = () => {
    const messages = [
      'Gathering data from the Irys network...',
      'Processing blockchain transactions...',
      'Analyzing ecosystem activity...',
      'Compiling results...',
      'Almost there...'
    ];
    
    const index = Math.min(Math.floor(progress.percentage / 20), messages.length - 1);
    return messages[index];
  };

  return (
    <div className="card loading-container">
      <div className="loading-content">
        <Cloud className="loading-icon" />
        <div className="loading-text">
          <div className="loading-message">
            {progress.message || message || 'Loading...'}
          </div>
          <div className="loading-submessage">
            {getThematicMessage()}
          </div>
        </div>
        
        <div className="loading-progress">
          <div
            className="loading-progress-bar"
            style={{ width: `${progress.percentage || Math.min((progress.current / (progress.total || 1)) * 100, 100)}%` }}
          />
        </div>
        
        <div className="loading-stats">
          {progress.percentage > 0 && (
            <span className="loading-percentage">{progress.percentage}%</span>
          )}
          <span className="loading-count">
            {progress.total > progress.current ? 
              `Found ${progress.current} transactions, still searching...` :
              `Total: ${progress.current} transactions`
            }
          </span>
        </div>
      </div>
    </div>
  );
};

export default LoadingProgress; 