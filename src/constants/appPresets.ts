import type { AppPreset } from '../types';
import cmNoteIcon from '../assets/cmnote.png';
import githirysIcon from '../assets/githirys.png';
import irysNamesIcon from '../assets/irysnameservice.png';
import bridgeboxIcon from '../assets/bridgebox.png';
import irysduneIcon from '../assets/irysdune.png';
import irysProofBoardIcon from '../assets/irysproofboard.png';
import irysflipIcon from '../assets/irysflip.png';
import irysCrushIcon from '../assets/irys-crush.png';
import irysMemoryIcon from '../assets/irysmemoryicon.jpg';
import irysPfpIcon from '../assets/iryspfp.jpg';
import playHirysIcon from '../assets/playhirys.jpg';
import irysRealms from '../assets/irysrealms.jpg';
import irysSlotIcon from '../assets/irysslot.png';
import irys3dIcon from '../assets/irys-3d.webp';
import irysNoteIcon from '../assets/irys-note.png';
import irysVibeCodersHubIcon from '../assets/irysvibecodershub.jpg';
import irysPinterIcon from '../assets/irys-pinter.png';
import seedbackIcon from '../assets/seed-back.jpg';
import irysDriveIcon from '../assets/irys-drive.png';

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
    id: 'irys-realms',
    name: 'Irys Realms',
    tags: [
      { name: 'App-Name', value: 'Irys Realms' }
    ],
    color: '#d4a574',
    icon: irysRealms
  },
  {
    id: 'irys-pfp',
    name: 'Irys PFP',
    tags: [
      { name: 'IrysPFP-Data-Type', value: 'image' }
    ],
    color: 'lightgreen',
    icon: irysPfpIcon
  },
  {
    id: 'githirys',
    name: 'GitHirys',
    tags: [
      { name: 'App-Name', value: 'irys-git' }
    ],
    color: '#91c8e4',
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
    id: 'bridgbox',
    name: 'BridgBox',
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
    color: 'orange',
    icon: irysProofBoardIcon
  },
  {
    id: 'irysflip',
    name: 'IrysFlip',
    tags: [
      { name: 'App-Name', value: 'IrysFlip' }
    ],
    color: 'brown',
    icon: irysflipIcon
  },
  {
    id: 'irys-crush',
    name: 'IrysCrush',
    tags: [
      { name: 'App', value: 'IrysCrush' }
    ],
    color: '#ff8a00',
    icon: irysCrushIcon
  },
  {
    id: 'irys-slot',
    name: 'IrysSlot',
    tags: [
      { name: 'App', value: 'IrysSlot' }
    ],
    color: '#4B2E83',
    icon: irysSlotIcon
  },
  {
    id: 'play-hirys',
    name: 'PlayHirys',
    tags: [
      { name: 'App', value: 'PlayHirys' }
    ],
    color: '#303a4d',
    icon: playHirysIcon
  },
  {
    id: 'irys-memory',
    name: 'IrysMemory',
    tags: [
      { name: 'App-Name', value: 'IrysMemoryGameByPrmak' }
    ],
    color: 'magenta',
    icon: irysMemoryIcon
  },
  {
    id: 'irys-3d',
    name: 'Irys3D',
    tags: [
      { name: 'File-Type', value: 'image/jpeg' },
      { name: 'File-Type', value: 'image/png' }
    ],
    additionalTags: ['File-Owner', 'File-Name', 'File-Size'],
    color: '#8b5cf6',
    icon: irys3dIcon
  },
  {
    id: 'irys-note',
    name: 'IrysNote',
    tags: [
      { name: 'app', value: 'IrysNote' }
    ],
    color: '#06b6d4',
    icon: irysNoteIcon
  },
  {
    id: 'irys-vibe-coders-hub',
    name: 'Irys Vibe Coders Hub',
    tags: [
      { name: 'App-Name', value: 'IrysVibeCodersHub' }
    ],
    color: '#f97316',
    icon: irysVibeCodersHubIcon
  },
  {
    id: 'irys-pinter',
    name: 'Irys Pinter',
    tags: [
      { name: 'App-Name', value: 'Irys-Pinter' }
    ],
    color: '#40E0D0',
    icon: irysPinterIcon
  },
  {
    id: 'seedback',
    name: 'Seedback',
    tags: [
      { name: 'App-Name', value: 'Seedback' }
    ],
    color: '#22c55e',
    icon: seedbackIcon
  },
  {
    id: 'irys-drive',
    name: 'Irys Drive',
    tags: [
      { name: 'App-Name', value: 'IrysDrive' }
    ],
    color: '#0ea5e9',
    icon: irysDriveIcon
  },
];

export const getPresetById = (id: string): AppPreset | undefined => {
  return APP_PRESETS.find(preset => preset.id === id);
};

export const getPresetsByIds = (ids: string[]): AppPreset[] => {
  return ids.map(id => getPresetById(id)).filter(Boolean) as AppPreset[];
}; 