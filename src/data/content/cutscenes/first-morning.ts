import type { Cutscene } from '../../../engine/cutscene';

/**
 * First-morning cutscene at Breakpoint Farm (RF-14). Camera sweeps the farm
 * after the player wakes; an opening line from Aunt Nessa welcomes the
 * player; a starter Bell Pea Seeds bundle is granted; the `first-morning-seen`
 * flag is set so the scene never replays.
 */
export const FIRST_MORNING_CUTSCENE: Cutscene = {
  id: 'first-morning',
  skippableAfterFirstView: true,
  beats: [
    { kind: 'fade', to: 'in', seconds: 0.8 },
    { kind: 'cameraTo', target: { anchor: 'farm-overview' }, seconds: 1.4 },
    {
      kind: 'dialogue',
      speakerNpcId: 'Aunt Nessa',
      body: 'Welcome to Breakpoint Farm. The storm took a lot, but the soil remembers.',
    },
    { kind: 'cameraTo', target: { anchor: 'farmhouse-door' }, seconds: 1.2 },
    {
      kind: 'dialogue',
      speakerNpcId: 'Aunt Nessa',
      body: 'I left a packet of Bell Pea seeds on the porch. Plant when you are ready.',
    },
    { kind: 'giveItem', itemId: 'bell-pea-seeds', qty: 5 },
    { kind: 'setFlag', flag: 'first-morning-seen', value: true },
    { kind: 'fade', to: 'out', seconds: 0.6 },
  ],
};
