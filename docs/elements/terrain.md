# Terrain family (`src/elements/terrain.js`)

Mountains, rolling hills, boulders, the snowy trail, canyon cliffs and the rock arch.
Everything is static paper: each `addX` bakes **one sprite on one plane** and returns
that `Layer`. Nothing animates by itself. Positions are film pixels (1920x1080) with the
camera at rest, the same convention as every other family.

```js
import {
  addRange, addHills, addBoulders, addCliff, addArch,               // baked planes
  drawMountain, drawRange, drawHill, drawHills, drawBoulder, drawBoulders,
  drawSteppingStones, drawTrail, drawCliff, drawArch, snowSlab,       // paint inside your own sprite
  mountainGeometry, boulderGeometry, hillCrest,                       // geometry only, no drawing
  rangeBox, hillsBox, bouldersBox,                                     // sprite boxes
  MOUNTAIN_PALETTES, HILL_PALETTES, STONE_PALETTES, SNOW, ROCK_MAT, BOULDER_SHAPES,
  mountainPalette, hillPalette, DEFAULT_LIGHT,
} from '../elements/terrain.js';
```

`terrain.js` re-exports five files: `terrain-mountains.js`, `terrain-hills.js`,
`terrain-rocks.js`, `terrain-cliffs.js` and `terrain-kit.js` (shared geometry and texture helpers).

Each element comes in two flavours:

- `drawX(ctx, opts)` paints flat pieces inside a sprite's `draw(ctx)`. Use it when you need
  your own box, material or several elements on one sheet. **`light` defaults to
  `DEFAULT_LIGHT` (`[0.5, -0.866]`, upper right), not the scene light, so pass `light: S.light`
  or your own vector.**
- `addX(S, opts)` wraps `drawX` in `S.plane(z, ...)`. It works out the sprite box from the
  geometry, uses `S.light` unless `opts.light` is given, and returns the `Layer`.

Options shared by every `addX`:

| option | | |
|---|---|---|
| `z` | per element (below) | plane depth |
| `name` | per element | layer and sprite name |
| `res` | 1 (rocks, arch 1.25) | bake resolution |
| `mat` | `'paper'` (range, hills), `ROCK_MAT` (rocks, cliff, arch) | bake material |
| `shadow` | `{ blur: 14 }` (rocks 12, cliff/arch 16) | the plane's drop shadow onto planes behind: `{ blur, alpha, dx, dy }` or `false`. Alpha and offset fall back to the layer's or the scene's `shadow` |
| `layer` | `{}` | extra `S.add` options: `alpha` (number or `t => number`), `anim`, `blend`, `shadow`, `order`, `tags` |
| `box` | from geometry | `{ x, y, w, h }` override (not on `addCliff` / `addArch`) |

The sprite's silhouette edge light is fixed per element (`width` 1.4-1.6, `hi` 0.3, `lo` 0.2-0.3,
`soft` 0.6). No tags are added. Every other key goes to the `drawX` call.

## Which preset matches which reference

