# Flora

`src/elements/flora.js` is the public API. It sits on `flora-kit.js` (palettes, the breeze,
outline and shading helpers), `flora-flowers.js` and `flora-foliage.js` (one draw function
per element) and `flora-beds.js` (hand-placed presets). It provides the swaying foreground
flower clusters that frame most shots and static midground meadow bands. Every single flower,
leaf, fern, shrub, moss cushion and fly agaric is also a draw function you can use in your
own sprites.

Gallery: `node tools/snap.mjs flora --gallery --t 1,4,6.5`. Three 8/3 s segments show the
references' own corners. 0-2.67 s is ref02: the `night-lake` bed bottom-left, three shrubs
from `makePlant` at z 900 and a meadow at z 1300. 2.67-5.33 s is ref01: the `dusk-bridge`
bed bottom-left and a generated dusk bed bottom-right. 5.33-8 s is ref03: `forest-left` and
`forest-right`.

```js
import {
  addFlowerBed, addMeadow, makePlant, generateBed, FLOWER_BEDS,
  FLORA_PALETTES, FLORA_PAPER, floraPalette, breeze, drawStem, drawBacking,
  drawEchinacea, drawEchinaceaPetals, drawConeflowerCone, drawDaisy, drawTansy, drawMarigold,
  drawZinnia, drawAstilbe, drawLupine, drawLarkspur,
  drawLeaf, drawBlade, drawTuft, drawUndergrowth, drawSprig, drawFern, drawClover,
  drawLobedLeaf, drawShrub, drawMoss, drawAmanita,
} from '../elements/flora.js';
```

| level | use for | motion |
|---|---|---|
| `draw*(ctx, opts)` | painting one element inside any sprite's `draw(ctx)` | none; you bake and place it |
| `makePlant(S, item)` | baking one element into sprites with a pivot at its stem base | you place it |
| `addFlowerBed(S, opts)` | a whole cluster (preset, your rows, or generated) on its own plane(s) | sways in the breeze |
| `addMeadow(S, opts)` | a band of small flowers and grass baked into one plane | static |

## Conventions

- Positions are in film pixels with the camera at rest. Presets are already in film pixels:
  the reference coordinates were multiplied by 1.1483.
- `rot` is in radians. 0 points up, and positive turns clockwise (tip to the right).
- **Anchors.** Headed flowers take `base: [x, y]` (the stem foot) and `head: [x, y]` (the
  flower centre; for a coneflower, the centre of the petal ring, where the cone sits). Every
  other element is anchored at `x, y`, the point where it meets the ground: the base of a
  leaf, blade, tuft, sprig or fern, the stem foot of a spike or mushroom, and the base centre
  of a shrub or moss cushion. Clover is the exception: `x, y` is the centre of the leaf and
  `stalk: [x, y]` is the stalk foot. Undergrowth covers `x0..x1` above a ground line `y`.
  Backing fills the region `x0, y0, x1, y1`.
- **`lean` means three different things.** For astilbe, lupine, larkspur and sprig it is the
  top's sideways offset as a fraction of `h`. For tuft it is the angle, in radians, that the
  whole fan turns. For amanita it is the stem's tilt in radians.
- Leaf and blade `width` is the half-width as a fraction of `len`. `size`, `r`, `len`, `h`
  and `w` are in px.
- Stems run off the bottom of the frame: presets put stem feet at y 1090-1140 so the cut
  never shows when the camera moves.
- `light` defaults to `[0.55, -0.83]` in every draw function. `makePlant`, `addFlowerBed` and
  `addMeadow` pass `S.light` instead, so inside your own `draw(ctx)` pass `light: S.light` too.
- `seed` defaults to 1 on every element. The same seed always gives the same cut.
- **Colour fields.** `color`/`tone` on a leaf, blade or stem leaf, and the entries of
  `tones`, accept a palette `leaf` key (`light`, `mid`, `dark`, `deep`, `yellow`, `lime`) or
  any CSS colour. Fern `color` accepts a `fern` key (`light`, `mid`, `teal`, `dark`) or a
  colour.

## Palettes (`FLORA_PALETTES`, `floraPalette`)

