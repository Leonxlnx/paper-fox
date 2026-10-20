// Story events shared by picture and sound (film seconds). Scenes receive these as
// local times via localTime(k, t) so a lightning flash and its thunder stay locked.

import { BEAT, BAR } from './timeline.js';

const at = (bar, beat = 0) => (bar - 1) * BAR + beat * BEAT;

export const CUES = {
  starAppears: at(1, 2),          // dusk: the guiding star blinks on above the hills
  lightning: [at(13, 0), at(13, 2.5), at(14, 2)],   // the first one is the cut into the storm
  portalOpens: at(17, 2),         // the ring flares as the star descends into it
  starFlower: at(19, 1.5),        // dawn: the star settles into a glowing flower
};
