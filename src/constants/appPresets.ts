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
];

export const getPresetById = (id: string): AppPreset | undefined => {
  return APP_PRESETS.find(preset => preset.id === id);
};

export const getPresetsByIds = (ids: string[]): AppPreset[] => {
  return ids.map(id => getPresetById(id)).filter(Boolean) as AppPreset[];
}; 