| Reference | Mountains | Hills | Stone |
|---|---|---|---|
| ref01 dusk bridge | `'dusk'` (pink and peach snow) | `'dusk'` (olive-yellow meadows) | `'dusk'` (mauve-grey river rocks) |
| ref02 night lake | `'lake'` (slate rock, lilac-grey snow) | `'night'` (pale olive to teal-green), `'forest'` under tree lines | `'perch'` (fox's perch, warm grey-brown, gold specks), `'river'` |
| ref04 waterfall canyon | gallery uses `'dusk'`, `haze: 0.25` for the far peaks | `'forest'` | `'canyon'` (walls, ledge), `'river'` |
| ref05 snow peaks | `'night'` (blue-violet rock, lavender/warm-white snow); `'ridge'` for the bare navy-teal front ridges | `'teal'` (far valley), `'forest'` | `'granite'` (cliff, trail) |
| ref08 aurora arch | (none of its own) | (none of its own) | `'arch'` (neutral warm grey): `drawArch`, cliffs |
| ref10 dawn | `'dawn'` (mauve rock, rose and cream snow) | `'dawn'` (golden slopes, teal shade) | `'dawn'` (sunlit sandstone) |

Gallery: `node tools/snap.mjs terrain --gallery --t 1,3,5`. It has three 2 s segments that
crossfade over 0.35 s: ref05 (t 0-2), ref02 (t 2-4) and ref04 (t 4-6), each recreated at the
reference's film positions. The camera sways ±40 px in x and is at rest at t = 1, 3 and 5.
Sky and water in the gallery are flat stand-ins. `drawArch`/`addArch` and
`drawSteppingStones` are not in the gallery.

## Light convention

`light` is a unit vector toward the key light in screen space, y down (`[0.5, -0.866]` is
the upper right). Only its **x component** decides which side is lit:

- mountains: facets on the flank toward the light and those facing it get the light ramp
  stops, bevels and contact shadows. With `light[0] = 0` facets differ only by small random
  variation, so the mountain looks flat.
- hills: the flank away from the light gets two torn shadow sheets (`light[0] >= 0`
  shades the left flank).
- cliffs: each column's lit face hugs the seam on the light side.
- boulders and arch: facets are lit by a normal (x and y of `light` both count).

## Mountains

### `addRange(S, opts) -> Layer`

A row of mountains baked on one sheet. Defaults: `z` 5000, `name` `'range'`, `mat`
`'paper'`, `res` 1. The box is `rangeBox(peaks, opts)`. Takes everything `drawRange` takes.

### `drawRange(ctx, { peaks = [], fade = null, ...common }) -> geometry[]`

Draws `peaks` **in array order, so the first is the furthest back**. Each peak is
`drawMountain(ctx, { seed: derived, ...common, ...peak })`.

- `common`: any `drawMountain` option shared by all peaks (palette, haze, light, snow, detail ...).
- `fade`: `{ color, from, to, alpha = 0.6 }` is a vertical gradient wash (transparent at y `from`,
  `alpha` at y `to` and beyond) laid `source-atop` over what this sprite has painted. Use it for valley haze.
- Seeds: a peak without its own `seed` gets `(common.seed ?? 1) * 97 + i * 13`. **A row-level
  `seed` overrides that derived seed, so every peak without its own seed gets the same one.**
  Give each peak its own `seed`, as the gallery does. Without one, reordering peaks changes their shapes.

### `drawMountain(ctx, opts) -> geometry`

A faceted mountain. Its jagged skyline has fall lines running down from spur shoulders and
gully notches. The strips between them are cut as facets, lit or shaded as they face the light.
Over them go the brush grain and small triangular chips. Torn snow pieces with a white rim go
on top: a cap per facet with a dripping lower edge, bands down the spurs and rock ribs breaking through.

| option | default | |
|---|---|---|
| `palette` | `'night'` | `MOUNTAIN_PALETTES` key or object |
| `haze` | 0 | 0..1. Pulls rock toward the haze colour by `haze` and snow by `haze * 0.6` (distance) |
| `hazeColor` | palette's `haze` | colour to haze toward instead (gallery ref05 far peaks: `'#b8a8d0'`) |
| `light` | `DEFAULT_LIGHT` | see above |
| `snow` | 0.45 | fraction of the height snow runs down the spurs (0 = bare rock) |
| `snowLow` | 0.35 | gully snow relative to spur snow |
| `snowline` | 0.8 | fraction of the height below the summit where ridge lines stop holding snow (falls off quadratically) |
| `ridge` | 0.8 | how far (fraction of height) snow bands run down the spurs below the cap. 0 = cap only |
| `detail` | 1 | 0..1: facet cuts, chips, rock slivers, brush grain. 0 = plain facets |
| `drips` | 1 | density of teeth on the snow edges |
| `contrast` | 1 | lit/shadow facet difference |
| `foot` | 0.55 | darkening toward the base (valley shade) |
| `edge` | 0.35 | strength of the lit/unlit bevel round the silhouette (a number here, not the sprite `edge`) |
| `cast` | `{ blur: 10, x: 0, y: 6 }` | shadow onto peaks drawn earlier on the same sheet, or `null`/`false` |
| `seed` | 1 | |
| + every `mountainGeometry` option | | |

### `mountainGeometry(opts) -> { x, y, baseY, bottom, h, sky, lines, faces, silhouette, left, right }`

The pure geometry, with no drawing. Options:

| option | default | |
|---|---|---|
| `x, y` | required | summit |
| `baseY` | required | ground line. The flanks reach it at `x - left` and `x + right` |
| `left`, `right` | 400, `left` | half widths at `baseY` |
| `bottom` | 160 | how far the body continues below `baseY`, with **vertical sides** (hide it behind nearer planes) |
| `spurs` | null | ridges per flank (sets both sides); `spursL`/`spursR` default `max(2, round(width / 60))` |
| `jag` | 1 | skyline roughness (crags and single-step chips) |
| `profile` | 1.25 | flank curvature: >1 is steep near the summit and concave lower down, 1 is straight. `profileL`/`profileR` per side |
| `shoulder` | 1.5 | slow sub-peak bumps on the flanks |
| `fan` | 1 | how far the fall lines lean outward |
| `summitLines` | 1 | fall lines from the summit |
| `crease` | 0.6 | chance of an extra crease splitting a facet |
| `seed` | 1 | |

The result's `bottom` is the **absolute** y of the body's lower edge (`baseY + bottom`). `sky`
is the skyline polyline from left to right, which you can use to place things along the ridge.
`silhouette` is the closed outline.

### `rangeBox(peaks, common = {}, pad = 40) -> { x, y, w, h }`

Bounding box from `x ± left/right`, the highest `y` and the lowest `baseY + bottom` (160 by default), plus `pad`.

### Palettes: `MOUNTAIN_PALETTES`, `mountainPalette(p = 'night', haze = 0, hazeColor = null)`

Each palette is `{ rock: [5 dark -> lit], snow: [5 shade -> sunlit], rim, haze, shadow }`.
The keys are `night`, `lake`, `ridge`, `dusk` and `dawn` (see the table above).
`mountainPalette` resolves a name or object and applies haze.

## Hills

### `addHills(S, opts) -> Layer`

Defaults: `z` 2500, `name` `'hills'`, `mat` `'paper'`, `res` 1. The box is `hillsBox(hills, opts)`.

### `drawHills(ctx, { hills = [], ...common }) -> crest[]`

Draws in array order (first = furthest back). Seeds work as in `drawRange`, derived as
`(common.seed ?? 1) * 31 + i * 7`. A row-level `seed` makes all unseeded hills share one.
Unseeded hills at the same index in different calls get the same wobble.

### `drawHill(ctx, opts) -> crest polyline`

A smooth dome. Contour strips of darkening greens are stacked down the slope, each torn
along its top with a darker rim. Two torn shadow sheets cover the flank away from the light,
and a pale torn crest strip with a light paper core runs along the top.

| option | default | |
|---|---|---|
| `x0`, `x1` | required | left and right feet (they meet `baseY` there) |
| `y` | required | crest height at `peakX` |
| `baseY` | required | ground line at the feet |
| `peakX` | `(x0 + x1) / 2` | x of the top. Off-centre makes an asymmetric dome |
| `round` | 1.6 | bell exponent: <1 is a broad flat dome, 1.2-1.7 the reference hills, >2 a narrow top with long concave feet |
| `wobble` | 6 | px of slow noise on the crest |
| `step` | 8 | crest sample spacing (px) |
| `bottom` | 200 | body below `baseY`. The sheet is a **rectangle with vertical sides at `x0`/`x1`** below the feet, so hide it or run `x0`/`x1` off frame |
| `palette`, `haze` | `'night'`, 0 | `HILL_PALETTES` key or object. Haze mixes toward the palette's own `haze` (there is no `hazeColor`) |
| `light` | `DEFAULT_LIGHT` | picks the shaded flank |
| `strips` | 5 | contour strips down the slope |
| `crest` | 10 | width (px) of the lit crest strip at the peak, tapering to the sides. 0 = none |
| `shadeAmt` | 1 | 0..1 opacity of the flank shadow sheets (0 = none) |
| `detail` | 1 | brush grain |
| `cast` | `{ blur: 12, y: 6 }` | shadow onto hills drawn earlier on the sheet, or `null` |
| `seed` | 1 | |

### `hillCrest({ x0, x1, y, baseY, peakX, round = 1.6, wobble = 6, seed = 1, step = 8 }) -> [[x, y], ...]`

The crest polyline alone. It is deterministic, so calling it with the **same options and seed**
as a drawn hill gives that hill's exact top edge. Use it to stand trees or the fox on a crest (see
Coordinates).

