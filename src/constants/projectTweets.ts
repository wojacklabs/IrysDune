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
  profileImage?: string;
  metrics?: {
    likes?: number | null;
    retweets?: number | null;
    replies?: number | null;
  };
}

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
  // BridgBox
  {
    projectId: 'bridgebox',
    projectName: 'BridgBox',
    projectIcon: APP_PRESETS.find(p => p.id === 'bridgebox')?.icon || null,
    tweetUrl: 'https://x.com/Jst_Mariee/status/1952385559646601677',
    tweetId: '1952385559646601677'
  }
];

// 랜덤하게 섞인 트윗 배열 반환
export function getShuffledTweets(): ProjectTweet[] {
  return [...PROJECT_TWEETS].sort(() => Math.random() - 0.5);
}