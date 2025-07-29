import type { AppPreset } from '../types';
import cmNoteIcon from '../assets/cmnote.png';
import githirysIcon from '../assets/githirys.png';
import irysNamesIcon from '../assets/irysnameservice.png';
import loftyIcon from '../assets/lofty.png';
import bridgeboxIcon from '../assets/bridgebox.png';
import irysduneIcon from '../assets/irysdune.png';

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
];

export const getPresetById = (id: string): AppPreset | undefined => {
  return APP_PRESETS.find(preset => preset.id === id);
};

export const getPresetsByIds = (ids: string[]): AppPreset[] => {
  return ids.map(id => getPresetById(id)).filter(Boolean) as AppPreset[];
}; 