import { APP_PRESETS } from './appPresets';

export interface ProjectTweet {
  projectId: string;
  projectName: string;
  projectIcon: string | null;
  tweetUrl: string;
  tweetId?: string;
  // API에서 받아올 데이터
  author?: string;
  authorHandle?: string;
  content?: string;
  date?: string;
  metrics?: {
    likes?: number | null;
    retweets?: number | null;
    replies?: number | null;
  };
}

// 작성자별 프로필 정보 매핑 (트윗 ID 기준)
export const AUTHOR_PROFILES: Record<string, { name: string; handle: string }> = {
  '1953494872888955018': {
    name: 'Jst_Mariee',
    handle: 'Jst_Mariee'
  },
  '1951799943187829167': {
    name: '0xCrocy',
    handle: '0xCrocy'
  },
  '1952385559646601677': {
    name: 'Jst_Mariee',
    handle: 'Jst_Mariee'
  },
  '1952543921013182567': {
    name: '0xCrocy',
    handle: '0xCrocy'
  },
  '1953917125157847440': {
    name: '0xCrocy',
    handle: '0xCrocy'
  },
  '1951054949481119751': {
    name: '0xCrocy',
    handle: '0xCrocy'
  },
  '1950630852762767630': {
    name: '0xCrocy',
    handle: '0xCrocy'
  },
  '1953531286385222039': {
    name: 'boyykennn',
    handle: 'boyykennn'
  },
  '1954096345129639975': {
    name: 'boyykennn',
    handle: 'boyykennn'
  },
  '1953741189087162693': {
    name: 'boyykennn',
    handle: 'boyykennn'
  }
};

// 프로젝트별 트윗 URL 데이터
export const PROJECT_TWEETS: ProjectTweet[] = [
  // IrysDune
  {
    projectId: 'irysdune',
    projectName: 'IrysDune',
    projectIcon: APP_PRESETS.find(p => p.id === 'irysdune')?.icon || null,
    tweetUrl: 'https://x.com/Jst_Mariee/status/1953494872888955018',
    tweetId: '1953494872888955018'
  },
  {
    projectId: 'irysdune',
    projectName: 'IrysDune',
    projectIcon: APP_PRESETS.find(p => p.id === 'irysdune')?.icon || null,
    tweetUrl: 'https://x.com/0xCrocy/status/1951799943187829167',
    tweetId: '1951799943187829167'
  },
  // BridgBox
  {
    projectId: 'bridgbox',
    projectName: 'BridgBox',
    projectIcon: APP_PRESETS.find(p => p.id === 'bridgbox')?.icon || null,
    tweetUrl: 'https://x.com/Jst_Mariee/status/1952385559646601677',
    tweetId: '1952385559646601677'
  },
  {
    projectId: 'bridgbox',
    projectName: 'BridgBox',
    projectIcon: APP_PRESETS.find(p => p.id === 'bridgbox')?.icon || null,
    tweetUrl: 'https://x.com/0xCrocy/status/1952543921013182567',
    tweetId: '1952543921013182567'
  },
  // Irys Flip
  {
    projectId: 'irysflip',
    projectName: 'Irys Flip',
    projectIcon: APP_PRESETS.find(p => p.id === 'irysflip')?.icon || null,
    tweetUrl: 'https://x.com/0xCrocy/status/1953917125157847440',
    tweetId: '1953917125157847440'
  },
  // Irys Realms
  {
    projectId: 'irys-realms',
    projectName: 'Irys Realms',
    projectIcon: APP_PRESETS.find(p => p.id === 'irys-realms')?.icon || null,
    tweetUrl: 'https://x.com/0xCrocy/status/1951054949481119751',
    tweetId: '1951054949481119751'
  },
  // cm's note
  {
    projectId: 'cm-note',
    projectName: 'CM Note',
    projectIcon: APP_PRESETS.find(p => p.id === 'cm-note')?.icon || null,
    tweetUrl: 'https://x.com/0xCrocy/status/1950630852762767630',
    tweetId: '1950630852762767630'
  },
  {
    projectId: 'cm-note',
    projectName: 'CM Note',
    projectIcon: APP_PRESETS.find(p => p.id === 'cm-note')?.icon || null,
    tweetUrl: 'https://x.com/boyykennn/status/1953531286385222039',
    tweetId: '1953531286385222039'
  },
  // Irys ProofBoard
  {
    projectId: 'irys-proof-board',
    projectName: 'Irys ProofBoard',
    projectIcon: APP_PRESETS.find(p => p.id === 'irys-proof-board')?.icon || null,
    tweetUrl: 'https://x.com/boyykennn/status/1954096345129639975',
    tweetId: '1954096345129639975'
  },
  // irys name
    {
        projectId: 'irys-names',
        projectName: 'Irys Names',
        projectIcon: APP_PRESETS.find(p => p.id === 'irys-names')?.icon || null,
        tweetUrl: 'https://x.com/boyykennn/status/1953741189087162693',
        tweetId: '1953741189087162693'
    },
];

// 프로젝트별로 그룹화된 트윗 ID
export const projectTweets: Record<string, string[]> = PROJECT_TWEETS.reduce((acc, tweet) => {
  if (!acc[tweet.projectId]) {
    acc[tweet.projectId] = [];
  }
  if (tweet.tweetId) {
    acc[tweet.projectId].push(tweet.tweetId);
  }
  return acc;
}, {} as Record<string, string[]>);

// 랜덤하게 섞인 트윗 배열 반환 (Fisher-Yates 알고리즘 사용)
export function getShuffledTweets(): ProjectTweet[] {
  const tweets = [...PROJECT_TWEETS];
  
  // Fisher-Yates shuffle algorithm for truly random ordering
  for (let i = tweets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tweets[i], tweets[j]] = [tweets[j], tweets[i]];
  }
  
  return tweets;
}