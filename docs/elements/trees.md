# Trees family (`src/elements/trees.js`)

Conifers and big trunks: huge foreground spruces built from drooping needle fronds
(ref02, ref10), two-tone tiered spruces for the midground, jagged spire silhouettes and
whole forest bands for distance, and redwood trunks of overlapping bark strips with
hanging fir sprays (ref03). Everything is procedural and seeded. Coordinates are film
pixels with the camera at rest. The family is a single file; there are no `trees-*.js` files.

```js
import {
  FOLIAGE, BARK, LIGHT, tone, hazePalette,                 // palettes
  addTree, addHeroConifer, addForestBand,                  // Scene factories
  conifer, coniferMid, coniferFar, forestBand, trunk, bigTrunk, canopy, // ctx painters
  frond, frondTier, spray, branch, spire, emboss,          // lower-level pieces
  coniferPlan, coniferBody, sway, swayAnim, treeBounds,    // helpers
} from '../elements/trees.js';
```

There are two kinds of function:

- **ctx painters** (`conifer`, `coniferMid`, `coniferFar`, `forestBand`, `trunk`, `bigTrunk`,
  `canopy`, `frond`, `spray`, ...) paint flat paper pieces in authored coordinates. Call them
  only inside a sprite's `draw(ctx)` at build time, never per frame. Their `light` defaults to
  the module constant `LIGHT = [0.55, -0.83]`, not the scene light, so pass `light: S.light`
  (or a local light) when the scene light is different.
- **Scene factories** (`addTree`, `addHeroConifer`, `addForestBand`) bake a sprite or sprites and
  add one plane each. They default `light` to `S.light`, take `alpha` (a number or `t => number`)
  for fades, and return the `Layer` they add. They set no `tags`; the layer is identified by `name`.

Seeds can be a number, a string or an `RNG` (except `spire`, which needs an `RNG`). The same
seed always gives the same tree.

## Palettes and which reference they match

`FOLIAGE[key]` is a five-step ramp `{ deep, dark, mid, lit, hi }` plus `fleck` (the gold-leaf
speck colour). Every painter picks colours by position on the ramp with `tone(pal, t)`,
where `t = 0` is the deepest shade and `1` the brightest tip, so the `tones` and `bias`
options are ramp positions.

