# Fox family (`src/elements/fox.js`)

The hero: an orange paper fox built silhouette first, then fur. Each pose's body (neck,
back, rump, haunch, belly and chest) is ONE smooth cut-out traced from the reference,
shaded with soft paper overlays (lit back, shoulder and haunch top; shadow under the
belly, behind the shoulder and in the crease in front of the thigh). Over it lie rows of
fewer, larger, cleaner torn-paper flakes (about 1.3x the rig's tuft size, 50-75 units long):
broad pointed pieces with one to three short points and a barb or two in their sides,
laid in clear shingled rows from the rump toward the head. Each row casts ONE soft, light
contact shadow on the row it laps over (`castGroup`: the row's union, blurred), so pieces
of one row cast nothing on each other and smooth paper shows between rows on the flank and
thigh; a few lighter highlight flakes run along the back. Standing and walking, the body is lean (a slim waist, a deep
chest, long legs) and the edge stays subtle: every body tuft is fitted so its tips reach
at most 6-9 units past the outline (the mane 5 past the neck line); only the tail, the
cheek ruff and the chest bib run longer. The thigh is a crisp cut-out of its own laid
inside the body silhouette (clipped to it, never sticking out as a disc), lit on its
upper front with a cut-edge bevel and a few torn strips, with the back fur lapping over
its top. The sitting pose keeps the looser fur of the previous pass.

One call bakes every animated part as its own sprite and adds a single plane that poses
and draws the fox each frame. It breathes, shifts its weight, flicks its ears, sways its
tail, looks up, walks with paws that stay planted, and reacts to wind. Everything is
procedural and deterministic, and every frame is a pure function of `t`.

```js
import { createFox, foxPalette, FOX_PALETTE, FOX_PAPER } from '../elements/fox.js';
```

Scenes only need `createFox`. The other two files are internals: `fox-rig.js` holds the
skeletons and body outlines traced from the references (`RIGS`, `rigFor`, `ik2`, `bendOf`)
and `fox-paint.js` holds the painters (`paintBody`, `furRows`, `tuft`, `paintHead`,
`tintColor`, and others). They are covered in [Internals](#internals).

Gallery: `src/gallery/fox.js`. Each 4 s window stages one pose where and at the size its
reference fox stands, so a render can be compared crop for crop with the reference.

```powershell
node tools/snap.mjs fox --gallery --t 1,5,9 --out out/fox          # stand (ref02), walk (ref01), sit (ref10)
node tools/sheet.mjs fox --gallery --from 4 --to 8 --n 12 --cols 4 --crop 300,250,800,450 --out out/fox/walk.png
```

## `createFox(S, opts) -> { layer, rig, palette, state, pointAt, options }`

| option | default | |
|---|---|---|
| `pose` | `'stand'` | `'stand'`, `'walk'` or `'sit'`. Any other value falls back to `stand` |
| `x`, `y` | 620, 706 | **ground point**: the spot on the ground between the paws, in plane coordinates. The defaults are the ref02 perch |
| `z` | 950 | plane depth (hero band 900-1000) |
| `scale` | 1 | 1 = the ref02 fox (about 355 px from ear tip to paw soles; with the tail brush hanging over the rock edge the box runs to about 450). At this scale one fox unit is one plane px |
| `facing` | 1 | 1 faces right (every reference). -1 mirrors the fox; the bake light is mirrored too, so lit edges still face the scene light |
| `yaw` | pose preset | 0 = rear three-quarter view (ref02), 1 = side-on (ref01). Any value in between blends the two rigs. Presets: `stand` 0, `walk` 0.92. `sit` ignores it |
| `look` | 0 | head raise: -1 = looking straight ahead, 0 = ref02, 1 = chin up at the sky. Clamped to ±1.5 |
| `wind` | 0 | 0..1 storm wind: the tail lifts and streams, the ears pin back, loose fur flutters |
| `speed` | 125 | walk speed in fox units/s. Only used to walk on the spot, when `motion` supplies neither `x` nor `dist` |
| `stride` | 150 | fox units travelled per full gait cycle |
| `motion` | none | `t => ({ x, y, look, wind, walk, dist, speed, breathe })`: per-frame overrides, all optional (see [Motion](#motion)). It is also called once with `t = 0` at build time |
| `rim` | none | coloured rim light along the silhouette edge facing `dir`: `{ amount, color: '#fff1d0', width: 3, glow: 0.35, dir: S.light }`. Off unless `amount > 0` |
| `tint` | none | palette grade `{ color, amount, mode: 'multiply' \| 'mix' }` (see [Palette](#palette)) |
| `palette` | none | partial `FOX_PALETTE` override, applied before `tint` |
| `shadow` | `{ alpha: S.shadow.alpha, inner: 0.55 }` | `inner` is the strength of the contact shadows that parts cast on each other. `alpha` currently has no effect (see [Quirks](#quirks)) |
| `detail` | 1.75 | bake resolution in px per fox unit at scale 1. The bake runs at `detail * scale`, which leaves room for camera push-ins |
| `seed` | `'fox'` | tuft layout. Each part forks its own stream by name. The head, ears, mane and ruff are painted from fixed shapes, so the same seed gives the same face in every pose |

There is no `alpha` option. Fade the fox with `layer.alpha` (a number or `t => number`), as
the gallery does.

### Return value

- `layer`: the `Layer` the fox draws on: `{ name: 'fox', z, tags: ['fox'], render }`. It is an ordinary
  layer, so `alpha`, `order` and `anim` work on it. Prefer `motion.x` over `anim` for moving
  the fox, because only `motion` drives the gait.
- `rig`: the rest skeleton in fox units, `rigFor(pose, yaw)`.
- `palette`: the resolved palette (`foxPalette(opts)`, with overrides and tint applied).
- `state(t)`: the resolved per-frame inputs `{ t, x, y, look, wind, walk, breathe, dist }`.
- `pointAt(t, name = 'head')`: the plane-space `{ x, y }` of a named point, following
  motion, breathing, head raise and walk bob. `name` is one of `'nose'`, `'head'`,
  `'chest'` or `'ground'`. Any other name throws. Use it to aim a glow, a firefly or the
  camera at the fox.
- `options`: the merged options.

The header comment in `fox.js` also lists `parts`, but `createFox` does not return it.

## Coordinates

**Fox units** are film px at scale 1. The origin is on the ground between the paws, the fox
faces +x and y points down. `x, y` place that origin in the plane, and `scale` and `facing`
apply about it. With the camera at rest, plane coordinates are screen pixels whatever `z` is.

The ground point sits under the forelegs, so most of the fox extends behind it (-x): the
body, the haunch and the tail. In the rear and sitting views the tail hangs **below** the
ground line. Stand the fox near the front edge of its rock so the brush drapes over the
edge, as in ref02 and ref10. The fox plane (z 950) draws in front of a rock at z 990.

Silhouette extents at scale 1, facing right, at rest, relative to `(x, y)`. Multiply by
`scale` and negate x for `facing: -1`. All values were measured on a render (alpha bounding
box of the composed fox without its drop shadow, `t = 0`, breathing off); nose, head and chest
are the `pointAt` values. Tuft tips and ear tips are included:

| pose | x range | y range | nose | head | chest |
|---|---|---|---|---|---|
| `stand` (yaw 0) | -270..137 | -362..89 | 128, -289 | 39, -263 | 69, -150 |
| `stand`, `yaw: 1` | -405..245 | -363..6 | 234, -268 | 139, -261 | 141, -144 |
| `walk` (yaw 0.92) | -379..237 | -361..28 | 227, -267 | 132, -260 | 134, -142 |
| `sit` | -290..115 | -355..79 | 105, -273 | 12, -244 | 42, -130 |

(October 2026 proportion pass: the stand nose moved 6 back and 6 down and the walk nose 5
forward and 13 down, toward the references; the paws did not move.)

`look: 1` turns the head 0.22 rad chin-up about the head pivot and draws the neck back 5 and
up 4 units, so the nose moves about 20 units up and 15 back.

Motion moves these by a few units: the nose bobs by about 14 units over a stride when
walking. The drop shadow adds the scene's shadow offset plus a 9-unit blur.

A **ground contact shadow** (a soft ellipse) is drawn into the drop-shadow mask under the
paws. It is not offset by the light and it rides with `(x, y)`. The ellipse comes from the
rig: rear view centre (-50, -2) with radii 140 × 18, side view (-10, -2) with 190 × 16, and
sit (-75, -2) with 160 × 18.

For the T5 rock-iris transition (`src/film/transitions.js`), set the scene's
`meta: { fox: { x, y } }` to the fox's ground point on screen. The iris closes on a point
140 px above it.

## Poses and references

| pose | rig (`RIGS`) | reference | yaw | gait |
|---|---|---|---|---|
| `stand` | `standRear`, blended toward `standSide` by `yaw` | ref02 (yaw 0) / ref01 (yaw 1) | 0 | off |
| `walk` | same blend | ref01 | 0.92 | on (`walk: 1`) |
| `sit` | `sit`: on the haunches, chest up, tail draped on the ground | ref10 | ignored | off |

The standing outlines were traced by hand as polygons on a 25-unit grid over each reference
fox and checked by overlaying the traced outline on gallery renders (`out/fox3/trace.mjs`
draws it over the render and the reference). Rear view (ref02): a lean body, the back
sloping from the withers (-200) to a rump at the lower left, a crisp rounded thigh
(about -118..-20 by -130..-50) above a bent hock, the belly tucked up to -88 between the
thigh and the forelegs, a deep chest; the tail leaves the croup narrow, lies over the back of
the haunch and droops in a gentle S to a large white brush (the last ~52 % of its length,
about 40 % visible past the lapping orange) resting on the rock at the far left. Side view
(ref01): a short lean body, high withers and a back sloping gently to the croup, a deep chest
over long dark forelegs, a slim waist, a big haunch filling the rear of the body (its front
edge the visible thigh contour), the tail leaving the croup and held out behind and a little
down to a big white brush. Sitting (ref10): an upright chest over straight forelegs, the
back curving down into a big haunch on the rock.

The head, ears, mane and ruff are painted once in the ref02 position and moved as a group
for each rig (`neckOffset`, then `neckTilt` about the neck pivot); the head and ears are then
tilted by `headTilt` and scaled by `headScale` about the head pivot, and the ears are cut
`earScale` times their canonical size about their base. The rear view shifts the group by
(-1, 0) and scales the head 1.03 (ears 1.03) with the chin 0.02 rad up, which puts it on
the ref02 head. The side view shifts the group by (+86, -4), leans it forward 0.25 rad so
the ruff runs down the front of the chest, and scales the head 1.06 (ears 1.12, net head
tilt +0.19 rad). The sitting view shifts the group by (-28, +20) and scales the head 1.08
(ears 1.12) with the chin 0.04 rad up. The standing rigs also wear a narrower chest bib
(the ruff's front edge pulled back toward the chest) and shorter locks behind the head.

### Placement for each reference (all facing right)

The ref01, ref02 and ref10 values are staged in the gallery. The rest are measured from the
reference images (to within about ±20 px and ±5 % in scale) and are starting points to check
with `tools/compare.mjs`.

| ref | pose | x, y | scale | notes |
|---|---|---|---|---|
| ref01 dusk bridge | `walk` | 652, 605 | 0.74 | gallery: passes x 652 at t = 6, `motion: t => ({ x: 652 + (t - 6) * 125 * 0.74 })` |
| ref02 night lake | `stand` | 620, 706 | 1 | gallery defaults, flat grey perch |
| ref03 firefly forest | `walk`, `yaw: 0.3` | ~810, 655 | ~1.0 | rear three-quarter, mid-stride on the log |
| ref04 waterfall canyon | `stand` (or `walk`, `yaw: 0.3`) | ~630, 735 | ~0.77 | stepping along the ledge |
| ref05 snow peaks | `stand`, `look: 1` | ~625, 500 | ~0.8 | chin up at the guiding star |
| ref06 crystal cave | `stand`, `look: ~0.3` | ~600, 780 | ~1.1 | cold crystal light on the edges: `rim` with `dir` toward the crystals (left) |
| ref07 storm coast | `stand`, `wind: 0.6-1` | ~685, 635 | ~0.9 | |
| ref08 aurora arch | `walk` | ~755, 535 | ~0.7 | side-on, crossing the arch |
| ref09 star portal | `stand`, `look: ~0.2` | ~580, 757 | ~1.0 | warm `rim` from the portal (right) |
| ref10 dawn | `sit` | 612, 650 | 0.95 | gallery, rock ledge |

## Palette

### `FOX_PALETTE`

Sampled from the reference foxes: ref02 under moonlight, and ref01 and ref10 in warm light.

| key | value | used for |
|---|---|---|
| `fur` | `#5e1503 #86240a #a8340f #c24416 #d8581f #e86d2c` | orange ramp, from shadow to lit |
| `furHi` | `#f59a5a` | sunlit flake tips along the back, the haunch top and the crown: fur values above 1 run on into it |
| `white` | `#9c8a88 #c8b2a0 #e3cdb4 #f3e4cf` | ruff, jaw, tail brush, belly: lavender shade to cream |
| `leg` | `#1a0f0b #2a1b15 #3a2620 #5a3c2d` | stockings and paws (paws use the lighter end) |
| `ink`, `whiteInk`, `legInk` | `rgba(58,9,0,.62)`, `rgba(80,55,70,.4)`, `rgba(10,4,0,.55)` | contact shadow under each tuft (the rust between rows) |
| `shade` | `#360b02` | contact shadow cast between parts |
| `ear` | `#24120b` | ear backs and tips |
| `eye`, `nose` | `#160c08`, `#1b110c` | |
| `gap` | `#6a1f0b` | defined, but no painter reads it |

The ramps (`fur`, `white`, `leg`) are sampled evenly, so an override may use any number of
stops (2 or more). Override them as whole arrays.

### `foxPalette({ tint, palette }) -> palette`

Returns `FOX_PALETTE` merged with the `palette` overrides, with `tint` applied to every hex
entry. `rgba(...)` entries such as the inks are left untouched.

- `mode: 'multiply'` (default) mixes each colour toward `colour × tint.color` by `amount`. It
  darkens and colours, like light through a gel.
- `mode: 'mix'` mixes each colour toward `tint.color` by `amount`.
- With `amount` 0 or missing, no tint is applied.

The base palette already holds up at night and in warm light, so most scenes need no tint.
Use `tint` and `rim` for strongly coloured light. These starting values were checked in a
test render (not against the references): `tint: { color: '#7f8fd0', amount: 0.35 }` gives a
subtle cool moonlit grade. `rim: { amount: 0.9, color: '#a8e4ff', dir: [-0.8, -0.6], glow: 0.5 }`
gives a thin crystal-blue edge with a halo (ref06). `rim: { amount: 0.8, color: '#ffd98a', dir: [1, -0.3] }`
gives a warm portal edge (ref09).

### Rim light

The rim is computed on the composed fox in device pixels. It takes the band of the whole
silhouette that faces `dir`, `width` fox units deep (scaled with the fox's size on screen),
fills it with `color` at `amount`, and lays it over the fox. It also adds a faint halo just
outside the edge at `amount × glow`. `dir` is in screen space and is not mirrored by `facing`.

### `FOX_PAPER`

The bake material for every part: `[{ tex: 'fiber', amt: 0.9 }, { tex: 'felt', amt: 0.6, scale: 0.5 }, { tex: 'crumple', amt: 0.3, scale: 0.4 }]`.

## Motion

Without `motion`, the fox idles (`stand`, `sit`) or walks on the spot (`walk`).

- **Breathing**: 3.5 s period. The body swells about the belly by up to 0.4 % in x and
  0.9 % in y, and the neck rises 0.9 units. `motion().breathe` scales it (0 holds still).
- **Weight shift**: slow noise of ±1.6 units in x and ±0.6 in y. The head drifts by about
  ±0.035 rad.
- **Look**: each unit of `look` turns the head 0.22 rad chin-up and draws the neck back 5
  units and up 4.
- **Ears**: deterministic flicks, a damped wobble of about 0.3 rad that lasts about 1 s. The near
  ear has a slot every 4.7 s and the far ear every 6.3 s, and about 70 % of slots fire.
  Wind pins both ears back by 0.14 × `wind` rad.
- **Tail**: three segments, split at 0.55 × `W0` and at `W0` = `tail.white` - 0.06 of its
  length, so the whole white brush is one piece (in the stand rig: 25 % and 44 %). The orange
  plume is herringbone rows of long pointed flakes (outer ones set back and angled out, so
  each row's tips make a chevron down the tail; one soft shadow per row; the last rows lap
  over the brush in points). The brush is a smooth white base closing to the point (the rig
  widths end at 5) under seven long jagged blades (`blade`: barbs pointing to the tip) that
  follow the tail's curve and converge on the point, cream on the lit side, lavender grey on
  the other. It sways with a 4.4 s
  period (0.032 rad plus slow noise of 0.022 at the root), and each segment repeats its
  parent's motion 0.32 s later with 30 % more amplitude (follow-through). Wind lifts it (0.24 × `wind` rad at the root, 0.12 at each further joint)
  and adds 3.4 Hz gusts.
- **Loose fur**: 9 tufts (3 on the back, 2 on the nape, 3 white on the chest, 1 at the tail
  tip). They shiver at rest and flutter fast and wide in the wind.
- **Walk gait**: the legs move in diagonal pairs (near hind with far fore, then far hind
  with near fore). Each paw is planted for 60 % of the cycle and two-bone IK solves the leg
  back to the hip, so planted paws never skate. On the swing a paw lifts 13 units (hind) or
  17 (fore) and curls. The body bobs 2.6 units twice per stride, pitches slightly, and the
  neck nods. The phase is `dist / stride`.

`motion(t)` fields (all optional):

| field | |
|---|---|
| `x`, `y` | ground point at time t (overrides `opts.x/y`) |
| `walk` | gait amount 0..1. It scales stride length, lift and bob. Default: 1 for `walk`, 0 otherwise. A `stand` fox with `walk: 1` walks in the rear three-quarter view. Do not use it with `sit` |
| `dist` | distance walked, in fox units, which sets the gait phase directly |
| `speed` | speed for walking on the spot, when neither `x` nor `dist` is given |
| `look`, `wind`, `breathe` | animated versions of the options |

The gait distance is resolved as follows. If `dist` is given, it is used. Otherwise, if
`x` is given and `walk > 0`, the distance is `(x(t) - x(0)) * facing / scale`. Otherwise it
is `speed * t`. Driving `x` therefore keeps the paws planted at any speed, eased or not.
Moving against `facing` plays the gait backwards, so use `facing: -1` for leftward travel.
To stop, ease `walk` to 0 as the x velocity dies away. Lowering `walk` pulls every paw
toward its rest spot, so planted paws slide a little while it fades. Keep the fade short
(about 0.5-1 s) and at low speed, and it reads as the fox settling its feet.

```js
// Walk in from the left, slow to a stop at x 900, then look up at the star.
const k = (t) => smoothstep(0, 4, t);                         // 0 -> 1 over 4 s
createFox(S, { pose: 'walk', x: 900, y: 700, scale: 0.8,
  motion: (t) => ({ x: lerp(500, 900, E.out(k(t))), walk: 1 - smoothstep(2, 3, t), look: smoothstep(4, 5.5, t) }) });
```

(`E`, `lerp` and `smoothstep` come from `core/ease.js`. `E.out` is a strong ease, so by
t = 2 the fox is within 11 px of its mark, and the gait fades while it covers that last
stretch. This is a pattern, not gallery code. It was checked to run.)

## Rendering and layering

- `createFox` adds one layer at `z` with a custom `render`. Each frame it solves the pose
  and composes all parts back to front into pooled offscreen buffers sized to the fox's
  on-screen box (padded by 70 fox units). It then blits the drop-shadow mask and then the
  fox. Layer `alpha` therefore fades the fox and its shadow as one image, with no
  see-through overlaps.
- Draw order (`stand`, `walk`): far hind leg, far fore leg, the upper bones of the near
  hind and near fore legs, the body (one sprite: neck, back, rump, haunch, belly, chest),
  the tail (tip first, with its tuft) lying over the rump and the back of the haunch, the
  loose back tufts (one covers the tail root), the near hind and near fore lower bones and
  paws, mane (with nape and chest tufts), far ear, ruff, head, near ear. `sit` draws the
  tail first, under everything but the far legs, and the loose back tufts with the body.
  The near upper bones go under the body, so the legs come out from beneath the haunch and
  the chest; when walking only the visible part of a leg swings, the haunch stays part of
  the body.
- **Contact shadows between parts**: each part's blurred silhouette, tinted `palette.shade`,
  is offset by 0.45 × the scene shadow offset and drawn source-atop onto the parts already
  laid. Its strength is `shadow.inner` times a weight per part (0.6-1.0).
- **Drop shadow on the scene**: each part's 9-unit blurred silhouette at the full scene
  shadow offset (`env.shadow.dx/dy`, cast away from `S.light`), plus the ground ellipse. Its
  opacity is the scene's `shadow.alpha`.
- The fox draws in device space, so camera pan, dolly, zoom and roll all work. It stays sharp
  up to about `detail` times (1.75×) on-screen magnification relative to the bake (camera
  zoom × depth scale). Raise `detail` for extreme close-ups. A fox baked small (`scale` 0.4)
  is also baked at low resolution, so give it a higher `detail` if the camera will push in.

## Performance

These timings were measured in headless Chrome at 1920×1080.

- **Build**: the first fox on a page takes about 1.3-1.6 s, mostly for the shared paper
  textures, which are built once per page. Each further fox takes about 160-600 ms (the standing rigs fit every body tuft to the outline, which costs a few hundred ms). A fox is
  30 baked sprites (12 leg parts, 3 tail segments, body, mane, ruff, head, 2 ears and 9
  loose tufts), and each holds its canvas, a shadow, a tinted inner silhouette and a
  far-shadow blur.
- **Render**: about 2.5-4.4 ms per fox per frame (measured 60 frames each for stand, walk,
  sit and a stand with wind and rim). Occasional 12-20 ms frames happen when the
  shared buffers grow (the first frame, or when the fox gets bigger on screen). The rim adds
  one buffer pass, well under 1 ms.
- The buffers (`fox`, `mask`, `rim`) are shared by every fox in the module and only grow.
  Foxes draw one at a time, so several foxes in one scene are fine.
- `state(t)` and `pointAt(t)` re-run the pose solve without drawing, which is cheap enough
  to call every frame.

## Examples (from the gallery)

```js
// ref02: standing on the flat grey rock, faded in for the first window.
createFox(S, { z: 950, x: 620, y: 706, scale: 1, pose: 'stand', seed: 'fox-stand' }).layer.alpha = show(0, 4);
// Smaller test foxes: chin up at the sky, and looking straight ahead.
createFox(S, { z: 950, x: 1250, y: 706, scale: 0.6, pose: 'stand', seed: 'fox-test', look: 1 }).layer.alpha = show(0, 4);
createFox(S, { z: 950, x: 1650, y: 706, scale: 0.6, pose: 'stand', seed: 'fox-test2', look: -1 }).layer.alpha = show(0, 4);
```

```js
// ref01: walking across the bridge, passing the reference position at t = 6.
// x speed = 125 fox units/s * scale, but the gait follows x, so any speed keeps the paws planted.
const walkSpeed = 125 * 0.74;
createFox(S, {
  z: 950, x: 652, y: 605, scale: 0.74, pose: 'walk', seed: 'fox-walk',
  motion: (t) => ({ x: 652 + (t - 6) * walkSpeed }),
}).layer.alpha = show(4, 8);
```

```js
// ref10: sitting on the ledge at dawn.
createFox(S, { z: 950, x: 612, y: 650, scale: 0.95, pose: 'sit', seed: 'fox-sit' }).layer.alpha = show(8, 12);
```

(`show(a, b)` in the gallery is `t => (t >= a && t < b ? 1 : 0)`.) In the film, give the
hero the same `seed` in every scene so its face, ears and ruff match from shot to shot. The
gallery uses different seeds only to show variation.

## Quirks

- **`opts.shadow.alpha` is ignored.** The render reads `env.shadow.alpha`, which
  `Scene.render` always fills from the scene's own `shadow.alpha`. A render diff with
  `shadow: { alpha: 0 }` and `{ alpha: 1 }` was identical. To change the fox's drop shadow, set
  the scene's `shadow.alpha` (it applies to every plane). `shadow.inner` works.
- `pointAt` throws on an unknown name.
- `palette.gap` is unused, and the documented `parts` return field does not exist (see above).
- `walk` with the `sit` pose moves the legs of the sitting rig through a gait. Don't.

## Internals

These are exported for tooling and new poses. Scenes should not need them.

- `fox-rig.js`: `RIGS = { standRear, standSide, sit }` are the rest skeletons in fox units.
  `torso.outline` is the whole body silhouette, 18 Catmull-Rom control points whose meaning
  is the same in every rig (`BODY_POINTS`: neck, withers, back, loin, croup, rump, thighBack,
  thighLow, knee, stifle, crease, waist, belly, elbow, chestLow, chest, chestHigh, throat), so
  rigs blend point for point. `torso.rows`, `torso.thigh` and `torso.shoulder` are fur
  patches: `{ from, mid?, to, n }`, rows lofted from the downstream cross-section `from`
  (laid first) to the upstream one `to` (laid last). `torso.cape` is the line of fur lapping
  over the top of the haunch, `torso.shades` the soft overlays `[x, y, rx, ry, rot, k]`
  (k > 0 light, k < 0 shade), `torso.size` / `gap` the body tuft length range and spacing,
  `backLine`, `bellyLine` and `belly` the loose-tuft roots, the belly fringe and the white
  belly patch. Then the tail spine and widths (`white` = where the brush starts, 0..1), four
  legs `{ a: hip/shoulder, b: hock/wrist, c: ankle, toe, hind?, far? }`, the hip, breath and
  neck pivots, the head-group offset (`neckOffset`) and lean (`neckTilt`), the head tilt and
  scale, the ear scale (`earScale`), `trim` and the ground ellipse. `torso.haunch` (standing
  rigs) is the thigh cut-out, 10 points; where it pokes past the outline it is clipped, so its
  visible edge is the thigh front and bottom (and, in the rear view, its top). `trim: true`
  (standing rigs) turns on the fitted body fur, the haunch cut-out, the shorter mane, nape and
  head-fringe locks, the narrower ruff and the straighter tail plume. Boolean keys are not
  blended: `rigFor` takes them from the rear rig. `rigFor(pose, yaw)` returns a blended copy. `ik2(a, c, l1,
  l2, bend)` returns the middle joint of a two-bone chain, and `bendOf(a, b, c)` returns the
  bend side (+1 or -1) that reproduces a drawn pose.
- `fox-paint.js`: `Paint` (a recorded list of cut-outs whose box fits the shapes, plus
  `custom(fn)` raw steps such as the soft overlays), `tuft(rng, len, halfWidth, { tips, notch,
  bulge, spread, teeth, curl })` (a torn strip with 1-5 points and a quill-shaped base),
  `flakeStyle`, `addTuft(P, rng, x, y, a, len, width, fill, style, shape, fit)` (alias
  `addFlake`; `flake` is kept as a wrapper of `tuft`; with `fit = { region, out, min }` the
  tuft shrinks about its root until no point reaches more than `out` past `region`, and is
  dropped below `min` (0.4) of its size; `furRows`, `furField` and `fringe` pass a `fit`
  option through, and take `cast = { color, blur, drop }`: the pieces are then drawn without
  shadows of their own and each row (`furRows`), band of `band` units along the order
  (`furField`) or the whole line (`fringe`) casts one soft shadow; `furRows` also takes
  `stagger`, roots wandering along the flow by that fraction of a row),
  `furRows` (rows lofted between cross-sections, tips allowed `out` units past the outline,
  `keep` thins them so smooth felt shows), `furField` (a shingled hex-grid field, used on the
  head, neck and ruff) and `fringe` (tufts along a polyline). The part painters are
  `paintBody`, `paintTailSegment` + `tailFrame`, `paintLegBone`, `paintPaw`, `paintHead`,
  `paintEar`, `paintMane`, `paintRuff`, `paintTuft` and `paintGroundShadow`. The canonical
  shapes are `HEAD`, `EARS` (cut 1.12× about their base), `MANE` and `RUFF`. The helpers are
  `spline`, `inside`, `polyBounds`, `ramp` and `tintColor(colour | colours, tint)`. Every
  painter works in fox units in the ref02 head position.
- Body fur layout (`paintBody`): the silhouette and its overlays, a belly fringe, the white
  belly patch, back rows over the upper 58 % of each cross-section (dense, the top rows lit),
  a few strips scattered over the lower flank, a fringe down the back edge of the shoulder
  and along the elbow, then the haunch: on trimmed rigs the `torso.haunch` cut-out
  (`paintHaunch`, clipped to the body, with torn strips kept inside it), otherwise the top
  rows of the haunch (its lower part smooth lit felt with the crease shadow in front); last
  the cape lapping over the haunch top. On trimmed rigs every one of these tufts is fitted
  (`out` 6 on the back, flank, shoulder and cape, 7-8 on the belly, 9 at the elbow).
