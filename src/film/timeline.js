// The one source of timing for picture and sound.
//
// 80 BPM in 4/4: a beat is 0.75 s (45 frames at 60 fps), a bar 3 s. Every scene owns
// two bars (6 s) and every scene change sits on a bar line, so the soundtrack's
// section changes land exactly on the cuts.

export const FPS = 60;
export const BPM = 80;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const SLOT = BAR * 2;           // seconds each scene owns
export const LEAD = 1.25;              // pre-roll each scene renders before its slot (for transitions)

// Story order: dusk -> night -> forest -> canyon -> peaks -> cave -> storm -> aurora -> portal -> dawn.
export const SCENE_IDS = ['s01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09', 's10'];

export const DURATION = SLOT * SCENE_IDS.length; // 60 s

// Transition into scene k (k >= 1) happens around its bar line k * SLOT.
//   type     transition implementation in transitions.js
//   dur      seconds, centred on the bar line unless `offset` shifts it
//   blur     motion-blur sub-samples for the final render (fast moves only)
export const TRANSITIONS = [
  null,
  { type: 'trackPine', dur: 1.5, blur: 6 },        // dusk -> night lake
  { type: 'throughBranches', dur: 1.5, blur: 6 },  // night lake -> firefly forest
  { type: 'curtains', dur: 1.5, blur: 5 },         // forest -> canyon
  { type: 'craneClouds', dur: 1.75, blur: 4 },     // canyon -> snow peaks
  { type: 'rockIris', dur: 1.5, blur: 0 },         // peaks -> crystal cave
  { type: 'lightFlash', dur: 1.0, blur: 0 },       // cave -> storm
  { type: 'waveWipe', dur: 1.75, blur: 5 },        // storm -> aurora
  { type: 'popup', dur: 1.75, blur: 4 },           // aurora -> portal
  { type: 'lightFlood', dur: 1.75, blur: 0 },      // portal -> dawn
];

// Film time -> local time of scene k.
export const localTime = (k, t) => t - (k * SLOT - LEAD);

// What is on screen at film time t.
export function segmentAt(t) {
  const n = SCENE_IDS.length;
  for (let k = 1; k < n; k++) {
    const tr = TRANSITIONS[k];
    if (!tr) continue;
    const mid = k * SLOT + (tr.offset ?? 0);
    const a = mid - tr.dur / 2, b = mid + tr.dur / 2;
    if (t >= a && t < b) {
      return { kind: 'transition', k, from: k - 1, to: k, p: (t - a) / tr.dur, tr, tA: localTime(k - 1, t), tB: localTime(k, t) };
    }
  }
  const k = Math.max(0, Math.min(n - 1, Math.floor(t / SLOT)));
  return { kind: 'scene', k, t: localTime(k, t) };
}
