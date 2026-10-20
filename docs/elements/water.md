# Water

`src/elements/water.js` (public API) and `src/elements/water-flow.js` (ribbon, flow and
atlas plumbing). Lakes, rivers, waterfalls, foam, rapids, eddies, ripples and the glittering
reflection of a light, all cut from paper strips and animated so the water never stops and
never visibly loops.

Gallery: `node tools/snap.mjs water --gallery --t 0.5,2.5,4.5` shows three 2 s segments at
the references' own positions: 0-2 s ref02 (moonlit lake, river, ledge falls), 2-4 s ref04
(tall canyon fall, rapids, wide river), 4-6 s ref10 (dawn fall arcing into a gilded river)
plus a cave-pool swatch (ref06 ripples) at the bottom left.

```js
import {
  WATER, addLake, addReflection, addRiver, addWaterfall, addFoam, addMist,
  addRapids, addEddies, addRipples,
  drawLake, drawReflection, drawFoamPuff, drawFoamCrescent, drawWake, drawRapid, drawEddy, drawRipple,
  sliver, stripAngle,
} from '../elements/water.js';
```

## How it is built

- **Lake**: one baked sprite. A wash, dark tree reflections under the far shore, then four
  tiers of horizontal strips laid row by row from the horizon; rows, strips and shadows
  grow toward the viewer. Each tier is one `sheet()` batch: one soft contact shadow for the
  whole tier plus a lit upper and dark lower edge on every strip. Highlight strips sway on
  their own slow cycles above it.
- **River**: a ribbon (centre line spline + width). A static bed of strips traced along a
  direction field, then loose strips (an atlas) riding the current on top with real drop
  shadows. Strips lie near horizontal like the references: along the flow where the river
  crosses the frame, across it (arcs) where it comes toward the viewer (`align`). Strip size
  grows with the river's width only as `(w / texH) ^ persp`, and riders are spread in a
  warped coordinate so coverage stays even and they slow down where the river widens.
- **Waterfall**: a seamless band texture (exact period, paper grain included) scrolled
  through the ribbon in thin slices, composed off screen and masked by its torn silhouette,
  with streak riders racing down it, a lit cut edge, a drop shadow on the cliff, and foam
  and mist at the base.
- Everything that moves is a pure, continuous function of `t`: periodic cycles, wrapped
  positions that pass the ends out of sight, or life cycles whose alpha is zero at the wrap.

## Palettes (`WATER`)

