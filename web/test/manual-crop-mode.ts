import type { FitMode } from '../src/types/media';

const modes: FitMode[] = ['cover', 'contain', 'stretch', 'manual'];

if (!modes.includes('manual')) {
  throw new Error('Manual crop mode is missing');
}

console.log('manual crop mode ok');
