# Sky family (`src/elements/sky.js`)

Backdrops and everything that hangs in them: crumpled paper skies, the gold star
field, **the guiding star** (the film's recurring story device), the moon, the sun and
the aurora. Everything is procedural. Positions are film pixels with the camera at
rest. Defaults match the references, sampled colour for colour.

```js
import {
  addSky, addStarField, addGuidingStar, addMoon, addSun, addAurora, addGlow,
  GUIDE_PRESETS, REF02_STARS, REF02_DOTS,
} from '../elements/sky.js';
```

Each element comes in two flavours:

- `drawX(ctx, ...)` paints flat shapes inside a sprite's `draw(ctx)` (static art you bake yourself).
- `addX(S, opts)` bakes sprites and adds animated planes to a `Scene`. Every `addX` except
  `addSky` takes `alpha` (a number or `t => number`) that fades all of its planes, which you
  can use for entrances and cuts. They return the layers they add.

Depth defaults follow `docs/AUTHORING.md`: backdrop 20000, aurora 17000, star field 15000,
moon / sun 14000, guiding star 12000. All motion is a pure function of `t`, deterministic
and continuous.

## Which reference each preset matches

| Reference | Backdrop | Celestial | Guiding star |
|---|---|---|---|
| ref01 dusk bridge | `palette: 'dusk'` | `addSun({ kind: 'sunset' })` | `GUIDE_PRESETS.dusk` (4 points + trail) |
| ref02 night lake | `palette: 'night'` | `addMoon()` defaults, `REF02_STARS` / `REF02_DOTS` | (none) |
| ref03 firefly forest | `'night'` | (none) | `GUIDE_PRESETS.forest` |
| ref04 waterfall canyon | `palette: 'twilight'` | `addMoon({ r: 88 })` | `GUIDE_PRESETS.canyon` (8 points + beam) |
| ref05 snow peaks | `'night'` | scattered stars | `GUIDE_PRESETS.peak` |
| ref07 storm coast | `palette: 'storm'` | (none) | `GUIDE_PRESETS.storm` |
| ref08 aurora arch | `palette: 'aurora'` | `addAurora()` defaults (`REF08_CURTAINS`) | `GUIDE_PRESETS.aurora` |
| ref09 star portal | `'night'` | (none) | `GUIDE_PRESETS.portal` |
| ref10 dawn | `palette: 'dawn'` | `addSun({ kind: 'sunrise' })` (ray wedges) | (none) |

The gallery `src/gallery/sky.js` (`node tools/snap.mjs sky --gallery --t 0.67,2,3.33,4.67,6,7.33`)
recreates the ref02, ref01, ref10, ref04, ref08 and ref07 skies at their reference
positions, one segment of 1.33 s each.

## Backdrops

### `addSky(S, opts) -> Layer`

A baked full-frame sky plane (with 240 px overscan on every side).

| option | default | |
|---|---|---|
| `palette` | `'night'` | key of `SKY_PALETTES` (`night`, `dusk`, `dawn`, `storm`, `aurora`, `twilight`) or a palette object |
| `stops` | palette's | `[[y, colour], ...]` gradient stops in film px (overrides the palette's) |
| `glows` | `[]` | `[{ x, y, r, color, alpha }]` warm pools of light painted into the paper (behind a sun, around a moon) |
| `relief` | palette's | strength of the fine crumpled flake texture (night 1, dusk 0.35, dawn 0.3) |
| `flecks` | palette's | `false` or overrides `{ count, color, max, alpha, cover }` for the gold glitter |
| `dust` | palette's | `false` or overrides for the faint pale paper specks |
| `z` | 20000 | |
| `seed` | `'sky'` | change it per scene so glitter and mottling differ |
| `mat` | `skyMat(relief)` | bake recipe |

```js
addSky(S, { palette: 'dusk', seed: 's01', glows: [{ x: 1626, y: 380, r: 650, color: '#ffc46e', alpha: 0.35 }] });
```

### `drawSky(ctx, opts)`

Same options as `addSky` plus the box `x, y, w, h`. Paints the gradient, dye mottling,
light pools, flake relief, dust and glitter. Use it inside your own sprite.

### Palettes: `SKY_PALETTES`

Each palette is `{ stops, mottle, mottleAlpha?, relief, flecks, dust }`. The stops are tied to
the reference horizons: dusk turns pink at y 210 and orange at y 295, and dawn turns gold at
y 230. If your horizon sits elsewhere, pass `stops`.

