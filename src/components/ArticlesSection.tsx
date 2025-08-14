import React from 'react';
import { Newspaper } from 'lucide-react';
import TwitterFeed from './TwitterFeed';
import { APP_PRESETS } from '../constants/appPresets';
import { projectTweets } from '../constants/projectTweets';

const ArticlesSection: React.FC = () => {
  return (
    <div className="articles-section">
      <div className="card">
        <div className="ecosystem-header">
          <div className="ecosystem-title">
            <Newspaper className="ecosystem-icon" size={20} />
            <h3>Community Articles</h3>
          </div>
        </div>
        
        {/* Project sections */}
        <div className="articles-content">
          {APP_PRESETS.map((preset) => {
            const tweets = projectTweets[preset.id] || [];
            
            if (tweets.length === 0) return null;
            
            return (
              <div key={preset.id} className="project-articles-section">
                <div className="project-header">
                  <div className="project-info">
                    {preset.icon && (
                      <img 
                        src={preset.icon} 
                        alt={preset.name}
                        className="project-icon"
                      />
                    )}
                    <h4>{preset.name}</h4>
                  </div>
                  <span className="article-count">{tweets.length} articles</span>
                </div>
                
                <div className="tweets-grid">
                  {tweets.map((tweetId: string) => (
                    <TwitterFeed 
                      key={tweetId} 
                      tweetId={tweetId}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ArticlesSection;
