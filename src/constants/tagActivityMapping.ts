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
  'community': {
    id: 'community',
    name: 'Community',
    color: '#d4a574',
    icon: '👥',
    description: 'Social and community applications'
  },
  'productivity': {
    id: 'productivity',
    name: 'Productivity',
    color: '#10b981',
    icon: '⚡',
    description: 'Productivity and utility tools'
  },
  'identity': {
    id: 'identity',
    name: 'Identity',
    color: '#4dfff0',
    icon: '🆔',
    description: 'Identity and naming services'
  },
  'game': {
    id: 'game',
    name: 'Game',
    color: '#ef4444',
    icon: '🎮',
    description: 'Gaming and entertainment'
  },
  'data': {
    id: 'data',
    name: 'Data',
    color: '#0284c7',
    icon: '📊',
    description: 'Data analytics and storage'
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
  // Community Category
  // CM Note
  {
    tags: [{ name: 'App-Name', value: 'irys-cm-note-unified' }],
    activityId: 'community',
    projectId: 'cm-note'
  },
  // Irys Realms
  {
    tags: [{ name: 'App-Name', value: 'Irys Realms' }],
    activityId: 'community',
    projectId: 'irys-realms'
  },
  // Productivity Category
  // GitHirys
  {
    tags: [{ name: 'App-Name', value: 'irys-git' }],
    activityId: 'productivity',
    projectId: 'githirys'
  },
  {
    tags: [{ name: 'App-Name', value: 'irys-git-nickname' }],
    activityId: 'productivity',
    projectId: 'githirys'
  },
  // Identity Category
  // Irys Name Service
  {
    tags: [{ name: 'App-Name', value: 'Irys-Names' }],
    activityId: 'identity',
    projectId: 'irys-names'
  },
  // Irys PFP
  {
    tags: [{ name: 'IrysPFP-Data-Type', value: 'image' }],
    activityId: 'community',
    projectId: 'irys-pfp'
  },
  // BridgeBox
  {
    tags: [{ name: 'App-Name', value: 'Bridgbox-Email-Lit' }],
    activityId: 'productivity',
    projectId: 'bridgbox'
  },
  // Data Category
  // IrysDune
  {
    tags: [{ name: 'App-Name', value: 'irys-dune-server' }],
    activityId: 'data',
    projectId: 'irysdune'
  },
  {
    tags: [{ name: 'App-Name', value: 'IrysDune' }],
    activityId: 'data',
    projectId: 'irysdune'
  },
  {
    tags: [{ name: 'App-Name', value: 'IrysDune-Badge-NFT' }],
    activityId: 'data',
    projectId: 'irysdune'
  },
  {
    tags: [{ name: 'App-Name', value: 'IrysDune-Event-NFT' }],
    activityId: 'data',
    projectId: 'irysdune'
  },
  // IrysProof Board
  {
    tags: [{ name: 'App', value: 'IRYS Proofboard' }],
    activityId: 'productivity',
    projectId: 'irys-proof-board'
  },
  // Game Category
  // IrysFlip
  {
    tags: [{ name: 'App-Name', value: 'IrysFlip' }],
    activityId: 'game',
    projectId: 'irysflip'
  },
  // IrysMemory
  {
    tags: [{ name: 'App-Name', value: 'IrysMemoryGameByPrmak' }],
    activityId: 'game',
    projectId: 'irys-memory'
  },
  // Irys Pinter
  {
    tags: [{ name: 'App-Name', value: 'Irys-Pinter' }],
    activityId: 'productivity',
    projectId: 'irys-pinter'
  },
  // IrysCrush
  {
    tags: [{ name: 'App', value: 'IrysCrush' }],
    activityId: 'game',
    projectId: 'irys-crush'
  },
  // IrysSlot
  {
    tags: [{ name: 'App', value: 'IrysSlot' }],
    activityId: 'game',
    projectId: 'irys-slot'
  },
  // PlayHirys
  {
    tags: [{ name: 'App', value: 'PlayHirys' }],
    activityId: 'game',
    projectId: 'play-hirys'
  },
  // Irys3D
  {
    tags: [{ name: 'File-Type', value: 'image/jpeg' }],
    activityId: 'data',
    projectId: 'irys-3d'
  },
  {
    tags: [{ name: 'File-Type', value: 'image/png' }],
    activityId: 'data',
    projectId: 'irys-3d'
  },
  // IrysNote
  {
    tags: [{ name: 'app', value: 'IrysNote' }],
    activityId: 'productivity',
    projectId: 'irys-note'
  },
  // Irys Vibe Coders Hub
  {
    tags: [{ name: 'App-Name', value: 'IrysVibeCodersHub' }],
    activityId: 'community',
    projectId: 'irys-vibe-coders-hub'
  },
  // Seedback
  {
    tags: [{ name: 'App-Name', value: 'Seedback' }],
    activityId: 'community',
    projectId: 'seedback'
  },
  // IrysTarotCard (온체인)
  {
    tags: [],
    activityId: 'community',
    projectId: 'irys-tarot-card'
  },
  // IrysForum (온체인)
  {
    tags: [],
    activityId: 'community',
    projectId: 'irys-forum'
  },
  // Irys Drive
  {
    tags: [{ name: 'App-Name', value: 'IrysDrive' }],
    activityId: 'productivity',
    projectId: 'irys-drive'
  },
];

// 온체인 이벤트를 activity로 매핑
export const EVENT_ACTIVITY_MAPPINGS: { [eventName: string]: string } = {
  // IrysFlip
  'BetPlaced': 'game',
  // IrysCrush
  'PlayerRegistered': 'game',
  'ScoreUpdated': 'game',
  'RoomCreated': 'game',
  'PlayerJoinedRoom': 'game',
  'GameStarted': 'game',
  'GameFinished': 'game',
  'PvPGameFinished': 'game',
  // Uniswap
  'PoolCreated': 'other',
  // Aave
  'Supply': 'other',
  'Borrow': 'other',
  // Lens
  'ProfileCreated': 'other',
  // Default
  'Transfer': 'other',
  // Faucet
  'Faucet Claim': 'other'
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