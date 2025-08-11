import React, { useEffect, useState } from 'react';
import Marquee from 'react-fast-marquee';
import { getShuffledTweets } from '../constants/projectTweets';
import type { ProjectTweet } from '../constants/projectTweets';
import { fetchMultipleTweets } from '../services/twitterService';

const TwitterFeed: React.FC = () => {
  const [tweets, setTweets] = useState<ProjectTweet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTweets = async () => {
      setLoading(true);
      const shuffledTweets = getShuffledTweets();
      const tweetsWithData = await fetchMultipleTweets(shuffledTweets);
      setTweets(tweetsWithData);
      setLoading(false);
    };
    
    loadTweets();
  }, []);

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
          {tweet.profileImage && (
            <img 
              src={tweet.profileImage} 
              alt={tweet.author} 
              className="tweet-profile-image"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(tweet.author || 'User')}&background=random`;
              }}
            />
          )}
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

  if (loading) {
    return (
      <div className="twitter-feed-section">
        <div className="ecosystem-title">
          <h3>
            Community Voices
          </h3>
        </div>
        <div className="twitter-feed-loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="twitter-feed-section">
      <div className="ecosystem-title">
        <h3>
          Community Voices
        </h3>
      </div>
      
      <div className="twitter-feed-container">
        <Marquee
          gradient={true}
          gradientColor="rgba(248, 250, 252, 1)"
          gradientWidth={50}
          speed={30}
          pauseOnHover={true}
          className="tweet-marquee"
        >
          {tweets.map((tweet, index) => (
            <div key={`${tweet.tweetId}-${index}`} className="tweet-wrapper">
              <TweetCard tweet={tweet} />
            </div>
          ))}
        </Marquee>
      </div>
    </div>
  );
};

export default TwitterFeed;
