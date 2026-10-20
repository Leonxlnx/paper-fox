# Clouds family (`src/elements/clouds.js`, `src/elements/clouds-storm.js`)

Scalloped cut-paper clouds in every mood the film needs: cumulus banks, long streaks,
cloud seas filling valleys, the ref07 storm ceiling with its lit opening, and low mist
bands. Everything is procedural and deterministic per `seed`. Positions are film pixels
with the camera at rest (reference px x 1.1483).

```js
import { addCloud, addStreak, addCloudSea, CLOUD_PALETTES, PROFILES, hazePalette } from '../elements/clouds.js';
import { addStormCeiling, addMist, DECKLE } from '../elements/clouds-storm.js';
```

How a cumulus is built: it is a stack of **tiers**, back to front. Each tier is a row of
overlapping puffs with lobed (cauliflower) edges over a backing body. Every puff is its own
painted piece, with a palette tone chosen by where it sits relative to the light, a pillow
gradient, faceted paper relief, hairline creases, a bevel, and a contact shadow on the puffs
beneath it. Each tier is baked into **one sprite**. Tiers are drawn back to front, so each
tier drops a shadow on the tiers behind it and on the sky. Per frame, clouds only drift,
wander, bob and breathe (each tier swells slowly, out of phase with the others). Nothing is
repainted per frame.

Gallery: `src/gallery/clouds.js` has five 1.6 s segments that recreate the clouds of ref02,
ref01, ref10, ref07 and ref08 at their reference positions. Render them with
`node tools/snap.mjs clouds --gallery --t 0.8,2.4,4,5.6,7.2`. The skies, moon, sun and
hills in it are plain stand-ins.

## Which palette / preset matches which reference

| Reference | Palette | What to use (gallery segment) |
|---|---|---|
| ref01 dusk bridge | `'sunset'` | towering `addCloud` with `flatBase`, `lightPos` at the sun, `addStreak`s with `torn` + `rim` (seg 1, t 1.6-3.2) |
| ref02 night lake | `'night'` | moon bank with `warm` cream near the moon; long left cloud (seg 0, t 0-1.6) |
| ref04, ref05, ref09 | `'night'` | Moonlit cream crowns with lavender undersides. No gallery recreation; lift the tones with `tone: -0.1` for paler clouds |
| ref07 storm coast | `'storm'` (ceiling), `'stormBank'` (left banks) | `addStormCeiling`, merged torn banks, two `addMist` bands (seg 3, t 4.8-6.4) |
| ref08 aurora arch | `'sea'` | `addCloudSea` rows in the valleys plus a 3-tier cloud wall (seg 4, t 6.4-8.0) |
| ref10 dawn | `'dawn'` | cream `flatBase` banks over a lavender back bank (`tone: 0.5`), streaks (seg 2, t 3.2-4.8) |

ref03 and ref06 have no clouds.

## Depth and coordinates

- Default `z` is 9000, which is inside the AUTHORING clouds band (6000-12000). The gallery
  uses 7400-10000 for banks, 4200-1300 for cloud-sea rows, and 3000 / 1800 for mist.
- `x, y, w, h` is the cloud's box. **The base (underside) is at `y + h`.** Crowns rise from
  that line.
- A **profile** is `[[u, height], ...]`. `u` runs 0..1 across `w` and `height` is a fraction
  of `h`, measured up from the shared base line `y + h`. Between control points it
  interpolates with a cosine curve. Where the height drops below about `minR`, no puffs are
  placed, so a profile that falls to 0 ends the tier.
- `tierOpts[k].crown` lists puffs as absolute film px `[x, y, r, squash?]`.
- `tierOpts[k].dy` moves only that tier's **underside** (+ is down). The crown silhouette
  stays tied to `y + h`.
- `light` is a unit vector toward the light (screen space, y down). `lightPos: [x, y]` makes
  every puff face a point light (moon, sun) individually. `light` still drives the
  sprite edge light and the drop shadow direction. A light pointing downward (a sun below
  the cloud) is fine: the drop shadow's `dy` is clamped to at least 2 px.