### `hillsBox(hills, common = {}, pad = 40)`, palettes `HILL_PALETTES`, `hillPalette(p = 'night', haze = 0)`

Each palette is `{ crest, ramp: [5 lit -> deep], shade, haze, rim }`. The keys are `night`,
`dusk`, `dawn`, `teal` and `forest`.

## Rocks

### `addBoulders(S, opts) -> Layer`

Defaults: `z` 900, `name` `'rocks'`, `res` 1.25, `mat` `ROCK_MAT`, `shadow` `{ blur: 12 }`.
The box is `bouldersBox(rocks, opts)`.

### `drawBoulders(ctx, { rocks = [], ...common }) -> geometry[]`

Seeds are derived from the array index (`(common.seed ?? 1) * 53 + i * 11`, with the same
row-level `seed` caveat). The rocks are then **sorted by base `y`**, so nearer (lower) rocks overlap farther ones whatever the array order.

### `drawBoulder(ctx, opts) -> { outline, plate, cells, x, y, w, h, top }`

A lump of paper crushed into planes. The outline is the hull of stacked irregular rings seen
from slightly above. The body is cut into Voronoi facets, each lit by a dome normal plus a
random tilt. Over them go ambient occlusion toward the ground, a lighter cut top plate (plate
shapes only), crack slivers, gold/dark/pale specks, moss patches and an optional snow cap.

