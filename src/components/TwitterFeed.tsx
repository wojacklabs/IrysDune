import React, { useEffect, useState } from 'react';
import type { ProjectTweet } from '../constants/projectTweets';
import { fetchTweetData } from '../services/twitterService';
import { projectTweets } from '../constants/projectTweets';

interface TwitterFeedProps {
  tweetId: string;
  className?: string;
}

const TwitterFeed: React.FC<TwitterFeedProps> = ({ tweetId, className }) => {
  const [tweet, setTweet] = useState<ProjectTweet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTweet = async () => {
      setLoading(true);
      
      // Find the project info for this tweet
      let projectInfo: Partial<ProjectTweet> = { tweetId };
      
      for (const [projectId, tweets] of Object.entries(projectTweets)) {
        if ((tweets as string[]).includes(tweetId)) {
          // Get project name from the constants
          const projectName = projectId.split('-').map(w => 
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' ');
          
          projectInfo = {
            tweetId,
            projectId,
            projectName,
            tweetUrl: `https://twitter.com/i/web/status/${tweetId}`
          };
          break;
        }
      }
      
      const tweetData = await fetchTweetData(projectInfo as ProjectTweet);
      setTweet(tweetData);
      setLoading(false);
    };
    
    loadTweet();
  }, [tweetId]);

  const TweetCard: React.FC<{ tweet: ProjectTweet }> = ({ tweet }) => {
    const handleClick = () => {
      window.open(tweet.tweetUrl, '_blank', 'noopener,noreferrer');
    };

    return (
      <div className="tweet-card" onClick={handleClick}>
        {/* Cloud decoration */}
        <div className="tweet-cloud-decoration"></div>
        
        {/* Project badge */}
        {tweet.projectIcon && (
          <div className="tweet-project-badge">
            <img 
              src={tweet.projectIcon} 
              alt={tweet.projectName} 
              className="tweet-project-badge-icon"
            />
          </div>
        )}
        
        <div className="tweet-header">
          <div className="tweet-author">
            <div className="tweet-author-name">{tweet.author || 'Loading...'}</div>
            <div className="tweet-author-handle">{tweet.authorHandle || '@loading'}</div>
          </div>
          <div className="tweet-date">
            {tweet.date ? tweet.date : 'Recent'}
          </div>
        </div>
        
        <div className="tweet-content">
          {tweet.content || 'Loading tweet content...'}
        </div>
      </div>
    );
  };

  if (loading || !tweet) {
    return (
      <div className={`tweet-card loading ${className || ''}`}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
      <TweetCard tweet={tweet} />
  );
};

export default TwitterFeed;