- Each tier breathes about its anchor: the middle of its box horizontally, its base line
  vertically. `x` scales by `1 + 0.6b` and `y` by `1 + b`.
- Clouds drift. With the default `t0 = 0`, a cloud sits exactly where you authored it at
  t = 0 and moves `drift` px/s after that. Set `t0` to the time you composed the shot for.
  For long scenes or camera pans, check the frame edges (overscan).

## Cumulus banks

### `addCloud(S, opts) -> Layer`

Plans the cloud (or uses `opts.plan`), bakes one sprite per tier and adds a **single plane**
whose `render` draws the tiers with their shadows. `layer.plan` holds the geometry.

Layer and motion options (`CLOUD_DEFAULTS`):

| option | default | |
|---|---|---|
| `name` | `'cloud'` | layer name; sprites are `<name>-tier<k>` |
| `z` | 9000 | |
| `seed` | `'cloud'` | **always set a unique one**, or two clouds with the same options come out identical |
| `palette` | `'night'` | `CLOUD_PALETTES` key or a palette object |
| `drift` | 5 | px/s sideways (negative: leftward) |
| `sway` | 6 | px of slow noise wander on top of the drift |
| `bob` | 1.5 | px of vertical bob; its period is `1.7 * period` |
| `breathe` | 0.01 | tier swell, as a fraction of size |
| `period` | 7.5 | breathing period (s) |
| `t0` | 0 | time at which drift, wander and bob are exactly zero |
| `alpha` | 1 | number or `t => number` (whole plane) |
| `shadowAlpha`, `shadowBlur`, `shadowDist` | 0.55, 16, 11 | tier drop shadow. The offset is `(-L.x * dist * 0.8, max(2, -L.y * dist))`. `shadowAlpha: 0` turns it off |
| `res` | 1 | bake resolution |
| `mat` | fiber 0.55 + crumple 0.35 (scale 0.7) | sprite bake recipe, on top of the per-piece facet relief |
| `edge` | palette `edge` | silhouette edge light overrides `{ width: 2, soft: 0.8, hi, lo, hiColor }`. `false` does **not** turn it off; use `{ hi: 0, lo: 0 }` |
| `plan` | | reuse a plan from `planCumulus` / `planStreak` |

Geometry options (passed to `planCumulus`):

| option | default | |
|---|---|---|
| `x, y, w, h` | 0, 0, 600, 200 | box (base at `y + h`) |
| `tiers` | 3 | number of stacked tiers (1-4). The back tier is the tallest |
| `profile` | `'mound'` | `PROFILES` key or control points |
| `frontHeight` | 0.45 | front tier height relative to `h`. The tiers between scale linearly from 1 |
| `heights` | null | explicit tier heights, back to front (number or array) |
| `size` | 0.42 | crown puff radius as a fraction of the local tier height (randomised 0.72-1.22) |
| `minR`, `maxR` | 8, 1e4 | puff radius limits (px) |
| `spacing` | 1.15 | crown puff step, in radii |
| `lobes` | `[0, 6, 6, 7]` | lobe count per tier (number or array, back to front). It scales with puff size |
| `lumpy` | `[0.02, 0.12, 0.13, 0.14]` | lobe valley depth (fraction of r) per tier |
| `flatBase` | false | cut the underside straight at the base line (dawn and sunset banks, sea rows). Back tiers are then not lifted |
| `body` | false | smooth tapered body under the puffs (number: fraction of profile height; `true` = 0.62). Applies to **all tiers** |
| `fillers` | false | inner puffs below the crown, for the many internal edges of towering clouds |
| `squash` | 1 | vertical scale of every puff |
| `roughness` | 0.05 | fbm roughness added to the profile |
| `tierShift` | 0.03 | random horizontal offset of auto-profiled tiers (fraction of `w`) |
| `baseLift` | 0.05 | each tier behind the front ends this fraction of `h` higher (lumpy-base clouds only) |
| `underR` | 0.36 | size of the lumpy-underside puffs relative to tier height |
| `tierOpts` | `[]` | per-tier overrides, back to front (below) |

