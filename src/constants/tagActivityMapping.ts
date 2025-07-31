import type { AppPreset } from '../types';
import { APP_PRESETS } from './appPresets';

export interface ActivityCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
}

export interface TagActivityMapping {
  tags: { name: string; value?: string }[];
  activityId: string;
  projectId?: string;
}

// Activity category definitions
export const ACTIVITY_CATEGORIES: { [key: string]: ActivityCategory } = {
  'note': {
    id: 'note',
    name: 'Notes',
    color: '#d4a574',
    icon: '📝',
    description: 'Note-taking and documentation'
  },
  'code': {
    id: 'code',
    name: 'Code',
    color: '#333333',
    icon: '💻',
    description: 'Code repositories and development'
  },
  'identity': {
    id: 'identity',
    name: 'Identity',
    color: '#4dfff0',
    icon: '🆔',
    description: 'Identity and naming services'
  },
  'email': {
    id: 'email',
    name: 'Email',
    color: '#ff3142',
    icon: '📧',
    description: 'Email and messaging'
  },
  'analytics': {
    id: 'analytics',
    name: 'Analytics',
    color: '#0284c7',
    icon: '📊',
    description: 'Data analytics and visualization'
  },
  'proof': {
    id: 'proof',
    name: 'Proof',
    color: '#1affe8',
    icon: '✅',
    description: 'Proof and verification'
  },
  'nft': {
    id: 'nft',
    name: 'NFT',
    color: '#8b5cf6',
    icon: '🖼️',
    description: 'NFT and digital collectibles'
  },
  'gaming': {
    id: 'gaming',
    name: 'Gaming',
    color: '#ef4444',
    icon: '🎮',
    description: 'Gaming and entertainment'
  },
  'gaming-bet': {
    id: 'gaming-bet',
    name: 'Betting',
    color: '#f59e0b',
    icon: '🎰',
    description: 'Betting and gambling activities'
  },
  'gaming-room': {
    id: 'gaming-room',
    name: 'Game Room',
    color: '#10b981',
    icon: '🏠',
    description: 'Game room management'
  },
  'gaming-score': {
    id: 'gaming-score',
    name: 'Score',
    color: '#3b82f6',
    icon: '🏆',
    description: 'Score and leaderboard updates'
  },
  'storage': {
    id: 'storage',
    name: 'Storage',
    color: '#10b981',
    icon: '💾',
    description: 'File storage and management'
  },
  'defi': {
    id: 'defi',
    name: 'DeFi',
    color: '#f59e0b',
    icon: '🏦',
    description: 'Decentralized finance'
  },
  'other': {
    id: 'other',
    name: 'Other',
    color: '#6b7280',
    icon: '📦',
    description: 'Uncategorized activities'
  }
};

