import React, { useEffect, useState } from 'react';
import Marquee from 'react-fast-marquee';
import { MessageCircle, Heart, Repeat, Share } from 'lucide-react';
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
    return (
      <div className="tweet-card">
        <div className="tweet-header">
          {tweet.projectIcon && (
            <img 
              src={tweet.projectIcon} 
              alt={tweet.projectName} 
              className="tweet-project-icon"
            />
          )}
          <div className="tweet-author">
            <div className="tweet-author-name">{tweet.author || 'Loading...'}</div>
            <div className="tweet-author-handle">{tweet.authorHandle || '@loading'}</div>
          </div>
          <div className="tweet-date">
            {tweet.date ? new Date(tweet.date).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            }) : 'Recent'}
          </div>
        </div>
        
        <div className="tweet-content">
          {tweet.content || 'Loading tweet content...'}
        </div>
        
        <div className="tweet-actions">
          <button className="tweet-action">
            <MessageCircle size={16} />
            <span>{tweet.metrics?.replies || 0}</span>
          </button>
          <button className="tweet-action">
            <Repeat size={16} />
            <span>{tweet.metrics?.retweets || 0}</span>
          </button>
          <button className="tweet-action">
            <Heart size={16} />
            <span>{tweet.metrics?.likes || 0}</span>
          </button>
          <button className="tweet-action">
            <Share size={16} />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="twitter-feed-section">
        <div className="twitter-feed-header">
          <h3 className="twitter-feed-title">
            <span className="title-icon">🐦</span>
            Community Voices
          </h3>
          <p className="twitter-feed-subtitle">
            Loading tweets...
          </p>
        </div>
        <div className="twitter-feed-loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="twitter-feed-section">
      <div className="twitter-feed-header">
        <h3 className="twitter-feed-title">
          <span className="title-icon">🐦</span>
          Community Voices
        </h3>
        <p className="twitter-feed-subtitle">
          What people are saying about the Irys ecosystem
        </p>
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
            <div key={index} className="tweet-wrapper">
              <TweetCard tweet={tweet} />
            </div>
          ))}
          {/* Duplicate for seamless loop */}
          {tweets.map((tweet, index) => (
            <div key={`dup-${index}`} className="tweet-wrapper">
              <TweetCard tweet={tweet} />
            </div>
          ))}
        </Marquee>
      </div>
    </div>
  );
};

export default TwitterFeed;