| palette | matches | differs from night |
|---|---|---|
| `night` (default) | ref02, ref09 | magenta-pink coneflowers with orange cones, cream daisies, crimson astilbe, deep greens |
| `dusk` | ref01 | purpler coneflowers, warmer daisies, redder astilbe, bright yellow-green leaves |
| `forest` | ref03 | cool grey-white daisies, darker cool leaves, bluer violet lupine |
| `dawn` | ref10 | warmer pink coneflowers with gold cones, warmer astilbe, olive leaves |

Keys, one group per element:
- `echinacea`: `petals[5]` (back/shaded to front/lit), `petalDark`, `petalLight`, `cone`, `coneLight`, `coneDark`
- `daisy`: `petal`, `tip`, `shade`, `center`, `centerDark`
- `tansy`: `ball`, `light`, `dark`
- `astilbe`: `florets[4]`, `light`, `dark`, `stem`
- `lupine`: `florets[3]`, `banner`, `light`, `dark`, `bud`, `budTip`, `stem`
- `larkspur`: `petal`, `light`, `dark`, `center`
- `zinnia`: `petals[3]`, `dark`, `center`
- `marigold`: `petal`, `light`, `dark`
- `leaf`: `light`, `mid`, `dark`, `deep`, `yellow`, `lime`
- `stem` (a single colour)
- `fern`: `light`, `mid`, `teal`, `dark`
- `clover`: `leaf`, `light`, `dark`
- `shrub`: `top`, `mid`, `low`, `stem`, `dark`
- `moss`: `light`, `mid`, `dark`
- `amanita`: `cap`, `capLight`, `capDark`, `spot`, `gill`, `stem`, `stemDark`

`floraPalette(p)` resolves a palette: a name (unknown names fall back to night), or a partial
object deep-merged **onto night**. Arrays are replaced whole. To change one key of another
palette, spread that palette:
`{ ...FLORA_PALETTES.dusk, leaf: { ...FLORA_PALETTES.dusk.leaf, mid: '#7a9a3a' } }`.
Every `palette` option (bed, item, meadow, draw function) goes through `floraPalette`.

## `addFlowerBed(S, opts)` -> `Layer[]`

| option | default | |
|---|---|---|
| `preset` | none | `'night-lake'`, `'dusk-bridge'`, `'forest-left'`, `'forest-right'`, or an object `{ rows, palette, wind }`. **An unknown name silently gives a generated bed.** The source comment's `'portal'` and `'dawn'` do not exist. |
| `rows` | the preset's | `[[item, ...], ...]`, back row first. Replaces the preset's rows. |
| `region, anchor, density, mix, scale, seed` | | generated-bed options (see `generateBed`), used when there is neither a preset nor `rows` |
| `palette` | preset's, else `'night'` | name or partial override |
| `z` | 480 | depth of the front plane (the foreground flower band is 420-600) |
| `planes` | 1 | number of planes the rows are split over (at most `rows.length`) |
| `depth` | 120 if `planes` > 1, else 0 | z spread: the back group sits at `z + depth`, the front group at `z` |
| `mirror` | false | reflects about x = 960: negates `rot`, `lean`, `roll`, `curl`, `bow`, swaps `anchor`, reverses `edge` |
| `scale` | 1 | scales positions and the sizes `size`, `r`, `len`, `h`, `w`, `coneW`, `leaf` about `(ox, oy)`. Other px fields are not scaled: `stemWidth`, sprig `width`/`leafLen`, moss `scale`. |
| `ox, oy` | 0, 1080 | scale origin (bottom-left corner of the frame); use `ox: 1920` for a right-hand bed |
| `dx, dy` | 0, 0 | offset, applied after mirroring and scaling |
| `wind` | `{ amp: 0.035 }` | `breeze` options `{ amp, period, gust, speed, seed }` (presets define none) |
| `light` | `S.light` | |
| `res` | **1** | bake resolution of every sprite. The source comment says 1.25 but the code passes `undefined`, so it is 1. Use 1.25-1.5 if the camera pushes in. Backing is always baked at 1. |
| `order` | 0 | tie-break at equal z |

**What it adds.** It adds `planes` layers named `flowerbed-0`, `flowerbed-1`, and so on.
They draw only through `render()`; nothing is repainted, because the sprites are baked once
and transformed each frame. Each frame, every row is drawn in three `drawSprites` passes:

- pass 0: stems, leaves, all foliage, backing and undergrowth
- pass 1: flower heads, the three spikes (astilbe, lupine, larkspur) and amanitas
- pass 2: coneflower cones

A pass draws all of its shadows before any of its paper. Pieces in the same pass of the same
row therefore never shadow each other, while later passes and later rows shadow everything
drawn before them. Put tall background pieces in early rows.

Per-sprite drop shadows (blur / alpha):

| part | blur | alpha |
|---|---|---|
| stem | 5 | 0.5 |
| head | 8 | 0.55 |
| leaf and other foliage | 7 | 0.5 |
| cone | 6 | 0.5 |
| undergrowth | 8 | 0.45 |
| amanita | 10 | 0.55 |
| backing | 12 | 0.5 |

The shadow offset is the scene's, cast away from the light. The material is `FLORA_PAPER`
(fibre 0.85 plus crumple 0.55 at scale 0.42), except cones and tansy balls, which use
`felt`. There is no silhouette edge pass, because every piece carries its own bevel.

**Animation.** Each plant rotates about its pivot (the stem foot) by
`breeze(t, x, { ...wind, phase }) * sway`. A head rides the stem tip and nods 1.3x the stem
angle, plus its own smaller breeze (0.45x amp, 2.7 s period) that runs 0.35 s behind the
stem. With the default amp, the lean stays within about 0.07 rad at sway 1. Gusts roll left
to right at 260 px/s, so neighbouring stems lean together, with a slight bias to the right.
Each plant's phase is hashed from its type and position; set `phase` on an item to override
it. The motion is continuous for any `t` and never loops.

Sway per type (override with `sway` on an item):

| type | sway |
|---|---|
| tansy | 1.15 |
| daisy | 1.1 |
| echinacea | 1 |
| zinnia | 0.95 |
| marigold, sprig | 0.9 |
| astilbe, larkspur | 0.8 |
| lupine | 0.7 |
| blade | 0.6 |
| tuft, fern | 0.55 |
| leaf | 0.45 |
| clover | 0.35 |
| undergrowth | 0.25 |
| shrub | 0.2 |
| backing | 0.12 |
| moss, amanita | 0 |

**Gotchas**

- There is no `alpha` option. To fade or cut a bed, set it on the returned layers:
  `for (const L of layers) L.alpha = (t) => ...`.
- On a generated bed, `scale` is applied twice: once to the element sizes in `generateBed`,
  then again to the placement about `(ox, oy)`. Size a generated bed with `region` and leave
  `scale` at 1.
- An item's `palette` object merges onto night, not onto the bed's palette.
- Headed types need `base`. Without it the pivot falls back to `[x ?? 0, y ?? 0]` and the
  head swings around the frame origin. Give `sway: 0` for a stemless head.
- For a single swaying plant, use `addFlowerBed(S, { rows: [[item]], z })`.

## Presets (`FLOWER_BEDS`)

| key | matches | palette | covers | rows / items / sprites |
|---|---|---|---|---|
| `night-lake` | ref02 bottom-left: two coneflowers, daisies, billy buttons and astilbe in front of a yellow-green shrub, a speckled round leaf and dark foliage | `night` | x -300..760. The top edge runs from y 575 at the left down to 940 at x 760 (room for the rock beside it). | 5 / 57 / 74 |
| `dusk-bridge` | ref01 bottom-left: purple coneflowers, lupines, marigolds, a red zinnia and many 11-petal daisies in a sunlit meadow | `dusk` | x -300..800, top from y 420 down to 960 | 5 / 38 / 56 |
| `forest-left` | ref03 bottom-left: three fly agarics, 5-petal anemones, ferns, larkspur and teal clover | `forest` | x -300..880, top from y 480 down to 920 | 5 / 29 / 37 |
| `forest-right` | ref03 bottom-right: a big fly agaric with smaller ones, moss, ferns, larkspur and small orange and yellow flowers. The mossy log belongs to the terrain. | `forest` | x 1200..2220, top from y 940 up to 520 at the right | 4 / 16 / 18 |