| option | default | |
|---|---|---|
| `x, y` | required | **centre of the base on the ground**. The front edge sits about `w * tilt / 2` below `y` |
| `w, h` | 120, 80 | width; height from the base up to the top ring (`top = y - h`) |
| `shape` | `'round'` | `BOULDER_SHAPES` key (`round`, `pointy`, `flat`, `slab`, `block`) or `{ rings: [{ r, h }], plate }` |
| `tilt` | 0.32 | how much of the top is seen (ring ellipse squash) |
| `sides` | 6 | outline vertices per ring |
| `rough` | 0.24 | radius noise |
| `lean` | 0 | px the top shifts sideways |
| `facets` | auto | facet cells, `clamp(round(w * h / 1300), 5, 18)` |
| `palette` | `'perch'` | `STONE_PALETTES` key or object |
| `moss` | 0 | 0..1 moss patches on upward facets |
| `snow` | 0 | 0..1 snow slab over the top, drooping over the front |
| `specks`, `cracks` | 1, 1 | fleck density and crack probability multipliers |
| `contrast` | 1 | facet lighting strength |
| `detail` | 1 | brush grain |
| `cast` | `{ blur: 8, x: 0, y: 5 }` | shadow onto earlier pieces on the sheet, or `null` |
| `light`, `seed` | `DEFAULT_LIGHT`, 1 | |

`flat`, `slab` and `block` have a flat plate: a walkable top polygon (`geometry.plate`, the
hull of the top ring) cut into 2-5 lighter pieces. `slab` with a low `tilt` (0.16) and wide `w`
gives the ref02 perch.

### `boulderGeometry(opts)`

