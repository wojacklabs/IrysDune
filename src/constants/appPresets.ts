import type { AppPreset } from '../types';
import cmNoteIcon from '../assets/cmnote.png';
import githirysIcon from '../assets/githirys.png';
import irysNamesIcon from '../assets/irysnameservice.png';
import bridgeboxIcon from '../assets/bridgebox.png';
import irysduneIcon from '../assets/irysdune.png';
import irysProofBoardIcon from '../assets/irysproofboard.png';
import loftyIcon from '../assets/lofty.png';
import irysflipIcon from '../assets/irysflip.png';

export const APP_PRESETS: AppPreset[] = [
  {
    id: 'cm-note',
    name: 'CM Note',
    tags: [
      { name: 'App-Name', value: 'irys-cm-note' }
    ],
    color: '#d4a574',
    icon: cmNoteIcon
  },
  {
    id: 'githirys',
    name: 'GitHirys',
    tags: [
      { name: 'App-Name', value: 'irys-git' }
    ],
    color: '#333',
    icon: githirysIcon
  },
  {
    id: 'irys-names',
    name: 'Irys Names',
    tags: [
        { name: 'App-Name', value: 'Irys-Names' }
    ],
    color: '#4dfff0',
    icon: irysNamesIcon
  },
  {
    id: 'bridgebox',
    name: 'BridgeBox',
    tags: [
      { name: 'App-Name', value: 'Bridgbox-Email-Lit' }
    ],
    color: '#ff3142',
    icon: bridgeboxIcon
  },
  {
    id: 'irysdune',
    name: 'IrysDune',
    tags: [
      { name: 'App-Name', value: 'irys-dune-server' }
    ],
    color: '#0284c7',
    icon: irysduneIcon
  },
  {
    id: 'irys-proof-board',
    name: 'Irys ProofBoard',
    tags: [
      { name: 'App', value: 'IRYS Proofboard' }
    ],
    color: '#1affe8',
    icon: irysProofBoardIcon
  },
  {
    id: 'irysflip',
    name: 'IrysFlip',
    tags: [
      { name: 'App-Name', value: 'IrysFlip' }
    ],
    color: '#EF4444',
    icon: irysflipIcon
  },
];

export const getPresetById = (id: string): AppPreset | undefined => {
  return APP_PRESETS.find(preset => preset.id === id);
};

export const getPresetsByIds = (ids: string[]): AppPreset[] => {
  return ids.map(id => getPresetById(id)).filter(Boolean) as AppPreset[];
}; 