Each preset's first row is a `backing` that extends 300 px past the frame on its anchored
side and down to y 1380. This covers near-plane overscan on that side. The open side breaks
up into single leaves. Use `mirror: true` to put a preset in the other bottom corner;
mirroring `night-lake`, for example, gives x 1160..2220.

## `generateBed(opts)` -> `{ rows }`

A reference-like cluster built from a region and a mix. `addFlowerBed` calls it with its own
`opts` when there is no preset and no `rows`.

| option | default | |
|---|---|---|
| `region` | `[0, 600, 640, 1080]` | `[x0, y0, x1, y1]`; elements cluster toward the bottom corner on the `anchor` side |
| `anchor` | `'left'` | `'left'` or `'right'` |
| `density` | 1 | 1 is about as dense as ref02 |
| `mix` | `{ echinacea: 1.2, daisy: 3, tansy: 1.6, astilbe: 1, lupine: 0, leaf: 3, blade: 3 }` | relative counts. **Replaces the default whole**: missing keys count 0. Only these 7 keys are read. |
| `scale` | 1 | element size multiplier |
| `seed` | `'bed'` | |

Count per type = `round(mix[k] * density * w * h / 300000 * 1.5)`. The default region gives
2 coneflowers, 5 daisies, 2 tansies, 2 astilbes, 5 leaves and 5 tufts, plus 3 front blades.

It returns six rows:
1. a backing extending 300 px past the anchored side and down to y1 + 300
2. leaves and tufts
3. the highest third of the flowers
4. the middle third of the flowers
5. the lowest third of the flowers
6. front blades

Flowers are sorted by their top, so lower flowers are nearer. Stems reach y1 + 80.

## `addMeadow(S, opts)` -> `Layer`

A static band of small flowers and grass baked into **one sprite** on one plane, for
midground meadows. It has no ground fill, so lay it over a hill or terrain piece whose top is
a little above `y`.

| option | default | |
|---|---|---|
| `z` | 1300 | |
| `x0, x1` | -200, W + 200 | extent (overscan included) |
| `y` | 900 | ground line (bottom of the band) |
| `h` | 120 | band height; grass is 0.35-0.8 h, spikes 0.6-1 h |
| `density` | 1 | items per 100 px times the mix |
| `mix` | `{ daisy: 3, tansy: 2, astilbe: 1, lupine: 0.6, grass: 8, echinacea: 0.3 }` | merged with the default (unlike `generateBed`) |
| `scale` | 1 | flower size (1 suits z ~1200): daisy r 6-11, tansy r 4-7, astilbe w 16-26, lupine w 10-14, coneflower size 18-26 |
| `palette, light, seed, res` | night, `S.light`, `'meadow'`, 1 | |

The sprite box is `x0 - 40 .. x1 + 40` by `y - 1.3h .. y + 50`. It uses the house `paper`
material with a silhouette edge, and a shadow of blur 5, alpha 0.45. To fade it, set `.alpha`
on the returned layer.

## `makePlant(S, item, opts = {})` -> plant

Bakes one element. `opts`: `{ palette, light = S.light, res = 1 }`. `item.palette` wins over
`opts.palette`. An unknown `type` throws.

Returns `{ type, x, y, head, sway, phase, parts: [{ s, head?, pass }] }`:
- `(x, y)` is the pivot: `item.base`, else `((x0 + x1) / 2, y1 ?? y)` for a region, else `(item.x, item.y)`.
- `head` is the item's head point or null. Parts with `head: true` ride the stem tip.
- `pass` is the draw pass described above.

To draw a static plant, place its sprites as they are. The gallery's shrubs do this; a
static `sprites: [...]` layer works just as well. To animate a plant without heads yourself:

```js
const p = makePlant(S, { type: 'lupine', x: 1250, y: 1100, h: 300, w: 60, seed: 4 });
S.add({ z: 600, render(ctx, t, env) {
  const rot = breeze(t, p.x, { phase: p.phase }) * p.sway;
  drawSprites(ctx, p.parts.map((q) => ({ s: q.s, ax: p.x, ay: p.y, x: p.x, y: p.y, rot })), env.shadow);
} });
```

### Item types

Every item also takes `type`, `seed`, `palette` (partial, merged onto night), `sway` and
`phase`. The remaining fields are the draw function's options.

