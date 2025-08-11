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
  // CM Note
  {
    projectId: 'cm-note',
    projectName: 'CM Note',
    projectIcon: APP_PRESETS.find(p => p.id === 'cm-note')?.icon || null,
    tweetUrl: 'https://x.com/irys_xyz/status/1849817975522935093',
    tweetId: '1849817975522935093'
  },
  // GitHirys
  {
    projectId: 'githirys',
    projectName: 'GitHirys',
    projectIcon: APP_PRESETS.find(p => p.id === 'githirys')?.icon || null,
    tweetUrl: 'https://x.com/IrysBuilders/status/1852701301002809378',
    tweetId: '1852701301002809378'
  },
  // Irys Names
  {
    projectId: 'irys-names',
    projectName: 'Irys Names',
    projectIcon: APP_PRESETS.find(p => p.id === 'irys-names')?.icon || null,
    tweetUrl: 'https://x.com/irys_xyz/status/1851000000000000000',
    tweetId: '1851000000000000000'
  },
  // BridgeBox
  {
    projectId: 'bridgebox',
    projectName: 'BridgeBox',
    projectIcon: APP_PRESETS.find(p => p.id === 'bridgebox')?.icon || null,
    tweetUrl: 'https://x.com/irys_xyz/status/1852000000000000000',
    tweetId: '1852000000000000000'
  }
];

// 랜덤하게 섞인 트윗 배열 반환
export function getShuffledTweets(): ProjectTweet[] {
  return [...PROJECT_TWEETS].sort(() => Math.random() - 0.5);
}