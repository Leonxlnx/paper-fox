# Authoring guide

Everything in this film is drawn in code. There are no image assets: every texture,
leaf, star and fur tuft is generated from seeded randomness at build time, baked into
paper, then moved by a multiplane camera at render time.

## Mental model

A scene is a **diorama of paper cut-outs** standing at different distances from the lens.

1. **Build (once per scene).** You paint flat-coloured shapes into *sprites*. Each sprite is
   then *baked*: paper texture (fibre, crumple or stone speckle) is soft-lit into it, the
   cut edge gets a lit and an unlit bevel, and a blurred silhouette is kept for its drop shadow.
2. **Render (every frame).** Planes are drawn far to near. Each plane first draws the drop
   shadows of its sprites onto everything behind it, then the sprites themselves. The camera
   transform per plane comes from its depth `z`, so a pan or dolly produces real parallax.

What makes it read as layered paper, in order of importance:

- **Drop shadows between planes.** Every cut-out casts a soft shadow onto what is behind it.
  This is the single biggest cue. Never turn it off for foreground pieces.
- **Many overlapping pieces.** Reference images are built from hundreds of small cut pieces
  (fur scales, needle tiers, petals, rock facets). Large flat areas look like vector art.
  Build things from pieces, with contact shadows (`piece(..., { shadow })`) between them.
- **Paper texture** on everything (materials below), slightly different per piece.
- **Edge light.** Thin bright band on edges facing the light, dark band on the far side.
- **Torn edges with a white core** on clouds, snow, water foam, some hills (`torn` + `rim`).
- **Atmospheric depth.** Far planes are lighter, bluer/purpler, lower contrast and simpler.
- **Glow** for light sources (moon, stars, sun, portal, fireflies, crystals), drawn additively.

## Coordinates and depth

- Author in **1920x1080 screen pixels as seen with the camera at rest**. `W`, `H` from `core/stage.js`.
- `z` is distance from the lens. `F = 1000` is the reference plane (moves 1:1 with a pan).
- Standard depth bands (keep to these so scenes cut together):

| Band | z |
|---|---|
| sky backdrop | 20000 |
| stars, moon, sun | 12000-16000 |
| clouds | 6000-12000 |
| far mountains | 4000-8000 |
| mid mountains / far hills | 2500-4000 |
| distant forest, far shore | 1600-2500 |
| midground (lake, river, mid trees) | 1150-1600 |
| hero plane: fox and the rock it stands on | 900-1000 |
| near foreground (rocks, bushes) | 650-850 |
| foreground flowers / leaves framing the shot | 420-600 |

- **Overscan.** The camera moves. Planes must extend past the frame: backgrounds by at
  least 220 px on every side, near planes (z < 800) by 300 px left/right/bottom.
  A missing edge shows as the scene background colour; check renders at the ends of the
  camera move.
- Sprites are only as big as their box (`x, y, w, h`), so a single flower is a small sprite.

## Core API

```js
import { Scene, W, H, F } from '../core/stage.js';
import { RNG, noise } from '../core/rng.js';
import { piece, pathOf, bevelBands, setShadow, clearShadow, linear, radial, glow } from '../core/piece.js';
import { ridge, closeDown, tear, blob, ellipse, leaf, transform, subdivide, smoothPath, along, TAU } from '../core/geom.js';
import { flecks, MATERIALS } from '../core/paper.js';
import { drawSprites } from '../core/sprite.js';
import { mix, shade, adjust, vary, rgba, haze } from '../core/color.js';
import { E, prog, osc, clamp, lerp, smoothstep, lmix } from '../core/ease.js';
```

### Scene

```js
export default function () {
  return new Scene({
    id: 's02',
    duration: 7.5,
    background: '#10142c',             // shows only through gaps: keep it scene-appropriate
    light: [0.55, -0.83],              // unit vector pointing toward the key light (screen space, y down)
    shadow: { alpha: 0.5, dist: 9, blur: 10 }, // default drop shadow: opacity, offset length, blur
    post: { bloom: 0.35, threshold: 0.62, vignette: 0.25, grain: 0.05 },
    camera: (t) => ({ x: 0, y: 0, z: 0, zoom: 1, roll: 0 }),
    build(S) { /* add planes here */ },
  });
}
```

- `S.plane(z, spriteOpts, layerOpts)` bakes one sprite and puts it on its own plane.
- `S.sprite(spriteOpts)` bakes a sprite you place yourself (for animated pieces).
- `S.add({ z, sprites, render, anim, blend, alpha, shadow })` adds a plane:
  - `sprites`: `[{ s, x, y, ax, ay, rot, sx, sy, alpha }]` placements. `(ax, ay)` is the anchor in
    the sprite's authored coordinates, `(x, y)` where that anchor lands (default: unchanged).
  - `render(ctx, t, env)`: per-frame drawing in authored coords (camera already applied).
    Use `drawSprites(ctx, items, env.shadow)` to draw moving sprites with shadows.
  - `anim(t)`: whole-plane motion `{ x, y, rot, sx, sy, ox, oy }` (drift, bob, sway about `ox, oy`).
  - `blend`: e.g. `'lighter'` or `'screen'` for glows.
  - `alpha`: number or `t => number`.
  - `shadow`: `{ alpha, dx, dy }` override for this plane's sprite shadows.

spriteOpts:

