import type { AppPreset } from '../types';
import { APP_PRESETS } from './appPresets';

export interface ActivityCategory {
  id: string;
  name: string;
  color: string;
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
    name: 'Note Taking',
    color: '#d4a574',
    description: 'Note taking and documentation'
  },
  'code': {
    id: 'code',
    name: 'Code Storage',
    color: '#333333',
    description: 'Code repository and version control'
  },
  'identity': {
    id: 'identity',
    name: 'Identity',
    color: '#4dfff0',
    description: 'Identity and name service'
  },
  'email': {
    id: 'email',
    name: 'Email',
    color: '#ff3142',
    description: 'Email and messaging services'
  },
  'analytics': {
    id: 'analytics',
    name: 'Analytics',
    color: '#0284c7',
    description: 'Data analytics and visualization'
  },
  'proof': {
    id: 'proof',
    name: 'Proof',
    color: '#1affe8',
    description: 'Proof and verification services'
  },
  'nft': {
    id: 'nft',
    name: 'NFT',
    color: '#8B5CF6',
    description: 'NFT creation and management'
  },
  'defi': {
    id: 'defi',
    name: 'DeFi',
    color: '#10B981',
    description: 'DeFi protocol interactions'
  },
  'gaming': {
    id: 'gaming',
    name: 'Gaming',
    color: '#EF4444',
    description: 'Gaming related activities'
  },
  'storage': {
    id: 'storage',
    name: 'File Storage',
    color: '#3B82F6',
    description: 'General file and data storage'
  },
  'other': {
    id: 'other',
    name: 'Other',
    color: '#94A3B8',
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