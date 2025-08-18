import React, { useEffect, useRef, useState } from 'react';

interface TwitterEmbedProps {
  tweetId: string;
  className?: string;
}

declare global {
  interface Window {
    twttr: any;
  }
}

const TwitterEmbed: React.FC<TwitterEmbedProps> = ({ tweetId, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isCreatingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const createTweet = async () => {
    if (containerRef.current && window.twttr && !isCreatingRef.current) {
      isCreatingRef.current = true;
      
      // Clear any existing content
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
      
      // Check if dark mode is active
      const isDarkMode = document.body.classList.contains('weather-stormy');
      

      
      try {
        // Create tweet embed
        const tweetElement = await window.twttr.widgets.createTweet(
          tweetId,
          containerRef.current,
          {
            theme: isDarkMode ? 'dark' : 'light',
            cards: 'hidden',  // Hide cards to save space
            conversation: 'none',  // Hide conversation thread
            dnt: true,
            width: '100%'
          }
        );
        

        
        if (tweetElement) {
          setIsLoading(false);
          setHasError(false);
        } else {
          // Tweet not found or failed to load
          setIsLoading(false);
          setHasError(true);
        }
      } catch (error) {

        console.error('Error creating tweet:', error);
        setIsLoading(false);
        setHasError(true);
      } finally {
        isCreatingRef.current = false;
      }
    }
  };

  useEffect(() => {
    // Listen for dark mode changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          // Re-create tweet with new theme when dark mode changes
          if (window.twttr && containerRef.current) {
            createTweet();
          }
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Cleanup observer
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
    
    if (!window.twttr && !existingScript) {
      // Load Twitter widget script only once
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.onload = () => {
        if (window.twttr && containerRef.current) {
          createTweet();
        }
      };
      document.body.appendChild(script);
    } else if (window.twttr && containerRef.current) {
      createTweet();
    } else if (existingScript && !window.twttr) {
      // Script is loading, wait for it
      existingScript.addEventListener('load', () => {
        if (window.twttr && containerRef.current) {
          createTweet();
        }
      });
    }
  }, [tweetId]);

  return (
    <div className={`twitter-embed-container ${className || ''}`}>
      {isLoading && !hasError && (
        <div className="tweet-loading">
          <div className="loading-spinner"></div>
        </div>
      )}
      {hasError && (
        <div className="tweet-error">
          <div className="error-content">
            <p>Tweet not found</p>
            <small>This tweet may have been deleted or the account may be private.</small>
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ display: hasError ? 'none' : 'block' }}></div>
    </div>
  );
};

export default TwitterEmbed;
