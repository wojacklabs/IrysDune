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
  'social': {
    id: 'social',
    name: 'Social',
    color: '#d4a574',
    icon: '💬',
    description: 'Social media and communication'
  },
  'dev': {
    id: 'dev',
    name: 'Dev',
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
  'gaming': {
    id: 'gaming',
    name: 'Gaming',
    color: '#ef4444',
    icon: '🎮',
    description: 'Gaming and entertainment'
  },
  'storage': {
    id: 'storage',
    name: 'Storage',
    color: '#10b981',
    icon: '💾',
    description: 'File storage and management'
  },
  'other': {
    id: 'other',
    name: 'Other',
    color: '#6b7280',
    icon: '📦',
    description: 'Uncategorized activities'
  },
  'faucet': {
    id: 'faucet',
    name: 'Faucet',
    color: '#9333ea',
    icon: '💧',
    description: 'Faucet token distribution'
  }
};

// Tag combination to activity category mapping
export const TAG_ACTIVITY_MAPPINGS: TagActivityMapping[] = [
  // CM Note
  {
    tags: [{ name: 'App-Name', value: 'irys-cm-note-unified' }],
    activityId: 'social',
    projectId: 'cm-note'
  },
  {
    tags: [{ name: 'App-Name', value: 'Irys Realms' }],
    activityId: 'gaming',
    projectId: 'irys-realms'
  },
  {
    tags: [{ name: 'App-Name', value: 'irys-git' }],
    activityId: 'dev',
    projectId: 'githirys'
  },
  {
    tags: [{ name: 'App-Name', value: 'irys-git-nickname' }],
    activityId: 'dev',
    projectId: 'githirys'
  },
  // Irys Name Service
  {
    tags: [{ name: 'App-Name', value: 'Irys-Names' }],
    activityId: 'identity',
    projectId: 'irys-names'
  },
    {
      tags: [{ name: 'IrysPFP-Data-Type', value: 'image' }],
      activityId: 'identity',
      projectId: 'irys-pfp'
    },
  // BridgeBox
  {
    tags: [{ name: 'App-Name', value: 'Bridgbox-Email-Lit' }],
    activityId: 'email',
    projectId: 'bridgbox'
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
  {
    tags: [{ name: 'App-Name', value: 'IrysDune-Badge-NFT' }],
    activityId: 'analytics',
    projectId: 'irysdune'
  },
  {
    tags: [{ name: 'App-Name', value: 'IrysDune-Event-NFT' }],
    activityId: 'analytics',
    projectId: 'irysdune'
  },
  // IrysProof Board
  {
    tags: [{ name: 'App', value: 'IRYS Proofboard' }],
    activityId: 'proof',
    projectId: 'irys-proof-board'
  },
  // IrysFlip
  {
    tags: [{ name: 'App-Name', value: 'IrysFlip' }],
    activityId: 'gaming',
    projectId: 'irysflip'
  },
  // IrysMemory
  {
    tags: [{ name: 'App-Name', value: 'IrysMemoryGameByPrmak' }],
    activityId: 'gaming',
    projectId: 'irys-memory'
  },
  // Irys Pinter
  {
    tags: [{ name: 'App-Name', value: 'Irys-Pinter' }],
    activityId: 'social',
    projectId: 'irys-pinter'
  },
  // IrysCrush
  {
    tags: [{ name: 'App', value: 'IrysCrush' }],
    activityId: 'gaming',
    projectId: 'irys-crush'
  },
  // IrysSlot
  {
    tags: [{ name: 'App', value: 'IrysSlot' }],
    activityId: 'gaming',
    projectId: 'irys-slot'
  },
  // PlayHirys
  {
    tags: [{ name: 'App', value: 'PlayHirys' }],
    activityId: 'gaming',
    projectId: 'play-hirys'
  },
  // Irys3D
  {
    tags: [{ name: 'File-Type', value: 'image/jpeg' }],
    activityId: 'storage',
    projectId: 'irys-3d'
  },
  {
    tags: [{ name: 'File-Type', value: 'image/png' }],
    activityId: 'storage',
    projectId: 'irys-3d'
  },
  // IrysNote
  {
    tags: [{ name: 'app', value: 'IrysNote' }],
    activityId: 'social',
    projectId: 'irys-note'
  },
  // Irys Vibe Coders Hub
  {
    tags: [{ name: 'App-Name', value: 'IrysVibeCodersHub' }],
    activityId: 'dev',
    projectId: 'irys-vibe-coders-hub'
  },
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
  'Transfer': 'storage',
  // Faucet
  'Faucet Claim': 'faucet'
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