`tierOpts[k]` keys: `profile` (its own control points; this disables `tierShift` and the
random wiggle, and the height defaults to 1), `crown` (explicit puffs `[x, y, r, squash?]`;
no automatic crown puffs are generated), `height`, `dy`, `size`, `spacing`, `lobes`,
`lumpy`, `squash`, `minR`, `under` (lumpy underside row; default on for the front tier
unless `flatBase`), `underR`, `fillers`, `tone` (**absolute** base tone of this tier) and
`merge`. Any other key, `body` for example, is ignored.

Paint options (passed to `paintTier`):

| option | default | |
|---|---|---|
| `light` | `S.light` | unit vector toward the light |
| `lightPos` | none | point light `[x, y]`. Puffs face it, and the cloud-wide grade points from the cloud centre toward it |
| `lit` | palette `lit` | how much the lit side of the cloud brightens |
| `tone` | 0 | **shift** added to every tone (+ deeper shade, - paler) |
| `tones` | palette `tiers` | base tone per tier, as an array (back to front) |
| `warm` | none | `{ x, y, r, color, amt }` tints puffs near a light source. Falloff is `amt * (1 - d/r)^1.5` (moonlit cream) |
| `merge` | palette `merge` | paint the tier as one cut piece (bool or per-tier array). Bumps then show only on the silhouette, and each bump gets a soft dome of light |
| `accent` | 0.2 | merged tiers only: the fraction of the biggest crown puffs (r > max(24, 0.6 rMax)) that are cut again as separate discs on top |
| `texture` | `CLOUD_TEXTURE` + palette `texture` | overrides, or `false` for flat paper |
| `creases` | 3 | crease count per puff (scaled by r/40, clamped 0.5-2.5x) |
| `torn` | none | `{ amp, freq: 0.14, fine: 0.7 }` gives torn edges (amp defaults to 1.3 on puffs, 1.1 on the body) |
| `rim` | none | `{ width: 1, color: palette rim or '#f6f0e4' }` shows the white paper core around edges (use it with `torn`) |
| `bevel` | 1 | per-puff bevel strength multiplier |
| `shadow` | `{ blur: 9, dist: 3 }` | **per-puff contact shadow** overrides, or `false`. This is not the tier drop shadow |

### Palettes: `CLOUD_PALETTES`

Keys: `night`, `sunset`, `dawn`, `sea`, `stormBank`, `storm`. Each palette is an object:

- `ramp`: tones from fully lit (u = 0) to deepest shade (u = 1)
- `tiers`: base tone of the back tier through the front tier (interpolated for other counts)
- `lit`, `vert`, `spread`, `jitter`: lit-side brightening, darkening toward the base, tone
  range across one puff, and random scatter
- `hi`, `lo`, `bevel: [hi, lo]`: bevel colours and strengths
- `shadow`: contact shadow colour
- `crease`, `creaseAlpha`: crease colour and strength
- `facet: [pale, deep]`: tints of the relief shadows on tones below and above 0.4
- `rim`, plus `rimLit` on `storm`: paper core colours
- `merge`, `texture`: defaults for the paint options of the same names
- `edge`: `{ hi, lo }` for the sprite edge light

Tier tone order matters. `night` and `sea` have a light back tier and deeper front tiers
(lavender undersides). `sunset` and `dawn` run the other way, with the front tiers paler.
`merge` defaults: `night` merges only the back tier, `sea` the back of two tiers, `sunset`
and `dawn` merge every tier, and `stormBank` and `storm` merge none.

To make your own, spread one: `{ ...CLOUD_PALETTES.night, ramp: [...] }`.
`hazePalette(palette, color, amt)` returns a copy with the ramp mixed toward a haze colour
(`crease` and `hi` get half of `amt`). Use it for distant clouds.

### `PROFILES`

`mound` (default), `rise` (high on the right), `fall` (high on the left), `tower`, `band`
(flat-topped, used by cloud seas), `streakR` / `streakL` (thick head on the right / left,
long tapering tail), `lens` (centred sliver).

## Streaks

### `addStreak(S, opts) -> Layer`