| type | anchor | size (defaults) | other options (defaults) | sprites |
|---|---|---|---|---|
| `echinacea` | `base`, `head` | `size` 110 (petal length), `coneW` size x 0.64, `stemWidth` size x 0.055 | `petals` 8, `back` 2 (short petals behind the cone), `spread` 3.4 (fan angle, centred on straight down), `roll` 0, `width` 0.27; cone: `tilt` 0.55, `turns` 4.2 | stem, petals, cone (felt) |
| `daisy` | `base`, `head` | `r` 28, `stemWidth` max(2.2, 0.12r) | `petals` 8 (5-6 give broad anemone petals, as in ref03; dusk-bridge uses 11), `squash` 0.88, `rot` 0, `center` 0.27 | stem, head |
| `marigold` | `base`, `head` | `r` 40, `stemWidth` max(2.6, 0.1r) | `squash` 0.9 | stem, head |
| `zinnia` | `base`, `head` | `r` 40, `stemWidth` max(2.6, 0.1r) | `squash` 0.85, `layers` 3, `petals` 10, `rot` 0 | stem, head |
| `tansy` | `base`, `head` | `r` 18, `stemWidth` max(2.2, 0.16r) | | stem, head (felt) |
| `astilbe` | `x, y` stem foot | `h` 150, `w` 64 (plume width) | `lean` 0, `plume` 0.62, `bow` 0, `stem` true | 1 (pass 1) |
| `lupine` | `x, y` | `h` 160, `w` 36 | `lean` 0, `spike` 0.58, `bow` 0, `stem` true | 1 (pass 1) |
| `larkspur` | `x, y` | `h` 200, `w` 70 | `lean` 0, `spike` 0.65, `bow` 0 | 1 (pass 1) |
| `leaf` | `x, y` base | `len` 120, `width` 0.2 | `rot` 0, `curl` 0, `belly` 0.4, `base` 0.12, `tip` 0, `taper` 1, `round` 0, `veins` 6, `serrate` `{ count, depth }`, `speckle` (pale flecks), `dark` 0.22, `lift` 0.1, `color`/`tone` `'mid'` | 1 |
| `blade` | `x, y` | `len` 200, `width` 0.06 | `rot` 0, `curl` 0.15, `color`/`tone` `'light'`, `dark` 0.24, `lift` 0.12 | 1 |
| `tuft` | `x, y` root | `len` 160 (longest blade), `n` 7 | `spread` 0.9, `width` 0.05, `lean` 0 (rad), `tones` `['light','mid','lime']`, `color` | 1 |
| `sprig` | `x, y` | `h` 140, `leafLen` 30, `width` 2.6 (stem) | `lean` 0, `bow` 0.04 (random side), `leaves` 4, `bud` true (daisy petal colour, a colour, or false), `color` (stem), `leafColor` | 1 |
| `fern` | `x, y` rachis foot | `len` 220 | `rot` 0, `curl` 0.25 (arch), `reach` 0.26 (longest pinna / len), `angle` 1.0, `pinnae` auto (8-20 pairs), `color` `'mid'` | 1 |
| `clover` | `x, y` leaf centre | `r` 30 (leaflet length) | `rot` 0, `squash` 0.8, `leaflets` 3, `stalk` `[x, y]` or none, `color` | 1 |
| `shrub` | `x, y` base centre | `w` 200, `h` 110, `leaf` 22 (lobed leaf radius) | `density` 1 | 1 |
| `moss` | `x, y` base centre | `w` 120, `h` 40, `scale` 1 (scale size and tear) | | 1 |
| `amanita` | `x, y` stem foot | `size` 120 (cap width) | `tall` 0.6 (stem / size), `lean` 0 (rad), `spots` 1 | 1 (pass 1) |
| `undergrowth` | `x0, x1`, `y` ground line | `h` 260 (tallest blade) | `edge` `[[x, y], ...]` top profile (else flat at y - h), `density` 1 (blades per 10 px), `tones` `['mid','light','dark','lime']`, `stems` 0.25 (share of thin leafy stems) | 1; blades root at y..y+70 |
| `backing` | `x0, y0, x1, y1` | | `anchor` `'left'`, `'right'` or `'none'` (without `edge`, the top slopes down away from the anchor), `edge`, `density` 1, `tones` `{ top: 'dark', bottom: 'deep' }` | 1, res 1, box from y0 - 160 |

