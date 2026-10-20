# Paper Fox

A one-minute layered paper-cut film, drawn and animated entirely in code.

A fox follows a guiding star through ten worlds: a dusk bridge, a moonlit lake, a
firefly forest, a waterfall canyon, snowy peaks, a crystal cave, a storm coast, an
aurora arch, a star portal, and finally dawn. Every frame is built from paper cut-outs
that are generated at runtime. The picture uses no image files, textures or fonts: the
paper fibre, the crumpled sky, every fur tuft, leaf, petal and wave are procedural.
(The only images in this repository are stills rendered from the film for this page.)
The soundtrack is a licensed orchestral track with recorded sound effects, mixed in
code to the film's timeline.

![Paper Fox](docs/media/poster.jpg)

**Watch the film:** the 1080p60 render is attached to the
[latest release](https://github.com/Leonxlnx/paper-fox/releases/latest).

![The ten scenes](docs/media/scenes.jpg)

## How it works

**Paper engine** (`src/core`). A small Canvas 2D engine for multiplane paper dioramas.

- Textures are generated once per page load: fibre (grain, mottling, fibres, specks),
  crumpled paper (a lit Voronoi height field), granite speckle and felt.
- Shapes are drawn flat, then *baked* into sprites: texture is soft-lit into them, the
  cut edge gets a lit and an unlit bevel, and a blurred silhouette is kept as the drop
  shadow.
- Sprites sit on planes at different depths. A perspective camera films them, so a
  pan, push or crane gives real parallax, and every plane casts its shadow on the ones
  behind it. That shadow between layers is what makes it read as paper.
- A film finish adds bloom from bright paper and lights, a vignette and fine grain.

**Element library** (`src/elements`). Reusable, parameterised paper pieces: the fox
(a rigged cut-out with breathing, tail follow-through, ear flicks, a four-leg walk
cycle and a sitting pose), conifers and redwood trunks, flowers and foliage, skies,
moon, sun, aurora and the guiding star, cumulus banks and cloud seas, mountains, hills,
cliffs and boulders, lakes, rivers, waterfalls and foam. Each family has an API
reference in `docs/elements`.

**Scenes** (`src/scenes`). Ten dioramas composed from those elements, each animated as
a pure function of time with a slow camera move that passes through rest at its
midpoint.

**Film** (`src/film`). `timeline.js` is the one source of timing for picture and
sound: 80 BPM, two bars per scene, every scene change on a bar line. Each cut hides
behind something from the story world, so the fox is never seen twice:

| From → to | Transition |
|---|---|
| dusk → night lake | the camera tracks with the fox and a huge pine sweeps past the lens |
| lake → forest | a push through fir branches |
| forest → canyon | redwood trunks close like theatre curtains and open on the canyon |
| canyon → peaks | the camera cranes up through a bank of cloud |
| peaks → cave | a ragged rock iris closes on the fox and opens inside the mountain |
| cave → storm | the star at the end of the tunnel flares into lightning |
| storm → aurora | a paper wave rolls over the lens and drains away |
| aurora → portal | pop-up book: the cut-outs fold flat and the next world pops up |
| portal → dawn | the portal's light floods the frame and settles into the sunrise |

**Soundtrack** (`tools/soundtrack.mjs`). Music and recorded sound effects placed by a
cue sheet written in film seconds, from the same timeline and story cues as the
picture, so every sound sits on what causes it:

- the music's 8-bar intro opens the film; one edit, hidden behind the closing redwood
  curtains, jumps to its breakdown, so the second build rises through the cave and
  the storm and the full climax lands the moment the wave reveals the aurora;
- one ambience bed per world (river birds, crickets, night forest, waterfall, mountain
  wind, cavern drips, rainstorm and surf, meadow wind, morning birds), crossfaded across
  each transition;
- story moments (the star appearing, crystals waking, three thunder strikes on the
  lightning, the portal opening, the star-flower blooming) and one sound per
  transition: wind past the pine, rustling branches, trunk swooshes, a wind swell
  through the clouds, sliding stone, a light swell, a wave impact, turning pages,
  a light sweep.

The mix is mastered to -14 LUFS with a -1.5 dBTP ceiling.

## Running it

Requires Node 20+, Chrome (or Chromium/Edge; set `CHROME_PATH` if it is not found) and
ffmpeg on the `PATH`.

```bash
npm install
```

Watch it live in the browser (space to pause, arrows to step):

```bash
node tools/serve.mjs
```

Then open `http://localhost:5173/` for the film, `?scene=s04` for one scene or
`?gallery=fox` for an element test sheet.

Fetch the licensed audio (listed with sources in `audio/sources.json`), mix the
soundtrack, and render the film (1920x1080, 60 fps, H.264 + AAC):

```bash
node tools/fetch-audio.mjs
```

```bash
node tools/soundtrack.mjs
```

```bash
node tools/render.mjs --audio out/audio/soundtrack.wav
```

Frames are rendered by several headless Chrome workers and deleted after encoding.
`--preview` renders at half resolution, `--from` / `--to` render a section.

Stills, contact sheets and comparisons for development:

```bash
node tools/snap.mjs s02 --t 4.25
```

```bash
node tools/sheet.mjs s02 --from 0 --to 8.5 --n 12
```

```bash
node tools/transition-sheet.mjs popup s08 s09
```

## Layout

```
src/core       paper engine: noise, colour, easing, geometry, textures, sprites, stage, finish
src/elements   reusable paper elements (fox, trees, flora, sky, clouds, terrain, water)
src/scenes     the ten dioramas
src/film       timeline, cues, transitions and their props
src/gallery    element test sheets
tools          headless rendering, soundtrack mixing, review tools
audio          sources.json: the licensed music and sound effects (files are fetched, not stored)
docs           engine guide and element API references
```

## Credits

Built with Claude Code. The look recreates a set of AI-generated paper-cut
illustrations that were used only as visual reference; none of them are included here.

Music: "Fairy Tale" by Music_For_Videos, via
[Pixabay](https://pixabay.com/music/fantasy-dreamy-childrens-fairy-tale-164242/)
(Pixabay Content License). Sound effects from [Mixkit](https://mixkit.co/free-sound-effects/)
(Mixkit Sound Effects Free License); the full list is in `audio/sources.json`. The audio
files are not redistributed here.

Code is MIT licensed; the license does not extend to the third-party audio.