A long thin cloud (ref01, ref10). It is `addCloud` with `planStreak` geometry and these
defaults: `name: 'streak'`, `drift: 7`, `breathe: 0.006`, `merge: true`, `accent: 0`.
`planStreak` defaults: `profile: 'streakR'`, `tiers: 2`, `frontHeight: 0.6`,
`size: 0.55`, `minR: 6`, `spacing: 1.3`, `lobes: 0`, `lumpy: 0`, `flatBase: true`,
`body: 0.78`, `squash: 0.72`, `roughness: 0.03`, `tierShift: 0.04`. Every option you pass
wins. `'streakL'` puts the head on the left and `'lens'` centres it. `tiers: 1` with
`tones: [u]` gives a single sliver.

## Cloud sea

### `addCloudSea(S, opts) -> Layer[]`

Rows of flat-based banks filling a valley (ref08). Rows run from far (small, hazy, high)
to near (big, white, low), each on its own plane for parallax. Returns the row layers, far
first.

| option | default | |
|---|---|---|
| `x`, `w` | -300, 2520 | horizontal extent of every row (full width with overscan) |
| `y0`, `y1` | 520, 760 | base line of the farthest / nearest row |
| `h0`, `h1` | 60, 150 | row height far / near |
| `rows` | 4 | |
| `z0`, `z1` | 2600, 1300 | depth of the farthest / nearest row |
| `haze`, `hazeAmt` | `'#7d86b8'`, 0.4 | the far row takes `hazeAmt` of the haze colour, the near row none |
| `palette`, `seed`, `name` | `'sea'`, `'sea'`, `'sea'` | rows are `<name>-row<i>`, seeded `<seed>:<i>` |

Per-row defaults (any of these can be overridden): `tiers: 2`, `profile: 'band'`,
`heights: [1, 0.55]`, `flatBase: true`, `fillers: true`, `roughness: 0.3`,
`size: 0.45`, `minR` 10 to 18, `spacing: 1.05`, `lobes: [4, 6]`, `lumpy: [0.05, 0.1]`,
`drift` 2 to 5, `breathe: 0.006`, `shadowAlpha` 0.3 to 0.5. Any other `addCloud` option
(`light`, `alpha`, `t0`, ...) goes to every row. `name`, `x`, `w`, `y`, `h`, `z`, `seed`
and `palette` are set per row and cannot be overridden.

## Storm ceiling (`clouds-storm.js`)

### `addStormCeiling(S, opts) -> Layer[]`

The ref07 ceiling is a tunnel of cloud seen from below. Big deckle-edged discs are laid on
contours around an opening. The innermost contour is lit cream by the light pouring
through, and each contour further out is darker and larger. Discs nearer the opening are
laid first, so every free edge you can see faces the light and catches a gold (inner) or
slate (outer) rim. The contours are grouped into ring sprites on slightly different planes,
which gives the opening depth when the camera moves. `layers.plan` holds the geometry.

Layers added, in order:

| layer | z | |
|---|---|---|
| `<name>-gapsky` | `gapZ` (17000) | soft disc of sky colour seen through the opening (if `gapSky`) |
| `<name>-glow` | `z * 1.2` | additive glow in the opening (if `glow`) |
| `<name>-ring<k>` | `z * (1 - dz * k)` | k = 0 is the lit inner ring (farthest) and the last ring is the dark outer ring with the hanging edge |
| `<name>-spill` | just in front of the outermost ring | `screen` light spilling over the inner rim |

Place the guiding star or a moon between `gapZ` and `z` so that it shows in the opening.