```js
{
  name: 'moon',
  x, y, w, h,              // authored box the drawing fits in (include room for rims/shadows)
  res: 1,                  // bake resolution. Use 1.25-1.5 for planes z < 800 the camera pushes into
  mat: 'paper',            // paper | smooth | crumpled | sky | stone | felt | none, or a custom recipe
  edge: { width: 1.6, hi: 0.3, lo: 0.28, soft: 0.7 },  // silhouette edge light, or false
  shadow: { blur: 10, alpha: 0.5, dx, dy },          // this sprite's drop shadow, or false
  draw(ctx) { ... },       // paint flat shapes in authored coordinates
}
```

Materials: `paper` (fibre + light crumple: default for foliage, fur, hills), `smooth`
(fibre only), `crumpled` (strong crumple: moon, clouds), `sky` (crumpled backdrop),
`stone` (granite speckle: rocks, cliffs, standing stones), `felt` (fuzzy: flower cones,
tansy balls). A custom recipe is `[{ tex: 'fiber'|'crumple'|'stone'|'felt', amt, scale, mode }]`.

### Pieces

`piece(ctx, pts, opts)` draws one cut-out and returns its `Path2D`:

```js
piece(ctx, pts, {
  fill: '#d9622b',                 // colour, gradient or pattern
  smooth: false,                    // Catmull-Rom through pts instead of straight edges
  torn: { amp: 3, freq: 0.08, fine: 0.8, seed: 4 },   // hand-torn outline
  rim: { color: '#f6f0e4', width: 2, torn: {...} },    // white paper core showing around a torn edge
  bevel: { light: S.light, width: 1.5, hi: 0.25, lo: 0.2, soft: 0.5 },  // per-piece edge light
  shadow: { color: 'rgba(20,10,30,0.4)', blur: 6, x: -1, y: 3 },        // contact shadow on what is below
});
```

Geometry helpers (`core/geom.js`): `leaf(len, width, { belly, curl, tipRound })` (petal,
fur scale, needle frond: base at origin, tip at `(0, -len)`), `transform(pts, { x, y, rot, sx, sy })`,
`ridge(x0, x1, baseY, { amp, freq, sharp, seed })` + `closeDown(top, bottom)` for horizons,
`blob`, `ellipse`, `tear`, `subdivide`, `along(polyline, t)`.

### Randomness and time

- **Never** use `Math.random`, `Date.now` or `performance.now` in scene code. Use
  `new RNG('some-label')` (`next, range, int, pick, chance, gauss, fork`) and
  `noise(seed).n2(x, y) / .n1(x) / .fbm(x, y, oct)` (range about -1..1).
- Render functions are pure functions of `t`. The same `t` must give the same frame.
- Animations must be continuous for `t` in `[0, duration]` with no jumps or resets.
  Prefer slow, weighted motion: `osc(t, period, phase)`, `noise(seed).n1(t * freq)`, eases in `E`.

## Performance budget

- Build (bake) of a full scene: aim under 6 s. Render of a frame: aim under 60 ms.
- Static art goes in baked sprites. Only things that actually move are drawn per frame,
  and even those should be baked sprites that are transformed, not repainted.
- Don't create canvases or gradients per frame in hot loops when a baked sprite would do.

## Tools

```powershell
# render stills (writes out/snaps/<id>_t<time>.png, prints build/render ms)
node tools/snap.mjs s02 --t 0,3,6 --out out/s02
node tools/snap.mjs fox --gallery --t 0,1.5 --out out/fox
# stack the reference above the render for comparison (scenes sNN pick refNN automatically)
$env:PAPERFOX_REFS = '<refs folder>'; node tools/snap.mjs s02 --t 3 --compare --out out/s02
# contact sheet of frames over time (motion check); --crop x,y,w,h tiles one region at full res
node tools/sheet.mjs s02 --from 0 --to 7.5 --n 12 --cols 4 --out out/s02/sheet.png
node tools/sheet.mjs fox --gallery --from 0 --to 2 --n 8 --crop 400,300,700,600 --out out/fox/tail.png
# camera override x,y,z,zoom (check overscan at the extremes of your camera move)
node tools/snap.mjs s02 --t 3 --cam -60,0,-80,1 --out out/s02
# side by side: reference left, render right, both mapped to 1920x1080 space (crop in film px)
node tools/compare.mjs out/s02/s02_t3.00.png $env:PAPERFOX_REFS\ref02_night_lake.png --crop 300,250,700,500 --out out/s02/fox_cmp.png
# crop a region (reference images are 1672x941; renders are 1920x1080)
ffmpeg -hide_banner -loglevel error -y -i in.png -vf "crop=w:h:x:y" out.png
# open the live player: node tools/serve.mjs then http://localhost:5173/?scene=s02
```

The commands are written for PowerShell; in a POSIX shell use `PAPERFOX_REFS=... node ...`.
The reference illustrations the scenes were matched against are not part of this
repository. Point `PAPERFOX_REFS` at a folder of your own `refNN_*.png` images to use
the comparison tools; everything else works without them.

Also useful: `node tools/transition-sheet.mjs <type> <sceneA> <sceneB>` (a transition
across its progress) and `node tools/forensics.mjs <video>` (per-frame motion check of a
render: pops, stalls, motion profile).

## Quality loop

Work in rounds. Each round: render, look at the render and the reference side by side at
full size and in crops, write down the 5 biggest visible differences, fix them, repeat.
Judge like an art director, not a programmer:

- Does it read as **layered paper**? Shadows between planes, piece-built detail, texture, edge light.
- Is the **composition** the same (positions, sizes, horizon lines, silhouettes)?
- Are the **colours** the same (sample them; reference images are the truth)?
- Is the **density of detail** comparable, or does it look emptier and flatter?
- Are **light sources** glowing like the reference?
- Does motion feel **calm, weighted and alive** (no jitter, no linear robotic sliding)?