// Tag combination to activity category mapping
export const TAG_ACTIVITY_MAPPINGS: TagActivityMapping[] = [
  // CM Note
  {
    tags: [{ name: 'App-Name', value: 'irys-cm-note' }],
    activityId: 'note',
    projectId: 'cm-note'
  },
  {
    tags: [{ name: 'App-Name', value: 'CM-Note' }],
    activityId: 'note',
    projectId: 'cm-note'
  },
  // GitHirys
  {
    tags: [{ name: 'App-Name', value: 'irys-git' }],
    activityId: 'code',
    projectId: 'githirys'
  },
  {
    tags: [{ name: 'App-Name', value: 'git-hirys' }],
    activityId: 'code',
    projectId: 'githirys'
  },
  // Irys Name Service
  {
    tags: [{ name: 'App-Name', value: 'Irys-Names' }],
    activityId: 'identity',
    projectId: 'irys-names'
  },
  // BridgeBox
  {
    tags: [{ name: 'App-Name', value: 'Bridgbox-Email-Lit' }],
    activityId: 'email',
    projectId: 'bridgebox'
  },
  {
    tags: [{ name: 'App-Name', value: 'BridgeBox' }],
    activityId: 'email',
    projectId: 'bridgebox'
  },
  // IrysDune
  {
    tags: [{ name: 'App-Name', value: 'irys-dune-server' }],
    activityId: 'analytics',
    projectId: 'irysdune'
  },
  {
    tags: [{ name: 'App-Name', value: 'IrysDune' }],
    activityId: 'analytics',
    projectId: 'irysdune'
  },
  // IrysProof Board
  {
    tags: [{ name: 'App', value: 'IRYS Proofboard' }],
    activityId: 'proof',
    projectId: 'irys-proof-board'
  },
  {
    tags: [{ name: 'App-Name', value: 'IrysProof' }],
    activityId: 'proof',
    projectId: 'irys-proof-board'
  },
  // Lofty
  {
    tags: [{ name: 'App-Name', value: 'Lofty' }],
    activityId: 'nft',
    projectId: 'lofty'
  },
  // IrysFlip
  {
    tags: [{ name: 'App-Name', value: 'IrysFlip' }],
    activityId: 'gaming',
    projectId: 'irysflip'
  },
  // General file storage
  {
    tags: [{ name: 'Content-Type' }],
    activityId: 'storage'
  },
  // NFT related
  {
    tags: [{ name: 'Type', value: 'NFT' }],
    activityId: 'nft'
  },
  // Smart contracts
  {
    tags: [{ name: 'App-Name', value: 'SmartWeaveContract' }],
    activityId: 'defi'
  }
];

// 온체인 이벤트를 activity로 매핑
export const EVENT_ACTIVITY_MAPPINGS: { [eventName: string]: string } = {
  // IrysFlip
  'BetPlaced': 'gaming-bet',
  // IrysCrush
  'PlayerRegistered': 'identity',
  'ScoreUpdated': 'gaming-score',
  'RoomCreated': 'gaming-room',
  'PlayerJoinedRoom': 'gaming-room',
  'GameStarted': 'gaming',
  'GameFinished': 'gaming',
  'PvPGameFinished': 'gaming',
  // Uniswap
  'PoolCreated': 'defi',
  // Aave
  'Supply': 'defi',
  'Borrow': 'defi',
  // Lens
  'ProfileCreated': 'identity',
  // Default
  'Transfer': 'storage'
};

// 온체인 이벤트로부터 activity 가져오기
export function getActivityFromEvent(eventName: string): string {
  return EVENT_ACTIVITY_MAPPINGS[eventName] || 'other';
}

// Get activity from transaction tags
export function getActivityFromTags(tags: Array<{ name: string; value: string }>): string {
  // Check tag mappings for matches
  for (const mapping of TAG_ACTIVITY_MAPPINGS) {
    const isMatch = mapping.tags.every(mappingTag => {
      return tags.some(tag => {
        if (mappingTag.value) {
          // If value is specified, both name and value must match
          return tag.name === mappingTag.name && tag.value === mappingTag.value;
        } else {
          // If value is not specified, only name needs to match
          return tag.name === mappingTag.name;
        }
      });
    });

    if (isMatch) {
      return mapping.activityId;
    }
  }

  // Default to 'other' if no match found
  return 'other';
}

// Get project from transaction tags
export function getProjectFromTags(tags: Array<{ name: string; value: string }>): AppPreset | null {
  // Check tag mappings for matches
  for (const mapping of TAG_ACTIVITY_MAPPINGS) {
    if (!mapping.projectId) continue;
    
    const isMatch = mapping.tags.every(mappingTag => {
      return tags.some(tag => {
        if (mappingTag.value) {
          return tag.name === mappingTag.name && tag.value === mappingTag.value;
        } else {
          return tag.name === mappingTag.name;
        }
      });
    });

    if (isMatch) {
      const preset = APP_PRESETS.find(p => p.id === mapping.projectId);
      if (preset) return preset;
    }
  }

  return null;
} 