| option | default | |
|---|---|---|
| `z`, `dz` | 9000, 0.05 | depth of the innermost ring; each outer ring is `dz` nearer (8550, 8100, 7650 by default) |
| `gap` | `{ x: 1500, y: 145, rx: 150, ry: 110 }` | the opening. **It replaces the default as a whole**, so pass all four keys |
| `irregular` | 0.22 | how ragged the opening's outline is |
| `x, y, w` | -260, -240, W + 520 | region the ceiling covers |
| `bottom`, `sag` | 300, 50 | mean y of the hanging lower edge and how much it wanders |
| `rings`, `ringStep` | 4, 0.55 | number of ring sprites; ring width in gap radii |
| `size`, `growth`, `inset` | 46, 0.35, 0.1 | disc radius at the rim, how fast it grows outward, and how far the first contour reaches into the opening |
| `palette` | `'storm'` | |
| `litAngle`, `litBias` | 0.55π, 0.55 | the brightest side of the rim, as an angle from the gap centre (0 = right, π/2 = below), and how much darker the opposite side is |
| `reach`, `near`, `far`, `mottle` | 1.2, 0.02, 0.98, 0.22 | gap radii the light reaches; disc tone at the rim and beyond the reach; tone scatter of the dark discs |
| `gapSky`, `gapZ` | `'#3a4f68'`, 17000 | `false` leaves the opening to your sky layer |
| `glow` | `{ color: '#ffd89a', alpha: 0.6, r: 1.7 }` | `r` is in units of max(rx, ry). Pass a complete object, or `false` |
| `drift`, `breathe`, `period`, `t0` | 2, 0.006, 9, 0 | every layer drifts together; each ring swells uniformly about the gap centre (phase 0.21 k) |
| `shadowAlpha`, `shadowBlur` | 0.6, 16 | ring drop shadows (the offset comes from the scene's `shadow.dist` and `light`) |
| `mat`, `seed`, `name` | fiber 0.5 + crumple 0.3 (scale 0.6), `'storm'`, `'storm'` | |
| `plan` | | reuse a `planStorm` result |

There is **no `alpha` option**. To fade the ceiling, wrap `layer.alpha` on the returned
layers, as the gallery's `segment()` does. The glow and spill alphas pulse between 80 % and
100 % on a 6.5 s cycle.

## Mist

### `addMist(S, opts) -> Layer`

A low band of translucent tissue strands with feathered edges. The band is uneven along
its length (thick drifts, thin veils, gaps), some strands curl up at one end, and the
densest strands have a crisper pale core. It is baked into one sprite with no edge light
and no shadow.

| option | default | |
|---|---|---|
| `x, y, w, h` | -300, 500, 2520, 180 | band box (strands and their feathering stay inside it) |
| `z` | 1600 | |
| `color` | `'#c4cadf'` | tissue colour |
| `alpha` | 0.55 | **strand opacity baked into the sprite**, not a fade (a number only) |
| `strands`, `soft`, `gaps` | 26, 10, 0.35 | strand count, feather radius (px), patchiness 0..1 |
| `drift` | 12 | px/s, plus a ±10 px noise wander that is not zeroed at `t0` |
| `breathe`, `period` | 0.18, 8 | the layer's opacity swings between `1 - breathe` and 1; vertical bob of 3 px at `1.3 * period` |
| `seed`, `name`, `t0` | `'mist'`, `'mist'`, 0 | |

`drawMist(ctx, { x, y, w, h, seed, color, alpha, strands, soft, gaps })` paints the strands
inside your own sprite's `draw`. It uses blur filters, so call it at bake time only.

## Lower-level API (custom sprites)

Use these to put a cloud inside a bigger sprite, or to drive tiers yourself.

- `planCumulus(o) -> plan` and `planStreak(o) -> plan`. A plan is
  `{ x, y, w, h, base, flatBase, tiers: [{ k, base, puffs: [{ x, y, r, squash, role: 'crown'|'inner'|'under', pts }], fill, body, tone, merge, box }] }`.
  You can edit the plan, for example to remove puffs, then pass it as `plan`.
- `drawCumulus(ctx, plan, paintOpts)` paints all tiers into `ctx`, back to front, each tier
  casting a contact shadow on the tiers behind it. Use it for static clouds baked inside a
  larger sprite.
- `paintTier(ctx, plan, k, paintOpts)` paints one tier. With `flatBase` it clips at the base line.
- `bakeCloudTiers(S, plan, o) -> [{ s, ax, ay, phase }]` and
  `drawCloudTiers(ctx, tiers, t, o, env)` are the bake and per-frame halves of `addCloud`.
  `CLOUD_DEFAULTS` is not exported, so `o` must carry `name`, `seed`, `res`, `mat`,
  `shadowAlpha`, `shadowBlur`, `shadowDist`, `breathe` and `period` itself.
- `driftAnim({ seed, drift, sway, bob, period, t0 }) -> t => { x, y }` is a plane `anim`.
- `paintCloudPiece(ctx, pts, { palette, u = 0.3, lit = [0.4, -0.9], cx, cy, r, squash = 1, rng, smooth = true, torn, rim, texture, creases = 3, bevel = 1, shadow = { blur: 8, dist: 3 }, vary = 0.025 }) -> Path2D`
  paints one graded, textured, creased, bevelled cloud piece. `cx, cy, r` and an `RNG` are required.
- `puffShape(cx, cy, r, rng, { lobes = 0, lobeAmp = 0.1, wobble = 0.012, squash = 1, rot = 0 }) -> pts`
  returns a lobed circle outline.
- `profileFn(points, seed = 1, rough = 0) -> u => height`.
- `cloudTone(palette, u) -> colour`, `resolvePalette(p)` (undefined gives night; an unknown
  key throws), `hazePalette(palette, color, amt)`.
- Paper helpers:
  - `CLOUD_TEXTURE = { facets: 1.3, facetScale: 1, crumple: 0.15, crumpleScale: 0.32, light: 1 }`.
    Amounts above 1 stack extra passes.
  - `cloudPaperIn(ctx, path, box, rng, tex, tint)` applies it.
  - `facetTexture()` is the cached 384 px tileable Voronoi relief.
  - `creasesIn(ctx, path, cx, cy, r, rng, { count, color, alpha, squash })` draws hairline creases.
  - `contactShadow(ctx, path, { color, blur, x, y })` lands only on already-painted pixels (source-atop).
  - `pieceBevel(ctx, path, box, { light, width, hi, lo, hiColor, loColor })` is a cheap bevel for hundreds of pieces.
- Storm: `planStorm(o)` returns `{ x, y, w, bottom, gap, rings: [{ k, puffs, box, back }], region, qOf, contour, edgeY }`.
  `paintStormRing(ctx, plan, k, o)` paints one ring.
- `DECKLE = { amp: 1.1, freq: 0.3, fine: 1.3, step: 2.5 }` is the pinking-shear torn edge of the
  storm discs. Use `torn: DECKLE` to give your own banks the same edge.

## Examples (from the gallery)

```js
// ref02: moon bank. Back tier from explicit crown puffs, merged; moonlight warms puffs near the moon.
addCloud(S, {
  name: 'moonbank', z: 9000, t0, x: 1382, y: 137, w: 640, h: 170, tiers: 3, seed: 'ref02-moonbank',
  palette: 'night', light: [-0.45, -0.89], warm: { x: 1562, y: 166, r: 260, color: '#ffd7a8', amt: 0.2 },
  tierOpts: [
    { crown: [[1405, 288, 24, 0.55], [1452, 285, 26, 0.55], [1500, 280, 27, 0.6], [1542, 260, 30, 0.95], [1595, 260, 27],
              [1662, 245, 55], [1792, 214, 77], [1905, 215, 76], [2000, 222, 70]], lobes: 0, tone: 0.12, merge: true },
    { profile: [[0.28, 0], [0.31, 0.25], [0.42, 0.38], [0.52, 0.5], [0.6, 0.62], [0.68, 0.8], [0.8, 0.82], [0.88, 0.74], [1, 0.75]],
      size: 0.36, minR: 14, lobes: 6, lumpy: 0.15, tone: 0.42 },
    { profile: [[0, 0.04], [0.12, 0.07], [0.3, 0.11], [0.4, 0.2], [0.5, 0.28], [0.6, 0.34], [0.8, 0.32], [1, 0.34]],
      size: 0.6, minR: 12, lobes: 6, lumpy: 0.15, tone: 0.5, under: true, underR: 0.6 },
  ],
});
```

```js
// ref01: torn streak lit by the low sun (the sun is below the cloud, so light points down).
const sun = [1626, 363];
addStreak(S, {
  name: 'streakA', z: 8000, t0, x: 1450, y: 50, w: 520, h: 95, seed: 'ref01-streakA', palette: 'sunset',
  lightPos: sun, light: [0, 1], torn: { amp: 1.6, freq: 0.12 }, rim: { width: 1.2, color: '#ffe3b8' },
});
// ref10: one small sliver.
addStreak(S, { name: 'streakLow', z: 7500, t0, x: 1270, y: 248, w: 150, h: 34, seed: 'ref10-low-streak', profile: 'lens', palette: 'dawn', lightPos: [1507, 356] });
```

```js
// ref07: ceiling with the opening around the star, merged torn banks, two mist bands.
addStormCeiling(S, { z: 9000, t0, seed: 'ref07', gap: { x: 1505, y: 140, rx: 175, ry: 125 }, bottom: 320, sag: 30 });
const bank = { palette: 'stormBank', light: [0.9, -0.35], torn: { amp: 2.2, freq: 0.09, fine: 1.2, step: 2.5 },
  rim: { width: 1 }, merge: true, accent: 0.25, lobes: 3, lumpy: 0.06, creases: 2 };
addCloud(S, { ...bank, name: 'bankA', z: 7600, t0, x: 330, y: 80, w: 620, h: 200, tiers: 2, seed: 'ref07-bankA', tierOpts: [/* two profiled tiers */] });
addMist(S, { name: 'mist-far', z: 3000, t0, x: -300, y: 330, w: 2520, h: 170, seed: 'ref07-mist1', color: '#a3acc8', alpha: 0.7 });
```

```js
// ref08: a cloud wall and seas in two valleys (narrow rows keep the bake cheap).
addCloud(S, { name: 'wall', z: 9000, t0, x: 120, y: 20, w: 760, h: 300, tiers: 3, seed: 'ref08-wall', palette: 'sea',
  profile: [[0, 0.95], [0.2, 1], [0.4, 0.85], [0.6, 0.62], [0.8, 0.4], [1, 0.25]], size: 0.3, minR: 14, light: [0.7, -0.7] });
addCloudSea(S, { name: 'under', x: 700, w: 1000, y0: 760, y1: 1000, h0: 90, h1: 150, rows: 3, z0: 2200, z1: 1300,
  seed: 'ref08-under', light: [0.6, -0.8] });
```

## Performance

Timings were measured in headless Chrome with GPU rasterization on the dev machine. Each
figure is the build plus the first draw, which flushes the deferred bake work.

| element | pieces | bake |
|---|---|---|
| shared textures (once per page) | | `facetTexture` about 60 ms. Unless an earlier layer already built the engine's fibre and crumple tiles, the first cloud on a page builds them (about 1.1-1.4 s together with that cloud) |
| `addCloud`, typical bank | 55-105 puffs | 0.06-0.3 s |
| `addStreak` | about 50 | about 0.05 s |
| `addStormCeiling` (gallery gap) | about 205 discs, 7 layers | 0.5-0.7 s |
| `addCloudSea`, gallery valley (3 rows x 1000 px) | about 475 | about 0.4 s |
| `addCloudSea` **defaults** (4 rows x 2520 px, fillers) | about 1700 | **2.4-3.3 s**, the most expensive call in the family |
| `addMist` | 26 strands | about 0.1 s |

The whole gallery (5 segments plus stand-ins) builds in about 3.7 s.

- Keep cloud seas as narrow as the visible gap and as few rows as the shot needs.
  `fillers: false` or a larger `minR` cuts the puff count (defaults without fillers come to
  about 1060 puffs and 1.3 s).
- Per frame, each tier or ring costs two `drawImage` calls (shadow, then paper), so the
  per-frame cost of this family is negligible. A full gallery frame renders in about 9 ms.
- Never call `paintTier`, `drawCumulus` or `drawMist` from a `render` function. They are
  bake-time painters.
- `res` above 1 multiplies bake memory and time. Clouds sit at z 6000+ and rarely need it.
