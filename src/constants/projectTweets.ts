import { APP_PRESETS } from './appPresets';
import { ON_CHAIN_PRESETS } from '../services/onChainService';

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
  },

  '1955919563230437766': {
    name: 'Jst_Mariee',
    handle: 'Jst_Mariee'
  },

  '1955914400076050510': {
    name: '0xsoros',
    handle: '0xsoros'
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
  // Removed - Tweet is private
  // {
  //   projectId: 'bridgbox',
  //   projectName: 'BridgBox',
  //   projectIcon: APP_PRESETS.find(p => p.id === 'bridgbox')?.icon || null,
  //   tweetUrl: 'https://x.com/boyykennn/status/1955561362769203451',
  //   tweetId: '1955561362769203451'
  // },
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
  // Removed - Tweet is private
  // {
  //   projectId: 'irys-realms',
  //   projectName: 'Irys Realms',
  //   projectIcon: APP_PRESETS.find(p => p.id === 'irys-realms')?.icon || null,
  //   tweetUrl: 'https://x.com/boyykennn/status/1955166172464226690',
  //   tweetId: '1955166172464226690'
  // },
  {
    projectId: 'irys-realms',
    projectName: 'Irys Realms',
    projectIcon: APP_PRESETS.find(p => p.id === 'irys-realms')?.icon || null,
    tweetUrl: 'https://x.com/Jst_Mariee/status/1955919563230437766',
    tweetId: '1955919563230437766'
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
  // Irys PFP
  // Removed - Tweet is private
  // {
  //   projectId: 'irys-pfp',
  //   projectName: 'Irys PFP',
  //   projectIcon: APP_PRESETS.find(p => p.id === 'irys-pfp')?.icon || null,
  //   tweetUrl: 'https://x.com/boyykennn/status/1954804094918435206',
  //   tweetId: '1954804094918435206'
  // },
  // irys name
    {
        projectId: 'irys-names',
        projectName: 'Irys Names',
        projectIcon: APP_PRESETS.find(p => p.id === 'irys-names')?.icon || null,
        tweetUrl: 'https://x.com/boyykennn/status/1953741189087162693',
        tweetId: '1953741189087162693'
    },
    // irys flip
    // Removed - Tweet is private
    // {
    //     projectId: 'irys-flip',
    //     projectName: 'Irys Flip',
    //     projectIcon: APP_PRESETS.find(p => p.id === 'irys-flip')?.icon || null,
    //     tweetUrl: 'https://x.com/boyykennn/status/1955789582500327904',
    //     tweetId: '1955789582500327904'
    // },
    // irys memory  
    // Removed - Tweet is private
    // {
    //   projectId: 'irys-memory',
    //   projectName: 'Irys Memory',
    //   projectIcon: APP_PRESETS.find(p => p.id === 'irys-memory')?.icon || null,
    //   tweetUrl: 'https://x.com/boyykennn/status/1954468493169938773',
    //   tweetId: '1954468493169938773'
    // },
    // Play Hirys
    {
      projectId: 'play-hirys',
      projectName: 'Play Hirys',
      projectIcon: APP_PRESETS.find(p => p.id === 'play-hirys')?.icon || null,
      tweetUrl: 'https://x.com/0xsoros/status/1955914400076050510',
      tweetId: '1955914400076050510'
    },
    // IrysTarotCard
    {
      projectId: 'irys-tarot-card',
      projectName: 'IrysTarotCard',
      projectIcon: ON_CHAIN_PRESETS.find(p => p.id === 'irys-tarot-card')?.icon || null,
      tweetUrl: 'https://gateway.irys.xyz/mutable/AtzCU6spPnjKHUXdwFnANZWiNFmvoYEaCYrHpRCrhBxN',
      tweetId: 'irys-tarot-card-mutable' // Using mutable address as ID
    },
    // IrysForum
    {
      projectId: 'irys-forum',
      projectName: 'IrysForum',
      projectIcon: ON_CHAIN_PRESETS.find(p => p.id === 'irys-forum')?.icon || null,
      tweetUrl: 'https://gateway.irys.xyz/mutable/9NBhQtdPu7uCkQXov9mfWqtYusJ11ksyZpo6cn8sbPM2',
      tweetId: 'irys-forum-mutable' // Using mutable address as ID
    },
    // Irys3D
    {
      projectId: 'irys-3d',
      projectName: 'Irys3D',
      projectIcon: APP_PRESETS.find(p => p.id === 'irys-3d')?.icon || null,
      tweetUrl: 'https://gateway.irys.xyz/mutable/5xzH3xoCW6PaCjzdpYHQUj8y15rZZwQ1pkwxeeLEWUcG',
      tweetId: 'irys-3d-mutable' // Using mutable address as ID
    },
    // IrysNote
    {
      projectId: 'irys-note',
      projectName: 'IrysNote',
      projectIcon: APP_PRESETS.find(p => p.id === 'irys-note')?.icon || null,
      tweetUrl: 'https://gateway.irys.xyz/mutable/2PKcFQ15NK3sLgp5XN5ijosFQPh6nbgdypFH9vLwzGgh',
      tweetId: 'irys-note-mutable' // Using mutable address as ID
    },
    // Irys Vibe Coders Hub
    {
      projectId: 'irys-vibe-coders-hub',
      projectName: 'Irys Vibe Coders Hub',
      projectIcon: APP_PRESETS.find(p => p.id === 'irys-vibe-coders-hub')?.icon || null,
      tweetUrl: 'https://gateway.irys.xyz/mutable/AUQHGoMHyVgr2eQT46kTRLLRs63K3DzMFffatbsbvLWN',
      tweetId: 'irys-vibe-coders-hub-mutable' // Using mutable address as ID
    },
    // Irys Pinter
    {
      projectId: 'irys-pinter',
      projectName: 'Irys Pinter',
      projectIcon: APP_PRESETS.find(p => p.id === 'irys-pinter')?.icon || null,
      tweetUrl: 'https://gateway.irys.xyz/mutable/3rpucfSC6JVWhbkscVkFP6KGKzaaWiJFsszRJNfDU5To',
      tweetId: 'irys-pinter-mutable' // Using mutable address as ID
    },
    // Seedback
    {
      projectId: 'seedback',
      projectName: 'Seedback',
      projectIcon: APP_PRESETS.find(p => p.id === 'seedback')?.icon || null,
      tweetUrl: 'https://gateway.irys.xyz/mutable/8B4SKBJfamH5WT4eGLtQDYJYmbX9ihenNdgmAAtsz5mo',
      tweetId: 'seedback-mutable' // Using mutable address as ID
    },
    // Irys Drive
    {
      projectId: 'irys-drive',
      projectName: 'Irys Drive',
      projectIcon: APP_PRESETS.find(p => p.id === 'irys-drive')?.icon || null,
      tweetUrl: 'https://gateway.irys.xyz/mutable/9PnF5Z8AuWbbQKV6wL7EKQLquNhTvDv6pr6gYzXbfUxm',
      tweetId: 'irys-drive-mutable' // Using mutable address as ID
    }
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