Headed types also take stem options:
- `bow`: the stem's sideways bulge in px; default `(head.x - base.x) * 0.2`
- `leaves`: `[drawLeaf opts]` baked into the stem sprite. Each leaf's `x, y` default to `base`,
  and its `color`/`tone` defaults to `'mid'`.

## Draw functions

Use these inside any `draw(ctx)` and bake them yourself. Every one also accepts `palette`,
`light` and `seed`. Positions follow the anchors above.

Flowers:
- `drawEchinacea(ctx, { x, y, size = 110, coneW = size * 0.66, petals = 8, back = 2, spread = 3.4, roll = 0, width = 0.27, tilt, turns })`: petals and cone in one sprite (beds bake the cone separately in felt)
- `drawEchinaceaPetals(ctx, { x, y, size, petals, back, spread, roll, width })`: the hanging fan, shaded under the cone
- `drawConeflowerCone(ctx, { x, y, w = 72, h = w * 0.64, tilt = 0.55, roll = 0, turns = 4.2 })` -> `Path2D`. `x, y` is the centre of the cone's base. Bake it with `mat: 'felt'`.
- `drawDaisy(ctx, { x, y, r = 28, petals = 8, squash = 0.88, rot = 0, center = 0.27 })`
- `drawTansy(ctx, { x, y, r = 18 })`: felt ball with a small calyx below
- `drawMarigold(ctx, { x, y, r = 40, squash = 0.9 })`: about 1.5r frilled petals in a spiral
- `drawZinnia(ctx, { x, y, r = 40, squash = 0.85, layers = 3, petals = 10, rot = 0 })`
- `drawAstilbe(ctx, { x, y, h = 150, w = 64, lean = 0, plume = 0.62, bow = 0, stem = true })`
- `drawLupine(ctx, { x, y, h = 160, w = 36, lean = 0, spike = 0.58, bow = 0, stem = true })` -> axis points
- `drawLarkspur(ctx, { x, y, h = 200, w = 70, lean = 0, spike = 0.65, bow = 0 })` -> axis points

Foliage:
- `drawLeaf(ctx, { x, y, len, width, rot, curl, belly, base, tip, taper, round, veins, serrate, speckle, dark, lift, color })` -> `Path2D`
- `drawBlade(ctx, { x, y, len = 200, width = 0.06, rot = 0, curl = 0.15, dark, lift, color })` -> `Path2D`
- `drawTuft(ctx, { x, y, n = 7, len = 160, spread = 0.9, width = 0.05, lean = 0, tones, color })`
- `drawSprig(ctx, { x, y, h = 140, lean = 0, bow = 0.04, leaves = 4, leafLen = 30, width = 2.6, bud = true, color, leafColor })`
- `drawUndergrowth(ctx, { x0 = 0, x1 = 600, y = 1080, h = 260, edge, density = 1, tones, stems = 0.25 })`: cheap unclipped blades, built for dense fills
- `drawFern(ctx, { x, y, len = 220, rot = 0, curl = 0.25, reach = 0.26, angle = 1, pinnae, color })` -> rachis points
- `drawClover(ctx, { x, y, r = 30, rot = 0, squash = 0.8, leaflets = 3, stalk, color })`
- `drawLobedLeaf(ctx, { x, y, r = 26, rot = 0, lobes = 6, depth = 0.38, stretch = 1.2, color = shrub.top })` -> `Path2D`. `x, y` is the stalk end.
- `drawShrub(ctx, { x, y, w = 200, h = 110, leaf = 22, density = 1 })`: about `w*h / (1.7 leaf²)` lobed leaves, crown leaves on stalks
- `drawMoss(ctx, { x, y, w = 120, h = 40, scale = 1 })`
- `drawAmanita(ctx, { x, y, size = 120, tall = 0.6, lean = 0, spots = 1 })`
- `drawBacking(ctx, { x0, y0, x1, y1, anchor = 'left', edge, density = 1, tones })`: a shadow sheet under about `(x1 - x0)(y1 - y0) / 2000` leaves
- `drawStem(ctx, pts, { width = 4, tipWidth = width * 0.7, color = night stem, shadow = true })` -> `Path2D`: a tapered ribbon along a polyline

