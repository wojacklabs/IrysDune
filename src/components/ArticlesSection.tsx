import React, { useState } from 'react';
import { Newspaper, ChevronDown, ChevronUp } from 'lucide-react';
import TwitterEmbed from './TwitterEmbed';
import { APP_PRESETS } from '../constants/appPresets';
import { projectTweets, AUTHOR_PROFILES } from '../constants/projectTweets';
import ProfileImage from './ProfileImage';

const ArticlesSection: React.FC = () => {
  // 각 프로젝트의 접힘/펼침 상태를 관리 (기본값: 모두 접힘)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  return (
    <div className="articles-section">
      <div className="articles-header">
        <div className="ecosystem-title">
          <Newspaper className="ecosystem-icon" size={20} />
          <h3>Community Articles</h3>
        </div>
      </div>
      
      {/* Project cards */}
      <div className="articles-grid">
        {APP_PRESETS.map((preset) => {
          const tweets = projectTweets[preset.id] || [];
          
          if (tweets.length === 0) return null;
          
          const isExpanded = expandedProjects.has(preset.id);
          
          return (
            <div key={preset.id} className="project-article-card card">
              <div 
                className="project-header clickable"
                onClick={() => toggleProject(preset.id)}
              >
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
                <div className="project-header-right">
                  <div className="header-meta">
                    <span className="article-count">{tweets.length} articles</span>
                    {!isExpanded && (
                      <div className="author-profiles-inline">
                        {tweets.slice(0, 3).map((tweetId: string) => {
                          const author = AUTHOR_PROFILES[tweetId];
                          if (!author) return null;
                          
                          return (
                            <ProfileImage 
                              key={tweetId}
                              handle={author.handle}
                              name={author.name}
                              className="author-profile-image-small"
                            />
                          );
                        })}
                        {tweets.length > 3 && (
                          <span className="more-authors">+{tweets.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
              
              {/* 트윗 내용 - 항상 렌더링하되 접힌 상태에서는 숨김 */}
              <div className={`tweets-container ${!isExpanded ? 'collapsed' : ''}`}>
                <div className="tweets-horizontal-scroll">
                  <div className="tweets-row">
                    {tweets.map((tweetId: string) => (
                      <TwitterEmbed 
                        key={tweetId} 
                        tweetId={tweetId}
                        className="tweet-embed-card"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArticlesSection;