Same geometry options as above (`x, y, w, h, shape, tilt, sides, rough, lean, facets, seed`).
It returns the outline, the `plate` (or null) and the cells with their normals, without drawing.

### `drawSteppingStones(ctx, { stones = [], palette = 'river', ...common })`

A row of low stones: `stones` is `[[x, y, w, h?], ...]`, with `h` defaulting to `w * 0.28`.
Each is a `slab` with `tilt: 0.38` and `sides: 7`. There is no `add` variant: bake it with
`S.plane` using `bouldersBox(stones.map(([x, y, w, h]) => ({ x, y, w, h: h ?? w * 0.28 })))`.

### `drawTrail(ctx, opts)`

The snowy rocky trail of ref05. It has a torn band of red-brown earth with grit and pebbles,
snow slabs drifted along both edges and in patches across it, and granite blocks half buried
at the sides. More and bigger blocks go on the side away from the light. There is no `add` variant.

| option | default | |
|---|---|---|
| `path` | required | centreline, **near end first** |
| `width` | 90 | px at the near end. The edges wobble ±25 % |
| `taper` | 0.55 | width factor at the far end (linear) |
| `palette` | `'granite'` | stone palette for blocks and pebbles |
| `earth` | `['#4a2e22', '#7a4e38', '#a06e4e']` | dark, mid, light soil |
| `snow`, `rocks` | 1, 1 | 0..1 amounts |
| `light`, `seed` | `DEFAULT_LIGHT`, 1 | |

Blocks reach about one local width beyond each edge, so give the sprite that much margin.
The gallery's 180 px trail uses a box 560 x 720 around a path spanning x 435-640.

### `snowSlab(ctx, pts, rng, { light, thick = 5, colors = SNOW }) -> Path2D`

A thick snow piece: a blue shaded underside offset `thick` px below a white-to-pale-blue top
with a torn edge, white paper core and bevel. `rng` is an `RNG` instance from `core/rng.js`.
It is used by boulder caps, cliff tops and the trail, and you can use it for your own drifts.

### Palettes and materials

- `STONE_PALETTES`: `{ ramp: [crack, deep side, side, mid, top, lit top], fleck, moss: [dark, mid, light] }`.
  The keys are `perch`, `river`, `canyon`, `arch`, `dusk`, `dawn` and `granite`.