Kit exports:
- `breeze(t, x, { amp = 0.035, phase = 0, period = 4.2, gust = 1, seed = 'breeze', speed = 260 })` -> radians.
- `FLORA_PAPER`: the material recipe.
- `shade`: re-exported from `core/color.js`.

These lower-level helpers are not re-exported, so import them from `./flora-kit.js`:
`DEFAULT_LIGHT`, `bladeOutline`, `bladeMidline`, `curve(a, b, bow, n)`, `ribbon`,
`foldedBlade`, `foldShade`, `creaseLine`, `bevelOf`, `feltDots`, `shadeOver`, `linearAlong`
and `placer`. `quickBlade` comes from `./flora-foliage.js`.

## Examples

```js
// drawSprites comes from '../core/sprite.js'.
// Gallery, ref02: preset corner on one foreground plane (the gallery wraps each call in
// show(), which sets layer.alpha for its segment).
addFlowerBed(S, { preset: 'night-lake', z: 480 });

// Gallery, ref01: generated bed in the bottom-right corner.
addFlowerBed(S, { region: [1300, 660, 1920, 1080], anchor: 'right', palette: 'dusk', seed: 'gallery-dusk',
  mix: { echinacea: 0.8, daisy: 3, astilbe: 1, lupine: 1, leaf: 2, blade: 4 }, z: 500 });

// Gallery, ref02: midground meadow over a hill at z 1400, plus static shrubs from makePlant.
addMeadow(S, { z: 1300, x0: 600, x1: W + 250, y: 1010, h: 110, seed: 'm1' });
const shrubs = [
  makePlant(S, { type: 'shrub', x: 1180, y: 960, w: 280, h: 150, leaf: 22, seed: 5 }),
  makePlant(S, { type: 'shrub', x: 1560, y: 930, w: 340, h: 180, leaf: 26, seed: 3 }),
];
S.add({ name: 'shrubs', z: 900, render(ctx, t, env) { drawSprites(ctx, shrubs.map((p) => ({ s: p.parts[0].s })), env.shadow); } });

// Not from the gallery (checked to render): mirrored preset on two planes, and your own rows.
addFlowerBed(S, { preset: 'night-lake', mirror: true, planes: 2, z: 470 });
addFlowerBed(S, { palette: 'dawn', z: 520, rows: [
  [{ type: 'backing', x0: 700, y0: 760, x1: 1250, y1: 1380, anchor: 'none' }],
  [{ type: 'tuft', x: 980, y: 1110, n: 8, len: 220, seed: 2 },
   { type: 'echinacea', base: [900, 1120], head: [890, 900], size: 110, seed: 3 }],
] });
// One flower in your own sprite.
S.plane(560, { name: 'anemone', x: 560, y: 560, w: 120, h: 120, mat: FLORA_PAPER, edge: false,
  draw(ctx) { drawDaisy(ctx, { x: 620, y: 620, r: 40, petals: 5, palette: 'forest', light: S.light, seed: 9 }); } });
```

## Depth and cost

- **Typical depths.** Beds sit at 470-520, with `planes: 2-3` and the default `depth` 120
  for parallax inside the cluster. Shrub mounds go around 900, meadows at 1250-1400.
- **Bake.** The whole flora gallery (four presets, a generated bed, a meadow, three shrubs
  and backdrops) builds in about 3.2 s cold. With paper textures already warm, one preset
  bakes in about 0.1-0.3 s; the first bed in a scene can take about 0.9 s. The backing is
  the most expensive single piece (a ~1100x1000 sprite with ~400 leaves), and a shrub is
  the most expensive small plant (about 25 ms). A full-width meadow bakes in about 0.15 s.
  Raising `res` costs roughly `res²`.
- **Per frame.** A bed costs one `drawSprites` call per pass per row. Each sprite is drawn
  twice (shadow and paper) under a rotation, for 18-74 sprites per preset. Measured in
  headless Chrome, that is about 2-7 ms per bed on top of an empty frame; the full gallery
  frame renders in about 10 ms. A meadow is a single sprite draw.
- **Overscan.** Presets cover their anchored side to x -300 (or 2220) and y 1380. On the
  open side, check camera moves with `--cam`, or place a second bed there.
