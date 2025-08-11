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
  {
    projectId: 'irysdune',
    projectName: 'IrysDune',
    projectIcon: APP_PRESETS.find(p => p.id === 'irysdune')?.icon || null,
    tweetUrl: 'https://x.com/0xCrocy/status/1951799943187829167',
    tweetId: '1951799943187829167'
  },
  // BridgBox
  {
    projectId: 'bridgebox',
    projectName: 'BridgBox',
    projectIcon: APP_PRESETS.find(p => p.id === 'bridgebox')?.icon || null,
    tweetUrl: 'https://x.com/Jst_Mariee/status/1952385559646601677',
    tweetId: '1952385559646601677'
  },
  {
    projectId: 'bridgebox',
    projectName: 'BridgBox',
    projectIcon: APP_PRESETS.find(p => p.id === 'bridgebox')?.icon || null,
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
  // Irys PFP
  {
    projectId: 'irys-pfp',
    projectName: 'Irys PFP',
    projectIcon: APP_PRESETS.find(p => p.id === 'irys-pfp')?.icon || null,
    tweetUrl: 'https://x.com/boyykennn/status/1954804094918435206',
    tweetId: '1954804094918435206'
  },
  // Irys Memory
  {
    projectId: 'irys-memory',
    projectName: 'IrysMemory',
    projectIcon: APP_PRESETS.find(p => p.id === 'irys-memory')?.icon || null,
    tweetUrl: 'https://x.com/boyykennn/status/1954468493169938773',
    tweetId: '1954468493169938773'
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

// 랜덤하게 섞인 트윗 배열 반환
export function getShuffledTweets(): ProjectTweet[] {
  return [...PROJECT_TWEETS].sort(() => Math.random() - 0.5);
}