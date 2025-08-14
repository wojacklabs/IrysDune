import type { ProjectTweet } from '../constants/projectTweets';

// Twitter oEmbed API 응답 타입
interface TwitterOEmbedResponse {
  url: string;
  author_name: string;
  author_url: string;
  html: string;
  width: number;
  height: number;
  type: string;
  cache_age: string;
  provider_name: string;
  provider_url: string;
  version: string;
}

// HTML에서 트윗 정보 추출
function parseTweetHTML(html: string, authorUrl: string): {
  content: string;
  authorHandle: string;
  date: string;
  profileImage: string;
  metrics: {
    likes?: number | null;
    retweets?: number | null;
    replies?: number | null;
  };
} {
  // Create a temporary DOM element to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Extract tweet content
  const contentElement = doc.querySelector('p');
  const content = contentElement?.textContent || '';
  
  // Extract author handle from author URL
  const handle = authorUrl.split('/').pop() || '';
  
  // Extract date - the last link in the blockquote is usually the date
  const links = doc.querySelectorAll('a');
  const dateLink = links[links.length - 1];
  const dateText = dateLink?.textContent || '';
  
  // Generate profile image URL from handle
  // Twitter profile images follow a pattern, but we'll use a placeholder service
  const profileImage = `https://unavatar.io/twitter/${handle}`;
  
  // Twitter oEmbed API doesn't provide engagement metrics
  // We'll use null to indicate that metrics are not available
  const metrics = {
    likes: null,
    retweets: null,
    replies: null
  };
  
  return {
    content: content.replace(/https:\/\/t\.co\/\w+/g, '').trim(), // Remove t.co links
    authorHandle: `@${handle}`,
    date: dateText,
    profileImage,
    metrics
  };
}

// Twitter oEmbed API를 통해 트윗 정보 가져오기
export async function fetchTweetData(tweet: ProjectTweet): Promise<ProjectTweet> {
  try {
    const response = await fetch('/api/twitter-oembed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: tweet.tweetUrl })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch tweet data');
    }

    const data: TwitterOEmbedResponse = await response.json();
    const parsedData = parseTweetHTML(data.html, data.author_url);
    
    return {
      ...tweet,
      author: data.author_name,
      authorHandle: parsedData.authorHandle,
      content: parsedData.content,
      date: parsedData.date,
      metrics: parsedData.metrics
    };
  } catch (error) {
    console.error('Error fetching tweet data:', error);
    // 에러 발생 시 기본값 반환
    return {
      ...tweet,
      author: 'Unknown Author',
      authorHandle: '@unknown',
      content: 'Tweet content could not be loaded.',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      metrics: {
        likes: 0,
        retweets: 0,
        replies: 0
      }
    };
  }
}


// 여러 트윗 데이터를 한 번에 가져오기
export async function fetchMultipleTweets(tweets: ProjectTweet[]): Promise<ProjectTweet[]> {
  // 병렬로 처리하되, rate limit을 고려하여 배치 처리
  const batchSize = 5;
  const results: ProjectTweet[] = [];
  
  for (let i = 0; i < tweets.length; i += batchSize) {
    const batch = tweets.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(tweet => fetchTweetData(tweet))
    );
    results.push(...batchResults);
    
    // Rate limiting을 위한 짧은 대기
    if (i + batchSize < tweets.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}