- `SNOW`: `{ top, mid, shade, deep, rim }`.
- `ROCK_MAT`: `[{ tex: 'stone', amt: 1 }, { tex: 'crumple', amt: 0.7, scale: 0.32 }]` (strong granite
  speckle over crushed facets). This is the default bake material for rocks, cliffs and arch, and is
  exported for your own rock sprites (the gallery's own cliff and trail planes use `'stone'`).
- `BOULDER_SHAPES`: ring stacks `{ rings: [{ r, h }], plate? }` (relative radius and height, top to bottom).

## Cliffs and arch

### `addCliff(S, opts) -> Layer`

Defaults: `z` 1400, `name` `'cliff'`, `res` 1, `mat` `ROCK_MAT`, `shadow` `{ blur: 16 }`.
The box is computed from `x, y, w, h, bottom, plateau, step, ragged` with `ragged + 40` px of side
padding. There is no `box` option.

### `drawCliff(ctx, opts) -> { top, outline }`

A canyon wall built as a row of stone columns with stepped, sloping tops and ragged sides. Each
column is a prism: a dark shadow face on one seam and slanted, lit slabs stacked down from the
light side. Dark tapering crevices run between columns, granite specks are scattered over the
face, and a top plateau and a ragged overhanging moss mat crown it.

| option | default | |
|---|---|---|
| `x, y, w, h` | required | front face: left edge, mean top line, width, visible height |
| `bottom` | 120 | the body continues to `y + h + bottom` and is **cut flat** there (hide it) |
| `palette` | `'canyon'` | `STONE_PALETTES` key or object |
| `cols` | 90 | mean column width (px). Columns vary 0.5-1.5x |
| `step` | 18 | spread of column tops around `y` (px) |
| `ragged` | 18 | how far the side silhouettes step in and out |
| `plateau` | 14 | depth (px) of the top surface seen from above, drawn above the top line. 0 = none |
| `deck` | `'moss'` | plateau surface: `'moss'` (green), any other value gives grey stone cut into paving plates (the ref04 walkway) |
| `moss` | 1 | 0..1 moss mat, tufts and tongues down the seams. On a stone deck it only fringes the front edge |
| `snow` | 0 | 0..1 snow slabs on the column tops (ref05 cliff: 0.9) |
| `detail` | 1 | brush grain and specks |
| `cast` | `{ blur: 14, x: 0, y: 8 }` | shadow onto earlier pieces on the sheet |
| `light`, `seed` | `DEFAULT_LIGHT`, 1 | |

`top` is the front top edge polyline from left to right.

### `addArch(S, opts) -> Layer` and `drawArch(ctx, opts) -> { outline, cut }`

The ref08 rock span is a band of chunky faceted blocks along a parabola from `(x0, y0)` to
`(x1, y1)`, rising `rise` px in the middle. Each block has a lit walkable top face, and moss
pads hang over the front. `addArch` defaults are `z` 1000, `name` `'arch'`, `res` 1.25,
`mat` `ROCK_MAT` and `shadow` `{ blur: 16 }`.

| option | default | |
|---|---|---|
| `x0, y0, x1, y1` | required | ends of the band's **top** line |
| `rise` | 80 | upward bulge of the curve at the middle |
| `thick` | 70 | band thickness at the middle, growing to 1.55x at the ends |
| `blocks` | 9 | stones along the span |
| `deck` | 14 | depth of the walkable top face (drawn above the top line) |
| `palette` | `'arch'` | |
| `moss` | 1 | moss pad on each block with chance `0.7 * moss`; half of them hang a strand over the front |
| `detail`, `cast`, `light`, `seed` | 1, `{ blur: 14, x: 0, y: 10 }`, `DEFAULT_LIGHT`, 1 | |

`cut` is `[{ top, bot }]` per block joint. The band has no legs: in ref08 it spans roughly
film (540, 540) to (1355, 690), so stand `addCliff` walls (`palette: 'arch'`) under both
ends. drawArch's specks are not clipped to the stone, so a few gold specks float around it.

## Coordinates and ground points

- All coordinates are authored film px with the camera at rest, at any `z`.
- **Mountain**: the summit is `(x, y)` and the flanks meet the ground at `(x - left, baseY)` and
  `(x + right, baseY)`. The body runs on to `baseY + bottom` with vertical sides.
- **Hill**: the feet are at `(x0, baseY)` and `(x1, baseY)` and the top at `(peakX, y)`. To stand
  something on the crest, rebuild it:
  ```js
  const crest = hillCrest({ x0: 600, x1: 1440, y: 440, baseY: 640, peakX: 880, round: 1.7, seed: 31 });
  const yAt = (x) => crest.find((p) => p[0] >= x)?.[1];   // crest y at x (8 px steps)
  ```
  The seed must be the one the hill was drawn with: its own `seed`, or `(rowSeed ?? 1) * 31 + i * 7`.
- **Boulder**: `(x, y)` is the base centre and the top is `y - h`. On plate shapes the walkable
  surface is `boulderGeometry({ ...sameOpts, seed }).plate`, centred on `y - h` and reaching
  about `w * tilt / 2` above and below it. For example, the ref02 perch slab (`x 545, y 800, w 540, h 100, tilt 0.16`)
  has its top at about y 700 ± 40.
- **Cliff**: the walkable surface is the plateau, from the top line (`y ± step`) up `plateau` px.
  The ref04 ledge (`y 718, step 8, plateau 34`) gives a fox floor of about y 685-720.
- **Arch**: the deck is from the top line up `deck` px.
- **Trail**: the band is centred on `path`. Things on the trail stand on the path points.
- **Overscan**: every box is fitted tightly to the geometry (pad 30-40 px). To cover camera
  moves, extend the geometry itself: run hill feet and outer peaks past the frame (220 px for
  far planes, 300 px for z < 800).

## Depth defaults

| element | default z | typical band |
|---|---|---|
| `addRange` | 5000 | far ranges 6000-9000, hero peak 6000-6500, front ridges 3200-4500 |
| `addHills` | 2500 | far hills 2200-3400, forest slopes 1600-3400 |
| `addCliff` | 1400 | canyon walls 1600-2400, hero ledge 900 |
| `addArch` | 1000 | hero plane |
| `addBoulders` | 900 | river rocks 820-1100, perch 950 |

## Animation

There is none: every element is a single baked, static sprite. Move or fade it through
`layer`: `layer: { alpha: t => ... }` (the gallery crossfades its segments this way) or
`layer: { anim: t => ({ x, y }) }` for whole-sheet drift. Parallax comes from `z`.

## Performance

- **Render**: one drop shadow and one sprite `drawImage` per plane. A gallery segment of about
  10 visible planes (stand-in sky and water included) renders in 6-8 ms per frame.
- **Bake** (headless Chrome, GPU canvas, rough figures including texture, edge and shadow):
  a 6-peak far range at `detail: 0.6` takes about 0.6 s, one hero peak 1280 px wide about 0.2 s,
  a hill about 0.06 s, 8 river boulders about 0.3 s, a 420 x 520 cliff about 0.12 s and an arch
  about 0.2 s. The whole three-segment gallery builds in about 1.2 s plus about 3 s on the first frame (GPU flush).
- Mountain cost is driven by `detail` (chips, slivers and grain per piece; `detail: 0` draws about
  3-4x faster than `detail: 0.6`) and by `snow`/`ridge` bands. Use `detail: 0.6` for far ranges, as the gallery does.
- Boulder cost scales with area (specks per area, Voronoi facets), and `addBoulders` bakes at
  `res` 1.25 by default. Keep `res: 1` for anything at z > 1000.
- Wide rows bake into one large canvas. Split a row only if parts need different `z` values.

## Examples (from `src/gallery/terrain.js`)

ref05 range: hazed far peaks, the hero peak, then the bare front ridges.

```js
const L = [0.5, -0.866];
addRange(S, {
  name: 'r05-far', z: 9000, palette: 'night', haze: 0.5, hazeColor: '#b8a8d0', light: L,
  snow: 0.75, snowline: 1, detail: 0.6, contrast: 0.7,
  peaks: [
    { x: 480, y: 226, left: 380, right: 360, baseY: 560, seed: 5 },
    { x: 850, y: 324, left: 300, right: 230, baseY: 520, seed: 1 },   // later entries draw in front
  ],
});
addRange(S, { name: 'r05-peak', z: 6500, palette: 'night', light: L, snow: 0.55, snowline: 0.9,
  peaks: [{ x: 1395, y: 218, left: 520, right: 760, baseY: 620, profile: 1.15, profileR: 1.45, seed: 11 }] });
addRange(S, { name: 'r05-ridges', z: 3200, palette: 'ridge', light: L, snow: 0, detail: 0.8,
  peaks: [{ x: 1470, y: 500, left: 300, right: 360, baseY: 660, profile: 1.05, seed: 31 }] });
```

ref02: moonlit hills, river rocks lit from the upper left, and the fox's perch.

```js
const L = [-0.5, -0.866];
addHills(S, { name: 'r02-hills', z: 2200, palette: 'night', light: L, strips: 5, crest: 10,
  hills: [{ x0: 600, x1: 1440, y: 440, baseY: 640, peakX: 880, round: 1.7 }] });
addHills(S, { name: 'r02-forest', z: 3400, palette: 'forest', light: L, strips: 3, crest: 4, shadeAmt: 0.4,
  hills: [{ x0: 380, x1: 1050, y: 420, baseY: 600, peakX: 600, round: 1.2 }] });
addBoulders(S, { name: 'r02-river-rocks', z: 820, palette: 'river', light: L, moss: 0.25,
  rocks: [{ x: 1137, y: 805, w: 100, h: 52, shape: 'round' }, { x: 1090, y: 900, w: 140, h: 70, shape: 'pointy' }] });
addBoulders(S, { name: 'r02-perch', z: 950, palette: 'perch', light: [0.5, -0.866], moss: 0.2,
  rocks: [
    { x: 545, y: 800, w: 540, h: 100, shape: 'slab', tilt: 0.16, sides: 9, rough: 0.08, seed: 7 },
    { x: 745, y: 816, w: 170, h: 90, shape: 'block', tilt: 0.3, seed: 8 },
  ] });
```

ref04: canyon walls at several depths and the fox's stone ledge.

```js
addCliff(S, { name: 'r04-cliff-back', z: 2400, x: 240, y: 230, w: 370, h: 520, seed: 71 });
addCliff(S, { name: 'r04-cliff-right', z: 1700, x: 1570, y: 340, w: 420, h: 520, cols: 100, step: 50, seed: 73 });
addCliff(S, { name: 'r04-ledge', z: 900, res: 1.25, x: 390, y: 718, w: 520, h: 170,
  cols: 110, step: 8, plateau: 34, deck: 'stone', moss: 0.7, seed: 76 });
```

ref05: a snowy granite cliff and the trail painted into your own planes (`draw` variants,
explicit box and light).

```js
S.plane(1050, {
  name: 'r05-cliff', x: -140, y: 400, w: 720, h: 820, res: 1.25, mat: 'stone',
  draw(ctx) {
    drawCliff(ctx, { x: -80, y: 520, w: 540, h: 520, palette: 'granite', light: L,
      cols: 120, step: 26, snow: 0.9, moss: 0.25, plateau: 22, seed: 81 });
  },
});
S.plane(950, {
  name: 'r05-trail', x: 280, y: 440, w: 560, h: 720, res: 1.25, mat: 'stone',
  draw(ctx) {
    drawTrail(ctx, { path: [[640, 1110], [600, 990], [560, 880], [520, 780], [485, 690], [455, 610], [435, 540]],
      width: 180, taper: 0.5, light: L, seed: 5 });
  },
});
```

## Kit helpers (`terrain-kit.js`)

These are re-exported for building your own terrain pieces.

| export | |
|---|---|
| `brush(ctx, path, { angle = PI/2, amt = 0.25, scale = 1, seed = 0 })` | brushed-paper strokes (light and dark) over a `Path2D`, running along `angle`. One draw call |
| `lift(ctx, path, { dx = 0, dy = 1.5, color = 'rgba(0,0,0,0.3)' })` | cheap unblurred contact shadow: the path filled offset |
| `sliver(pts, w, { bias = 0 })` | polygon along a polyline, `w` wide in the middle and pointed at both ends (cracks, ribs, moss tongues). `bias` -1..1 pushes width to one side |
| `lengths(pts)`, `pointAt(pts, L, d)`, `segment(pts, L, d0, d1)`, `dirAt(pts, L, d)` | arc-length sampling of open polylines (`L = lengths(pts)`) |
| `xAtY(pts, y)` | x of a top-to-bottom polyline at height y |
| `boxOf`, `areaOf`, `centroid`, `hull(points)` | polygon basics (`boxOf` returns `{ x, y, w, h }`, `hull` is the convex hull) |
| `voronoi(convexPoly, seeds, { sy = 1 })` | Voronoi cells clipped to a convex polygon: `[{ seed, i, pts }]`. `sy` > 1 flattens cells |
| `inset(pts, d)` | shrink toward the centroid by `d` px (cut seams) |
| `scatterIn(poly, n, rng, { gap = 0 })`, `insidePath(path, x, y)` | random points inside a polygon, and a point-in-path test |
| `clamp01`, `DEFAULT_LIGHT` | |