| key | matches | use |
|---|---|---|
| `night` | ref02 big left spruce cluster (lit fronds #8aaa6b, shade #0b3525) | hero conifers at night, canopy |
| `forest` | ref02 / ref04 midground spruces (dark #1c3a30, lit #4a6a45) | default for `coniferMid` and `forestBand` |
| `sage` | ref02 yellow-green spruces mixed into the hillside (#607737) | mix 1 part to 5 of `forest` |
| `teal` | ref03 background spruces | ref03 midground, canopy on the right |
| `dusk` | ref01 sunset (lit #77904f, shade #205037) | ref01, mixed 1:2 with `dawn` in ref10 |
| `dawn` | ref10 sunrise (sun-struck #c4bf4d) | ref10 everything |
| `snow` | ref05 snowy slopes (deep winter green) | ref05 |
| `blue` | ref02 far shore #1a3a47 before haze | default for `coniferFar`; far bands |

`BARK[key]` is `{ dark, mid, lit, hi }` (crevice to lit ridge):

| key | matches |
|---|---|
| `night` | ref02 left trunk (lit #b16638, crevices #471f19); default for conifers |
| `redwood` | ref03 redwoods (firelit edges #cb7e3f); default for `bigTrunk` |
| `dusk` | ref01 / ref10 sunlit trunks (#954a2b, #a15131) |
| `brown` | plain brown for small trunks |

- `tone(pal, t) -> colour` interpolates the five foliage stops (it does not work on `BARK`).
- `hazePalette(pal, color, t) -> pal` mixes every key toward `color` by `t` (returns `pal` when `t` is 0).
  Works on foliage and bark palettes. Many painters do this for you through `haze` + `hazeAmt`:
  **always pass `haze` with `hazeAmt`**; `coniferMid` and `coniferFar` (and `forestBand` with
  `haze: null`) throw on a non-zero `hazeAmt` without a colour.
- A custom palette must have all six foliage keys (or all four bark keys), and every colour,
  including `haze`, must be a `#rrggbb` / `#rgb` hex string (`mix` cannot parse `rgba()` or names).

## Coordinate conventions

- **Trees stand on `(x, y)`**: the ground point at the centre of the trunk base. `h` is the height
  from that point to the apex (`apex = y - h`); the leader tip pokes 1-2 % above it and the
  root flare and contact shadow reach up to about 20 px below `y`.
- **`width` is crown half-width as a fraction of `h`**: the reach of the lowest tier. Measured
  painted half-widths: `conifer` 0.25-0.29 h at the default 0.3; `coniferMid` about 0.26 h
  (= its default); `coniferFar` 0.24-0.26 h.
- Painters draw outside no box of their own: the sprite you bake them into must contain them.
  `treeBounds(x, y, h, { detail, width })` gives a safe box (measured margins of 25-80 px).
- Trunks (`trunk`, `bigTrunk`) are centred on `x` from `yTop` down to `yBase`; `w` is the base
  width before the flare, and the flare widens the base half-width to `w/2 * (1 + flare)`.
- `forestBand` `base` is the ground line of the **front** row; each row behind sits `rowLift`
  higher. `canopy` `y` is the root line of the fronds (usually above the frame).
- Angles are radians, y down: positive angles point below horizontal.
- Depths used by the gallery: forest bands 1800-2600, midground `coniferMid` clumps 1250-1900,
  thin trunks 1600, canopy 1300, `addTree` midground spruce 1150, hero conifer and redwoods
  1000-1100. A hero conifer is typically `h = 1560` with its base on the ground line
  (y 700-760), so only the lower half of the tree is in frame.

## Scene factories

### `addTree(S, opts) -> Layer`

Bakes one tree into one sprite (box from `treeBounds`) on its own plane, swaying about its base.

| option | default | |
|---|---|---|
| `x`, `y`, `h` | required | ground point and height |
| `detail` | `'near'` | `'near'` uses `conifer`, `'mid'` `coniferMid`, `'far'` `coniferFar` |
| `z` | 1000 | plane depth |
| `name` | `'tree'` | sprite and layer name |
| `res` | 1 | bake resolution (1.25-1.5 for planes the camera pushes into) |
| `sway` | `{}` | `sway()` options for the plane rotation, or `false` for none |
| `alpha` | 1 | layer alpha, number or `t => number` |
| `shadow` | scene default | **layer** shadow override `{ alpha, dx, dy }` (so a tree's own `shadow` option cannot be set through `addTree`) |
| `...tree` | | every other key goes to the painter (`palette`, `width`, `tiers`, `tones`, `seed`, `light`...) |

Motion: `anim = swayAnim(x, y, { seed: tree.seed ?? 1, ...sway })`, a rotation of about
±0.005 rad about the base (±3 px at the top of a 700 px tree).

### `addHeroConifer(S, opts) -> Layer`

The foreground spruce. Same tree as `conifer`, but its trunk/body and each whorl are separate
sprites (`<name>-body`, `<name>-tier0` at the top .. `<name>-tierN`), drawn per frame bottom
whorl first so every upper whorl casts a real drop shadow onto the whorls below. The whole tree
sways about `(x, y)` and each whorl rocks about its own root, with a lag down the tree, so a
breeze seems to move through it.

| option | default | |
|---|---|---|
| `x`, `y`, `h` | required | |
| `z` | 900 | the gallery uses 1000 |
| `name` | `'hero-conifer'` | layer name and sprite prefix |
| `res` | 1 | |
| `sway` | `{}` | whole-tree `sway()` options (`amp` 0.004, `period` 6.5), or `false` |
| `tierSway` | `{}` | `{ amp: 0.012, period: 4.2, lag: 0.07 }` per whorl; amp is scaled by 0.4 (top) .. 1 (bottom whorl), `lag` is the phase delay in cycles per whorl. `amp: 0` stops it (`sway: false` does not) |
| `alpha` | 1 | |
| `haze`, `hazeAmt` | none | pull palette and bark toward a haze colour |
| `...tree` | | all `conifer` options. Note `shadow` here is the frond contact-shadow alpha, not a layer override |

The layer has no `sprites`; it draws in `render`. It takes no layer `shadow` option.

### `addForestBand(S, opts) -> Layer`

Bakes `forestBand(ctx, { light: S.light, ...band })` into one plane.

| option | default | |
|---|---|---|
| `z` | 2000 | |
| `name` | `'forest'` | |
| `res` | 1 | |
| `box` | derived | authored box `{ x, y, w, h }`. Default: `x0 - 40 .. x1 + 40` wide, from above the tallest back-row tree to `base + 0.6 h1 + 30` |
| `alpha`, `shadow` | | layer alpha and shadow override |
| `...band` | | all `forestBand` options |

**Band ends are cut flat.** Trees are placed up to one spacing past `x1` (and before `x0`) and
their crowns spread further, but the default box pads only 40 px, so a band that ends inside
the frame shows a vertical cut (visible in the gallery at film x 1220 on the ref02 and ref10
pages, where tall bands end at `x1: 1180`). Run `x0` / `x1` past the frame plus overscan, hide
the end behind a nearer plane, or pass a wider `box` (roughly `max height * width + spacing`
beyond each end).

## ctx painters: whole trees

### `conifer(ctx, x, y, h, opts)`

Near, detailed spruce: stacked whorls (`frondTier`) of two-layer serrated, embossed needle
fronds with gold flecks over a bark `trunk`, with an apex leader spike. Tiers crowd near the
apex and spread toward the base.

| option | default | |
|---|---|---|
| `palette` | `FOLIAGE.night` | |
| `bark` | `BARK.night` | |
| `light` | `LIGHT` | |
| `seed` | 1 | |
| `width` | 0.3 | lowest-tier reach as a fraction of `h` |
| `tiers` | `clamp(round(h / 80), 5, 16)` | number of whorls |
| `curve` | 1.25 | tier spacing exponent (higher crowds tiers toward the apex) |
| `trunkFrac` | 0.12 | bare trunk below the lowest whorl (fraction of `h`) |
| `trunkWidth` | 0.06 | trunk width as a fraction of `h` (0 for none) |
| `trunk` | `{}` | extra `trunk()` options, e.g. `{ rim: '#e89a52' }` |
| `interior` | `true` | dark smooth inner volume behind the whorls; `false` shows the trunk between them (gallery heroes use `false`) |
| `bias` | 0.5 | brightness on the ramp; each tier adds `+0.12` at the top down to `-0.06` at the bottom |
| `contrast` | 1 | lit / shade / back-frond spread (gallery dawn hero: 1.5) |
| `fronds` | `clamp(round(R/150) + 1, 2, 3)` | fronds per side per whorl |
| `front` | `true` | add a frond pointing at the viewer (hides the trunk); a number = fraction of whorls from the top that get one |
| `slope` | 0.45 | droop of side fronds (radians), ±0.16 random per whorl |
| `droop` | 0.1 | sag of each frond spine |
| `thick` | 0.46 | frond depth as a fraction of its length |
| `sides` | `'both'` | `'left'` / `'right'` for half trees at the frame edge (whorls only; trunk, interior and leader still draw) |
| `layers` | 2 if tier R > 70, else 1 | pieces per frond |
| `grain` | 0.55 | embossed needle grain strength |
| `flecks` | `true` | gold specks on the fronds |
| `shadow` | 0.6 | frond contact-shadow alpha (0 for none) |
| `spread` | trunk half-width x 0.8 | sideways offset of frond roots from the axis |
| `haze`, `hazeAmt` | none | |

### `coniferMid(ctx, x, y, h, opts)`

Midground spruce: tiers of two-tone skirts (shade half and lit half meeting on the axis, lit
side from the sign of `light[0]`), each with notched hanging lobes, small needle teeth, a
contact shadow on the tier below, and a slim two-tone trunk.

| option | default | |
|---|---|---|
| `palette` | `FOLIAGE.forest` | |
| `bark` | `BARK.night` | |
| `light`, `seed` | `LIGHT`, 1 | |
| `width` | 0.26 | half-width of the lowest tier (fraction of `h`) |
| `tiers` | `clamp(round(3 + h / 28), 4, 12)` | small trees get many fine tiers, big ones about 12 |
| `tones` | `[0.2, 0.62]` | `[shade, lit]` ramp positions (gallery uses darker, e.g. `[0.06, 0.46]`) |
| `bias` | 0 | added to both halves (upper tiers are a little brighter anyway) |
| `lobes` | from size (1-4) | hanging lobes per half tier |
| `trunkFrac` | 0.07 | visible trunk below the crown |
| `trunkWidth` | 0.03 | 0 for no trunk |
| `shadow` | 0.62 | tier contact-shadow alpha (0 for none) |
| `grain` | 0.5 if `h > 150`, else 0 | embossed needle grain |
| `flecks` | `true` | gold specks on tiers deeper than 14 px |
| `haze`, `hazeAmt` | `null`, 0 | |

### `coniferFar(ctx, x, y, h, opts)`

Far spruce: a jagged `spire` silhouette in the shade tone with its lit half laid over it.

| option | default | |
|---|---|---|
| `palette` | `FOLIAGE.blue` | |
| `light`, `seed` | `LIGHT`, 1 | |
| `width` | 0.24 | |
| `tones` | `[0.18, 0.55]` | `[shade, lit]`; `lit: null` for a flat silhouette |
| `shadow` | `null` | piece shadow `{ color, blur, x, y }` on what is behind |
| `haze`, `hazeAmt` | `null`, 0 | |

### `forestBand(ctx, opts)`

Rows of trees along a ridge or shore. Back rows are smaller, higher and hazier. Each row's far
trees (`h < midMin`) are spire silhouettes merged with a dark ground skirt into one strip of
paper that casts a contact shadow on the row behind; trees at least `midMin` tall are drawn as
`coniferMid` on top of that row's strip. Slow noise makes clumps and clearings.

| option | default | |
|---|---|---|
| `x0`, `x1` | -220, 2140 | horizontal extent (full frame plus overscan by default) |
| `base` | 700 | front-row ground: a y, or a polyline `[[x, y], ...]` sorted by x (linear between points, flat beyond) |
| `heights` | `[40, 90]` | `[min, max]` front-row tree height (back rows scaled down, clumps ±30 %) |
| `rows` | 3 | |
| `rowLift` | `0.32 * heights[1]` | rise of each row behind |
| `backScale` | 0.62 | size of the back row relative to the front |
| `density` | 1 | trees per tree-width (1 = tips just touching; gallery uses 0.75-1.8) |
| `width` | 0.25 | crown width fraction (each tree x0.75-1.3) |
| `colors` | `FOLIAGE.forest` | palette or array of palettes picked at random |
| `weights` | `null` | relative weights for `colors`, e.g. `[5, 1]` |
| `haze` | `'#5a7090'` | haze colour |
| `hazeAmt` | `[0.55, 0.1]` | `[back row, front row]` haze amount |
| `tones` | `[0.18, 0.55]` | `[shade, lit]` ramp positions |
| `midMin` | 90 | height from which trees get tiered `coniferMid` detail (999 = all silhouettes, 60 = all detailed) |
| `skirt` | `true` | dark ground strip under each row: `true` = `0.4 x` row max height deep, a number of px, or `false` |
| `gaps` | 0.55 | clearing threshold; higher = fewer clearings (gallery: 0.8 for unbroken shores) |
| `scatter` | 0.3 | trees drop up to `scatter * h` below the row line, for depth within a row |
| `shadow` | 0.4 | row contact-shadow alpha (mid trees use 0.9 x) |
| `trunks` | `true` | small trunks under silhouettes and mid trees |
| `bark` | `BARK.night` | bark of the mid trees |
| `light`, `seed` | `LIGHT`, 1 | |

### `bigTrunk(ctx, x, yTop, yBase, w, opts)`

Redwood (ref03): branch stubs behind, then a `trunk` with `taper: 0.9`, `strips: round(w/24)`
and a warm rim on the lit flank, then canopy curtains over it.

| option | default | |
|---|---|---|
| `bark` | `BARK.redwood` | |
| `light`, `seed` | `LIGHT`, 1 | the lit flank follows the sign of `light[0]` |
| `flare`, `flareH` | 0.45, 0.2 | root flare width (fraction of `w`) and height (fraction of the trunk) |
| `lean` | 0 | sideways offset of the top (px) |
| `rim` | `'#e89a52'` | warm edge light colour (firelight), or `null` |
| `foliage` | `[]` | array of `canopy()` options; each gets the trunk's `light` and a derived seed unless it sets its own |
| `branches` | `[]` | `[{ y, side = 1, len = w, width = 0.12w, ang, twigs = 2 }]` bare stubs rooted at `x + side * 0.42w`; `ang` defaults to up-and-outward |

### `canopy(ctx, opts)`

A curtain of fronds hanging from boughs above the frame: `rows` layers of fronds rooted along a
sagging line, sweeping down and outward; back rows darker, fronds on the lit side brighter.
Measured extent: about 130-150 px beyond `x0` / `x1`, down to at most `y + sag + 34 (rows - 1) + len[1]`.

| option | default | |
|---|---|---|
| `x0`, `x1`, `y` | 0, 400, -40 | root line |
| `sag` | 40 | dip of the line's middle |
| `len` | `[140, 260]` | frond length range |
| `rows` | 3 | each row roots 34 px lower |
| `density` | 1.4 | fronds per 100 px per row |
| `dir` | 0 | 1 / -1 sweeps every frond right / left; 0 sweeps away from the middle (25 % flipped) |
| `kind` | `'spray'` | `'spray'` = pinnate fir sprays (ref03), `'frond'` = broad serrated blades |
| `palette` | `FOLIAGE.night` | |
| `bias` | 0.55 | ramp brightness |
| `grain` | 0.45 | |
| `light`, `seed` | `LIGHT`, 1 | |

### `trunk(ctx, x, yTop, yBase, w, opts)`

Bark trunk: a dark core showing through crevices, covered by tapering, overlapping vertical
bark plates (torn edges, embossed fibre, a lighter ridge on each plate when `w > 60`), shaded
round the cylinder toward the light, with a root flare, slits and pale flecks.

| option | default | |
|---|---|---|
| `bark` | `BARK.night` | |
| `light`, `seed` | `LIGHT`, 1 | |
| `taper` | 0.75 | top width as a fraction of `w` |
| `flare`, `flareH` | 0.3, 0.14 | extra base width (fraction of `w`) over the lowest `flareH` of the height |
| `lean` | 0 | top offset in px; the trunk bows smoothly |
| `strips` | `clamp(round(w/16), 3, 20)` | bark plates across the trunk |
| `segments` | `true` | plates break into overlapping lengths plus loose cross plates |
| `cracks` | `true` | dark slits and pale flecks |
| `rim` | `null` | warm light colour wrapping the lit flank |
| `shadow` | `true` | contact shadows under plates |
| `grain` | 0.45 | embossed fibre strength |

## Lower-level pieces

- `frond(ctx, x, y, len, thick, opts) -> Path2D`: one needle frond rooted at `(x, y)` pointing
  along +x (`flip: true` mirrors to -x), drooping by `ang` (0.4). Two pieces: a darker needle
  curtain and a lighter top blade with its own contact shadow. Options: `color`
  (`FOLIAGE.night.mid`), `rootColor` / `tipColor` (shaded from `color`), `under` (curtain colour),
  `layers` (2; 1 is cheaper), `grain` (0.55), `bevel` (true), `shadow` (piece shadow object or
  null), `flecks` (count, 0), `fleckColor`, `light`, `seed`, `shape` `{ droop 0.2, arch 0.05,
  curl 0.12, teeth, depth 0.2, hang 0.08, nicks 2, splits 1, taper 0.9 }`.
- `frondTier(ctx, cx, cy, R, opts)`: one whorl seen from the side, fronds fanned from behind
  (short, dark) through the sides (long) to the front (short, steep), drawn back to front.
  Takes the frond-level options of `conifer` above (`palette`, `fronds`, `bias`, `contrast`,
  `droop`, `slope`, `thick`, `sides`, `front` (boolean here), `grain`, `flecks`, `shadow`,
  `spread`, `layers`). The front frond needs `R > 60` and `sides: 'both'`.
- `spray(ctx, x, y, len, opts) -> Path2D`: pinnate fir branchlet. `ang` 0.6, `bend` 0.6,
  `leaf` 0.2 len, `gap` 0.46, `lean` 0.75, `color`, `rootColor`, `tipColor`, `grain` 0.5,
  `veins` 0.18 (alpha of pale creases), `flecks` 0, `shadow`, `light`, `seed`.
- `branch(ctx, x, y, len, width, ang, { bark, light, seed, twigs = 0 })`: tapered bark stick.
- `spire(x, y, h, rng, { width = 0.24, steps, litSide = 1, trunk = true }) -> { full, lit }`:
  point lists of a far spruce; `rng` must be an `RNG` instance.
- `coniferPlan(x, y, h, { width, tiers, trunkFrac, trunkWidth, seed, curve }) -> { x, y, h, apex, base, R, tiers: [{ i, u, cx, cy, R, root, seed }] }`:
  the tier layout shared by `conifer` and `addHeroConifer` (tier 0 at the top, `u` = 1 at the bottom).
- `coniferBody(ctx, plan, opts)`: trunk and dark interior of a near conifer.
- `emboss(ctx, path, box, { kind = 'needle' | 'bark', alpha = 0.3, angle = 0, scale = 1, seed = 1 })`:
  overlays pressed needle creases or bark fibres inside `path`. Usable by other families.
- `treeBounds(x, y, h, { detail = 'near', width }) -> { x, y, w, h }`: reach
  `h * width * 1.12` (near) or `1.1` (mid, far) plus 24 px each side; from `y - 1.04 h - 20` to `y + 20`.
  Default `width` by detail: 0.3 / 0.26 / 0.24.

## Motion

- `sway(t, { amp = 0.004, period = 6.5, phase = 0, seed = 1 }) -> radians`: two incommensurate
  sines plus slow noise, peak about `1.2 * amp`, never visibly looping. `phase` is in cycles.
- `swayAnim(ox, oy, opts) -> (t) => ({ rot, ox, oy })`: a layer `anim` rotating about the trunk base.
- Only `addTree` and `addHeroConifer` move. Bands, painters and anything you bake yourself are static.
- Trees with the same `period` and `phase` sway in step (only the noise term follows `seed`);
  give neighbouring trees different `sway: { phase }` values.

## Performance

Measured in headless Chrome (GPU raster), build including the paper bake:

| element | build | per frame |
|---|---|---|
| `conifer` h 700 / h 1560 | 11 / 28 ms | baked |
| `addHeroConifer` h 1560, 14 whorls | 53 ms | 1.2 ms (15 sprites with shadows) |
| `coniferMid` h 700 | 2 ms | baked (`addTree`: one transformed sprite) |
| `coniferFar` h 80 | 0.4 ms | baked |
| `forestBand` full width, 3 rows 40-90 px | 12 ms | baked |
| `forestBand` 2 rows 80-220 px, `midMin: 60` | 19 ms | baked |
| `bigTrunk` w 235 + 3-row canopy | 16 ms | baked |

- Cost grows with the number of detailed trees: in a band, `midMin` decides how many
  `coniferMid` are drawn; silhouettes are nearly free.
- Use `layers: 1` and `grain: 0` on small fronds; `res` multiplies bake cost by `res^2`.
- The emboss tiles (256 px, one per kind) are made once per page and reused.
- Hero sprites are large: the body is `2R + 40` by `h + 40` px (726 x 1600 for the gallery giant).

## Examples (from `src/gallery/trees.js`)

Preview: `node tools/snap.mjs trees --gallery --t 1,3,5` (ref02 page at 0-2 s, ref03 at 2-4 s,
ref10 at 4-6 s). The gallery maps reference px to film px with `S2 = 1.1483`.

```js
// ref02 left cluster: a two-tone midground spruce, then the giant in front of it.
addTree(S, { z: 1150, name: 'a-spruce-b', detail: 'mid', x: 408, y: 680, h: 700, width: 0.22,
  tiers: 12, palette: FOLIAGE.night, seed: 33, tones: [0.06, 0.46] });
addHeroConifer(S, { z: 1000, name: 'a-giant', x: 80, y: 700, h: 1560, width: 0.22, tiers: 14,
  trunkFrac: 0.21, trunkWidth: 0.08, palette: FOLIAGE.night, bark: BARK.night, seed: 34,
  bias: 0.7, front: 0.35, interior: false, fronds: 2 });
```

```js
// Hillside forest on a polyline, mostly forest green with some sage, all trees detailed.
addForestBand(S, { z: 1800, name: 'a-band-hill', x0: 700, x1: 1420,
  base: refPts([[620, 470], [800, 460], [1000, 520], [1150, 570], [1240, 600]]),
  heights: [80, 220], rows: 2, density: 0.95, colors: [FOLIAGE.forest, FOLIAGE.sage], weights: [5, 1],
  haze: '#506a88', hazeAmt: [0.22, 0], seed: 23, midMin: 60, skirt: false, width: 0.24, tones: [0.1, 0.5] });
// Far shore: silhouettes only, few clearings.
addForestBand(S, { z: 2400, name: 'a-band-shore', x0: 1160, x1: 2100, base: refPts([[1180, 520], [1672, 430], [1800, 420]]),
  heights: [35, 130], rows: 3, density: 1.8, colors: FOLIAGE.blue, haze: '#4a7090', hazeAmt: [0.5, 0.15],
  seed: 22, midMin: 999, gaps: 0.8, tones: [0.15, 0.45] });
```

```js
// ref03 redwood lit from the left, with a fir-spray curtain hanging over it.
const fromLeft = [0.6, -0.8];
S.plane(1000, {
  name: 'b-redwood-1', x: 226 - 235 * 1.6 - 380, y: -160, w: 235 * 3.2 + 760, h: 860,
  draw(ctx) {
    bigTrunk(ctx, 226, -60, 640, 235, { light: fromLeft, seed: 53,
      foliage: [{ x0: -120, x1: 560, y: -60, sag: 40, len: [160, 290], rows: 3, palette: FOLIAGE.night, bias: 0.6 }] });
  },
});
```

```js
// ref10: a clump of midground spruces in one baked plane, under a low sun on the right.
const light = [0.75, -0.66];
S.plane(1250, {
  name: 'c-spruces', x: 460, y: 120, w: 340, h: 640,
  draw(ctx) {
    const o = { palette: FOLIAGE.dawn, light, tones: [0.05, 0.5] };
    coniferMid(ctx, 597, 740, 570, { ...o, seed: 67, width: 0.15 });
    coniferMid(ctx, 689, 740, 480, { ...o, seed: 68, width: 0.14, tones: [0.08, 0.58] });
  },
});
```

When a tree's `light` differs from the scene's, the painted shading follows the tree's light,
but the sprite's baked edge light and the plane's drop shadow still follow `S.light`.