### Textures

- `flakeTexture({ size, density, rMin, rMax, lip, tone, hi, lo, blur, seed }) -> canvas`
  is a seamless relief tile of overlapping paper flakes (mid grey means no change), cached by options.
  `SKY_FLAKES.fine` and `SKY_FLAKES.broad` are the recipes the skies use.
- `overlayTexture(ctx, tex, { x, y, w, h, amt, scale, rot, ox, oy, clip, mode })` blends a
  tile over what is already painted. `mode` is `'soft-light'` (default); use
  `'hard-light'` when the texture must still show on pale paper.
- `skyMat(relief)` is the engine bake recipe used for backdrops.

## Star field

### `addStarField(S, opts) -> [glowLayer, starLayer]`

Gold paper sparkles (4-point, concave sides, folded lit/shaded halves, bevel, drop
shadow) plus tiny dot stars. Each star twinkles at its own rhythm: a slight scale and
rotation breath, and a warm glow pulse.

| option | default | |
|---|---|---|
| `stars` | scattered | `[{ x, y, r, tall?, pinch?, rot? }]`, where `r` is the horizontal arm length |
| `scatter` | `{}` | `scatterStars` options when `stars` is omitted |
| `dots` | 40 | `[[x, y, r?], ...]` or a count of random dot stars in `region` |
| `region` | `[0, 0, W, 520]` | box for random dots / scattered stars |
| `twinkle` | 1 | 0 freezes the stars |
| `glow` | 0.3 | warm light around each star |
| `gold` | `STAR_GOLD` | `{ lit, base, shade }` (#ffdb98 / #f7c274 / #cf8f45) |
| `tall`, `pinch` | 1.1, 0.7 | sparkle proportions (`pinch` 0.5 is slim, 0.8 puffy) |
| `z` | 15000 | |

```js
addStarField(S, { stars: REF02_STARS, dots: REF02_DOTS });                     // ref02 exactly
addStarField(S, { seed: 's05', region: [900, 0, 1000, 300], scatter: { count: 14, avoid: [[1400, 140, 120]] } });
```

Helpers: `scatterStars({ region, count, rMin, rMax, seed, avoid })`,
`sparklePts(cx, cy, r, { tall, pinch, rot })` and
`drawPaperStar(ctx, x, y, r, { gold, light, fold, tall, pinch, rot, bevel })`.

## The guiding star

### `addGuidingStar(S, opts) -> { star, at(t), layers }`

The star is a folded gold paper compass star, where each arm has a lit and a shaded facet. It has a
warm two-part halo, thin dotted light rays, a breathing pulse, a slow bob, a glint that
sweeps across the paper every 4.6 s, and twinkling motes. It can also have a vertical
beam (ref04) and a trail of small paper stars (ref01). Keep it consistent across
scenes by always using this function with a preset.

| option | default | |
|---|---|---|
| `x`, `y` | 960, 200 | position at rest |
| `size` | 42 | arm length R in px (ref01 45, ref04 39, ref07 55, ref08 60) |
| `points` | 4 | 4 or 8 (short diagonals) |
| `arms` | per points | arm length factors `[up, right, down, left]` |
| `intensity` | 1 | overall light; `halo`, `rays`, `core`, `sparkles` scale the parts |
| `glint` | true | sweeping highlight |
| `beam` | false | `true` or `{ length: 420, width, alpha: 0.6, up }` |
| `trail` | false | `true` (`REF01_TRAIL`) or `{ pts: [[dx, dy, size], ...], alpha }` in units of R |
| `motion` | null | `t => ({ x, y, s })` moves and scales it; the trail and glows follow |
| `gold` | `GUIDE_GOLD` | warm gold; `GUIDE_GOLD_PALE` is the cream gold of the cold night scenes |
| `pulse` | 1 | strength of the breathing |
| `alpha` | 1 | number or `t => number` |
| `z` | 12000 | |

`GUIDE_PRESETS`: `dusk`, `forest`, `canyon`, `peak`, `storm`, `aurora`, `portal` (table above).

```js
// ref04: eight points, pale gold, beam down into the canyon
addGuidingStar(S, { x: 1486, y: 276, size: 39, ...GUIDE_PRESETS.canyon, beam: { length: 150 } });
// The star drifts across the sky and fades in during a transition.
addGuidingStar(S, { x: 1250, y: 85, size: 45, ...GUIDE_PRESETS.dusk,
  motion: (t) => ({ x: 1250 + 30 * t, y: 85 - 6 * t }), alpha: (t) => smoothstep(0, 0.8, t) });
```

Helpers for your own stars: `compassStar(cx, cy, R, { arms, diag, inner, spread, rot })`
returns `{ pts, tips, notches }`, and `drawFoldedStar(ctx, star, { gold, light, contrast, bevel })`
paints it.

## Moon

### `addMoon(S, opts) -> [glow, disc, innerLight]`

A crumpled paper full moon made from about 700 overlapping cream flakes. Each flake casts a warm
contact shadow, so the gaps read as yellow crevices. The moon is paler toward the light, has warm
mottling, a strong dark drop-shadow halo on the sky, a soft glow and a faint breathing inner light.

| option | default | |
|---|---|---|
| `x`, `y`, `r` | 1562, 166, 118 | ref02 position and size (ref04: 621, 94, 88) |
| `glow` | 1 | glow strength |
| `relief` | 1 | crevice strength |
| `paper` | `MOON_PAPER` | `{ base, lit, deep, crease }` |
| `shadow` | `{ alpha: 0.9, dx: -9, dy: 10 }` | drop shadow on the sky |
| `z` | 14000 | |

`drawMoon(ctx, cx, cy, r, { seed, paper, light, relief })` paints the disc only.

## Sun

### `addSun(S, opts) -> layers`

| option | default | |
|---|---|---|
| `x`, `y`, `r` | 1626, 363, 84 | ref01 setting sun (ref10: 1507, 356, 80) |
| `kind` | `'sunset'` | `'sunset'`: creased disc with faint radial creases pressed into the sky (ref01). `'sunrise'`: core low in the disc and big paper ray wedges fanning across the sky (ref10) |
| `rays` | true | `false`, or `drawSunRays` options (`count`, `width`, `alpha`, `color`, `outer`, `from`, `to`) |
| `glow` | 1 | |
| `anim` | null | `t => ({ x, y })` moves disc, glows and rays together (a rising sun) |
| `z` | 14000 | rays sit at `z + 10`, behind the disc |

The rays sway about 0.6 degrees and breathe. Put a mountain plane in front to cut the disc,
as in both references.

```js
addSun(S, { x: 1507, y: 356, r: 80, kind: 'sunrise', anim: (t) => ({ y: -12 * smoothstep(0, 6, t) }) });
```

`drawSunDisc(ctx, cx, cy, r, { seed, edge, base, core, coreAt, light })` and
`drawSunRays(ctx, cx, cy, opts)` are the static painters.

## Aurora

### `addAurora(S, opts) -> layers`

Torn paper ribbons hanging above a wavy, folded lower edge. Each is filled with vertical streaks
that run pale green at the edge, then green, teal and blue, and fade into the night. Every curtain
casts a shadow on what lies behind, ripples slowly (it is drawn in vertical slices) and breathes
light along its edge.

| option | default | |
|---|---|---|
| `curtains` | `REF08_CURTAINS` | `[{ edge: [[x, y], ...], height, colors, dim? }]` back to front |
| `ripple` | 6 | px of vertical undulation |
| `speed` | 1 | ripple speed |
| `glow` | 0.18 | additive light |
| `z` | 17000 | |

`AURORA_COLORS` has `green`, `teal` and `blue`. `drawAuroraCurtain(ctx, edge, { height, colors, dim, folds, seed })`
paints a single curtain.

## Glow helpers

- `drawGlow(ctx, x, y, r, color, alpha, { falloff: 'soft' | 'tight' | 'wide', sx, sy })` draws a
  baked radial light (cached per colour). Use it in an additive plane.
- `addGlow(S, { z, items: t => [{ x, y, r, color, alpha, falloff }], order, alpha })` adds an additive
  plane. `order: -1` (default) puts it behind other planes at the same depth.
- `glowSprite(color, falloff)` returns the cached glow canvas.

## Budget

Gallery bake is about 1.5 to 4 s. Most of that is the shared textures, which are built once
per page: the flake tiles take about 1.2 s and the core crumple and fibre about 1.3 s.
Per frame, a sky with stars, moon or sun and the guiding star renders in 15 to 40 ms,
and the six aurora curtains add about 20 ms.