Keys: `deep` (bed, gaps), `base` / `mid` / `light` / `pale` (strip tiers dark to light),
`foam`, `foamShade` (foam creases), `shadow` (contact shadows), `shore` (far-shore
reflections), `glint`, `glow` `[edge, body, core]` (the light's reflection), `lake`
`[far, near]` (lake wash), `fall` (band order across a waterfall, as palette keys).

| palette | matches | notes |
|---|---|---|
| `WATER.night` | ref02 river and rapids | saturated night blues, white strips |
| `WATER.nightLake` | ref02 lake | deeper teal-blue, cream moon reflection |
| `WATER.canyon` | ref04 river, falls, rapids | the most saturated blues |
| `WATER.dawn` | ref10 river, lake, fall | pale blue-teal, creamy foam, gold glow |
| `WATER.dusk` | ref01 river under the bridge | violet-tinted blues, peach glow |
| `WATER.cave` | ref06 crystal-cave pool | deep blue, gold glow |

Override single keys with `{ ...WATER.night, mid: '#3d84c4' }`.

## Layer factories

All factories take the scene `S` and an options object, add one or more planes and accept
`alpha` (number or `t => number`) and `order` (tie-break at equal `z`). Use them inside
`build(S)`.

### `addLake(S, opts)` -> `Layer[]`

| option | default | |
|---|---|---|
| `z` | 1500 | plane depth |
| `x0, x1, top, bottom` | required | extent; `top` is the far shore line |
| `shape` | rectangle | polygon to clip the water to (strips and shimmer stay inside) |
| `palette` | `WATER.nightLake` | ref02; `WATER.dawn` for ref10, `WATER.cave` for ref06 |
| `shore` | none | `{ height, ranges: [[x0, x1]...], color, alpha }` dark tree reflections |
| `light` | none | `{ x, width, widthBottom, top, bottom, count, thick, glow, glints, speed }` reflection column (see `addReflection`) |
| `density, scale` | 1, 1 | strip count and size |
| `shimmer` | area / 2200 | moving highlight strips |
| `seed` | `'lake'` | |

```js
addLake(S, {
  z: 1500, x0: 1000, x1: 2160, top: 582, bottom: 800, palette: WATER.nightLake,
  shore: { height: 18, ranges: [[1000, 1250], [1700, 2160]] },
  light: { x: 1478, width: 140, widthBottom: 90, bottom: 760, count: 40 },
});
```

### `addReflection(S, opts)` -> `Layer[]`

The light's column on water: dashes that drift and breathe, twinkling glints, an additive
glow. Used by `addLake`; call it directly for a reflection on a river or pool (ref09 portal,
ref06 star).

| option | default | |
|---|---|---|
| `z, x, top, bottom` | 1500, required | centre line and extent |
| `width, widthBottom` | 90, 0.75 x width | column width at top and bottom |
| `count` | 34 | dashes |
| `thick` | from width | dash thickness multiplier |
| `palette` / `colors` | `WATER.night` / `palette.glow` | `[edge, body, core]` |
| `glints` | 1.2 x count | twinkling sparkles |
| `glow` | 0.4 | additive glow strength (0 = none) |
| `speed` | 1 | shimmer speed |

### `addRiver(S, opts)` -> `{ layers, ribbon, clip }`

| option | default | |
|---|---|---|
| `z` | 1300 | |
| `path` | required | centre line `[[x, y], ...]` in the flow direction |
| `width` | 160 | px: number, one per control point, or `k => px` |
| `palette` | `WATER.night` | |
| `speed` | 34 | flow speed (texture px / s) |
| `texH` | 240 | texture px across the river; strips scale by `(width / texH) ^ persp` |
| `persp` | 0.5 | how much strips grow with width (1 = fully, 0 = not at all) |
| `align` | `'auto'` | `'along'`, `'across'`, `'auto'` (by flow direction) or a 0..1 weight |
| `smooth` | 220 | px over which the strip direction is averaged through bends |
| `density` | 1 | bed strip density |
| `current` | 0.2 | coverage of the moving strips |
| `sheen` | none | `{ v, width, amount }` band across the river whose strips take the glow colours (ref10's sun path) |
| `swirls` | none | `[{ x, y, r, flat, rings, spin }]` eddies painted into the bed |
| `tiers` | built in | bed tiers `[{ cols, cover, len, th, bow, rim, hi }]` |
| `blend` | none | `[startPx, endPx]` the river melts away at its ends (into a lake) |
| `fade` | from `blend`, min 80 | `[in, out]` texture px over which riders fade at the ends |
| `torn` | 3 | bank raggedness px; `bank`: dark bank band width (14) |
| `res` | 1 | bed bake resolution (raise for planes the camera pushes into) |

Keep bends gentle: the turning radius should exceed half the width, or the inner bank folds
(hide unavoidable folds under rocks). Banks, rocks and trees from other families should
overlap the river edge.

```js
// ref02: the river leaving the lake, strips following the bend
addRiver(S, {
  z: 1300, palette: WATER.night, texH: 200, align: 'along', speed: 30,
  path: [[1440, 778], [1300, 788], [1150, 802], [1030, 828], [985, 868], [1030, 900], [1200, 885], [1420, 875], [1660, 880], [2160, 868]],
  width: [60, 110, 150, 170, 165, 150, 130, 120, 120, 120],
});
// ref04: wide river coming toward the viewer, strips as arcs, eddies in the bed
addRiver(S, {
  z: 1280, palette: WATER.canyon, texH: 300, blend: [60, 0],
  path: [[1500, 620], [1430, 680], [1330, 750], [1260, 840], [1280, 960], [1360, 1130]],
  width: [60, 130, 290, 470, 640, 760],
  swirls: [{ x: 1400, y: 820, r: 80 }, { x: 1560, y: 960, r: 110 }],
});
// ref10: gilded by the low sun, melting out of the lake
addRiver(S, {
  z: 1350, palette: WATER.dawn, texH: 230, blend: [110, 0], sheen: { v: 0.5, width: 0.45, amount: 0.65 },
  path: [[1550, 725], [1470, 795], [1440, 860], [1330, 925], [1170, 990], [1040, 1100]],
  width: [150, 210, 250, 290, 340, 400],
});
```

### `addWaterfall(S, opts)` -> `{ layers, ribbon, clip }`

| option | default | |
|---|---|---|
| `z` | 1200 | |
| `path` | | centre line from lip to base (a hooked first segment bends the bands over the lip) |
| `x, top, bottom, lip` | | or a straight fall; `lip` px sideways over the edge first |
| `width` | 110 | number, `[top, bottom]`, one per control point, or `k => px` |
| `palette` | `WATER.canyon` | |
| `bands` | `palette.fall` | band colours across the sheet (palette keys) |
| `bandWidth` | 16 | px per band (8 for small ledge falls) |
| `speed` | 120 | fall speed (texture px / s) |
| `accel` | 0.6 | streaks stretch and speed up toward the base |
| `round` | 30% of top width | px over which the lip is rounded into an arch |
| `streaks` | 1 | streak density |
| `shadow` | `{}` | `{ alpha: 0.5, dist: 1 }` drop shadow on the cliff, `false` for none |
| `foam` | `{}` | `addFoam` options for the base (`x, y, w, h` default from the base), `false` for none |
| `mist` | `{}` | `addMist` options, `false` for none |
| `res` | 1.25 | off-screen resolution of the sheet |

```js
// ref04 tall fall
addWaterfall(S, {
  z: 1320, palette: WATER.canyon, speed: 130,
  path: [[712, 352], [738, 368], [752, 410], [766, 480], [790, 572]], width: [80, 88, 96, 106, 114],
  foam: { w: 240, h: 60, size: 1.05, count: 12 },
});
// ref02 ledge: short, wide, many thin bands, low splash
addWaterfall(S, { z: 1230, palette: WATER.night, x: 1573, top: 880, bottom: 945, width: 185, round: 18, bandWidth: 8, speed: 70, accel: 0.3, foam: { size: 0.5, count: 16, flat: 0.42 } });
// ref10 fall arcing over a rock
addWaterfall(S, { z: 1280, palette: WATER.dawn, path: [[905, 745], [960, 770], [990, 840], [1005, 915]], width: [96, 104, 112, 118], mist: { color: '#fff6e6' } });
```

### `addFoam(S, opts)` -> `Layer[]`

Rows of puffs that breathe, bob, rise and sink, nearer rows shadowing the ones behind, plus
spray droplets.

| option | default | |
|---|---|---|
| `z, x, y, w, h` | 1200, required | centre and extent of the foam bank |
| `count` | w / 24 | puffs |
| `size` | 1 | puff radius multiplier (big in the middle, smaller toward the sides) |
| `flat` | 0.6 | puff height / width (0.4 for a low splash) |
| `churn` | 1 | motion amount |
| `spray` | w / 6 | droplets |
| `palette, seed, res` | `WATER.canyon`, `'foam'`, 1.25 | |

### `addMist(S, opts)` -> `Layer[]`

Soft clouds (screen blend) that swell, rise and fade. `{ z, x, y, w, h, count, strength = 0.32, color = '#eef4fa', seed }`.

### `addRapids(S, opts)` -> `Layer[]`

White water around rocks in a current: a torn foam collar (thicker upstream) and optional
bow-wave arcs behind each rock, a white lip and small puffs at its downstream foot in front.

| option | default | |
|---|---|---|
| `z` | 1150 | plane of the collars: just behind the rocks |
| `zFront` | z - 40 | plane of the downstream foam: just in front of the rocks |
| `rocks` | required | `[{ x, y, rx, ry, thick, rings, puffs }]` waterline centre and radii |
| `angle` | PI / 2 | flow direction (PI/2 = toward the viewer, 0 = to the right) |
| `thick` | 9 | foam thickness px |
| `rings` | 0 | bow-wave arcs |
| `wake` | true | downstream foam |

### `addEddies(S, opts)` -> `Layer[]`

Swirls of nested arc strips that turn and breathe on the spot. `{ z = 1290, eddies: [{ x, y, r, flat = 0.36, rings = 6, spin = 1.4 }], palette, seed }`. For static swirls inside a river use `addRiver({ swirls })`.

### `addRipples(S, opts)` -> `Layer[]`

Rings spreading from a point and fading, staggered so the motion never resets (ref06).

| option | default | |
|---|---|---|
| `z, x, y` | 1300, required | centre |
| `rx, ry` | required | final ring radii |
| `r0` | 0.15 | starting radius (share of rx) |
| `count` | 4 | rings alive at once |
| `period` | 4.5 | seconds for a ring to grow out |
| `width` | 9 | strip thickness at full size |
| `color, rim, arcs` | `palette.light`, white, 3 | |
| `expand` | true | false: rings stay put and only breathe |

```js
addRipples(S, { z: 1300, x: 1180, y: 760, rx: 140, ry: 36, palette: WATER.cave, color: WATER.cave.glow[1] });
```

## Draw functions (for your own sprites)

All draw in authored coordinates on a sprite's `ctx`; bake them with `S.sprite({ draw })`.

- `drawLake(ctx, { x0, x1, top, bottom, shape, palette, light, shore, density, scale, seed, sceneLight })`
- `drawReflection(ctx, { x, top, bottom, width, widthBottom, count, thick, colors | palette, seed, light })`
- `drawFoamPuff(ctx, x, y, r, { palette, seed, light, bumps = 6, flat = 0.6 })` one puff
- `drawFoamCrescent(ctx, x, y, rx, ry, { facing, spread = 1.3, thick = 10, palette, seed, light })` torn crescent of white water around a rock
- `drawRapid(ctx, x, y, rx, ry, { angle, thick = 9, rings = 2, palette, seed, light })` collar and bow waves
- `drawWake(ctx, x, y, rx, ry, { angle, thick = 4, puffs = 2, palette, seed, light })` downstream lip and puffs
- `drawEddy(ctx, x, y, r, { flat = 0.36, rings = 6, spin = 1.4, palette, seed, light })`
- `drawRipple(ctx, x, y, rx, ry, { width = 4, color, rim, arcs = 3, gap = 0.3, seed, light })`
- `sliver(x0, x1, y, th, { amp, wave, phase, bow, taper, lean })` the basic tapered strip outline
- `stripAngle(ang, align)` the near-horizontal strip direction for a flow direction

Re-exported plumbing from `water-flow.js`: `ribbon(path, { width, texH, uScale })`,
`outline(rb, { inset, round })`, `project(rb, u, v)`, `atU(rb, u)`, and
`sheet(ctx, paint, { light, shadow, edge })` (batch many flat pieces with one shared contact
shadow; `paint(add)` calls `add(pts, { fill, torn, rim })`).

## Depth and cost

- Typical depths: lake 1500-1800, river 1250-1350, falls just in front of their cliff,
  rapids just behind the rocks with `zFront` just in front.
- Bake: a lake or river bed is a few hundred ms; per frame a river draws one bed sprite plus
  ~150-300 atlas cells, a waterfall ~60 slices into a small off-screen canvas. No clipping
  per frame.
- Overscan for camera moves: extend lakes and rivers past the frame like any backdrop.
