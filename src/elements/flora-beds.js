// Hand-placed foreground clusters matching the references, in film pixels (1920x1080,
// camera at rest). Rows run back to front; within a row, stems and leaves are drawn
// first, then flower heads, then cones, so heads shadow everything behind them.
// Use with addFlowerBed(S, { preset: 'night-lake' }); mirror/scale/dx/dy re-place them.

// ref02 bottom-left: two coneflowers, daisies, billy buttons and astilbe in dark foliage.
const NIGHT_LAKE = {
  palette: 'night',
  rows: [
    [
      { type: 'backing', x0: -300, y0: 560, x1: 760, y1: 1380, edge: [[0, 575], [170, 580], [270, 620], [360, 700], [460, 770], [580, 790], [690, 840], [760, 940]], seed: 21 },
    ],
    [
      // Dark foliage behind the top-left daisies
      { type: 'leaf', x: 20, y: 760, len: 190, width: 0.2, rot: 0.55, curl: 0.05, tone: 'dark', seed: 1 },
      { type: 'leaf', x: 120, y: 760, len: 170, width: 0.18, rot: -0.35, curl: -0.05, tone: 'deep', seed: 2 },
      { type: 'leaf', x: 250, y: 780, len: 150, width: 0.2, rot: 0.25, tone: 'dark', seed: 3 },
      { type: 'undergrowth', x0: -40, x1: 720, y: 980, edge: [[0, 640], [180, 650], [330, 740], [480, 820], [720, 870]], density: 1.5, seed: 56 },
      // Yellow-green shrub behind the astilbe
      { type: 'shrub', x: 320, y: 770, w: 230, h: 170, leaf: 21, palette: { shrub: { top: '#c2bc3c', mid: '#9ea438', low: '#6c8a2e', dark: '#3f5a26' } }, seed: 49 },
      // Big speckled leaf behind the billy buttons
      { type: 'leaf', x: 300, y: 905, len: 205, width: 0.36, rot: 1.05, curl: -0.08, round: 0.7, belly: 0.5, tone: '#7d8230', speckle: 1, seed: 4 },
      // Dark lance leaves standing up on the right
      { type: 'leaf', x: 455, y: 880, len: 100, width: 0.17, rot: -0.45, tone: 'dark', seed: 5 },
      { type: 'leaf', x: 440, y: 890, len: 125, width: 0.16, rot: -0.12, tone: '#1d4a35', seed: 6 },
      { type: 'leaf', x: 480, y: 885, len: 115, width: 0.17, rot: 0.15, tone: 'dark', seed: 7 },
      { type: 'leaf', x: 515, y: 890, len: 125, width: 0.16, rot: 0.38, tone: '#1d4a35', seed: 8 },
      // Yellow-green leaves at the right edge of the cluster
      { type: 'leaf', x: 560, y: 900, len: 120, width: 0.24, rot: 0.3, tone: '#b4b432', serrate: { count: 7, depth: 0.14 }, seed: 9 },
      { type: 'leaf', x: 615, y: 880, len: 110, width: 0.24, rot: 0.75, tone: '#c4bc3a', serrate: { count: 7, depth: 0.14 }, seed: 10 },
      { type: 'leaf', x: 650, y: 905, len: 130, width: 0.22, rot: 0.15, tone: '#a8b032', serrate: { count: 8, depth: 0.14 }, seed: 11 },
      { type: 'tuft', x: 385, y: 910, n: 6, len: 120, spread: 0.8, tones: ['dark', 'mid'], seed: 50 },
      // Astilbe plume rising behind the first coneflower
      { type: 'astilbe', x: 200, y: 900, h: 310, w: 92, lean: -0.03, plume: 0.45, seed: 12 },
      { type: 'astilbe', x: 160, y: 900, h: 255, w: 66, lean: -0.08, plume: 0.42, seed: 13 },
      { type: 'astilbe', x: 238, y: 900, h: 245, w: 62, lean: 0.08, plume: 0.42, seed: 14 },
      // Leafy sprigs and buds among the daisy stems
      { type: 'sprig', x: 12, y: 900, h: 270, lean: 0.06, leaves: 3, seed: 41 },
      { type: 'sprig', x: 52, y: 900, h: 238, lean: -0.1, leaves: 4, seed: 42 },
      { type: 'sprig', x: 98, y: 900, h: 175, lean: 0.12, leaves: 4, bud: false, seed: 43 },
      { type: 'sprig', x: 188, y: 900, h: 190, lean: -0.06, leaves: 3, seed: 44 },
      // Daisies at the top left
      { type: 'daisy', base: [80, 900], head: [67, 702], r: 31, rot: 0.2, seed: 15 },
      { type: 'daisy', base: [125, 900], head: [120, 697], r: 30, rot: 0.6, seed: 16 },
      { type: 'daisy', base: [160, 900], head: [165, 725], r: 28, rot: 0.1, seed: 17 },
      { type: 'daisy', base: [40, 920], head: [30, 745], r: 28, rot: 0.9, seed: 18 },
    ],
    [
      { type: 'blade', x: 10, y: 1110, len: 250, width: 0.12, rot: -0.16, curl: -0.04, tone: 'mid', seed: 48 },
      { type: 'blade', x: 58, y: 1110, len: 320, width: 0.12, rot: -0.05, curl: -0.05, tone: 'light', seed: 19 },
      { type: 'blade', x: 115, y: 1110, len: 262, width: 0.11, rot: 0.23, curl: 0.06, tone: '#8e9752', seed: 20 },
      { type: 'tuft', x: 178, y: 1110, n: 7, len: 230, spread: 0.7, tones: ['mid', 'dark', 'light'], seed: 51 },
      { type: 'tuft', x: 330, y: 1110, n: 6, len: 170, spread: 0.8, seed: 52 },
      { type: 'tansy', base: [235, 920], head: [242, 750], r: 17, seed: 22 },
      { type: 'tansy', base: [280, 920], head: [284, 755], r: 16, seed: 23 },
      { type: 'daisy', base: [335, 1000], head: [330, 872], r: 30, rot: 0.4, seed: 24 },
      { type: 'echinacea', base: [215, 1110], head: [200, 806], size: 122, coneW: 70, roll: 0.16, seed: 25 },
    ],
    [
      { type: 'astilbe', x: 528, y: 1090, h: 275, w: 40, lean: -0.01, plume: 0.5, palette: { astilbe: { florets: ['#d8304a', '#e4444e', '#ee5a56', '#f47264'], light: '#ffb090' } }, seed: 26 },
      { type: 'astilbe', x: 482, y: 1090, h: 235, w: 36, lean: 0.0, plume: 0.5, palette: { astilbe: { florets: ['#d8304a', '#e4444e', '#ee5a56', '#f47264'], light: '#ffb090' } }, seed: 27 },
      { type: 'astilbe', x: 556, y: 1090, h: 225, w: 36, lean: 0.01, plume: 0.5, palette: { astilbe: { florets: ['#d8304a', '#e4444e', '#ee5a56', '#f47264'], light: '#ffb090' } }, seed: 28 },
      { type: 'astilbe', x: 452, y: 1090, h: 205, w: 34, lean: 0.0, plume: 0.5, palette: { astilbe: { florets: ['#d8304a', '#e4444e', '#ee5a56', '#f47264'], light: '#ffb090' } }, seed: 29 },
      { type: 'undergrowth', x0: 300, x1: 720, y: 1090, h: 150, density: 1.2, tones: ['light', 'mid', 'lime'], stems: 0.3, seed: 57 },
      { type: 'tuft', x: 470, y: 1110, n: 8, len: 200, spread: 0.9, tones: ['light', 'lime', 'mid'], seed: 53 },
      { type: 'tuft', x: 640, y: 1110, n: 6, len: 175, spread: 0.8, tones: ['light', 'mid'], seed: 54 },
      { type: 'sprig', x: 470, y: 1100, h: 175, lean: -0.08, leaves: 4, bud: false, seed: 45 },
      { type: 'sprig', x: 612, y: 1100, h: 140, lean: 0.06, leaves: 3, seed: 46 },
      { type: 'sprig', x: 668, y: 1100, h: 190, lean: -0.04, leaves: 4, seed: 47 },
      { type: 'tansy', base: [395, 1100], head: [390, 900], r: 22, seed: 30 },
      { type: 'tansy', base: [430, 1100], head: [427, 952], r: 22, seed: 31 },
      { type: 'daisy', base: [590, 1100], head: [585, 962], r: 32, rot: 0.3, seed: 32 },
      { type: 'daisy', base: [530, 1100], head: [525, 982], r: 30, rot: 0.7, seed: 33 },
      { type: 'daisy', base: [575, 1100], head: [570, 1015], r: 22, rot: 0.1, seed: 34 },
      { type: 'daisy', base: [640, 1100], head: [637, 1015], r: 38, rot: 0.5, seed: 35 },
      { type: 'echinacea', base: [275, 1120], head: [267, 944], size: 102, coneW: 60, roll: 0.1, seed: 36 },
    ],
    [
      { type: 'leaf', x: -20, y: 1120, len: 230, width: 0.3, rot: 0.15, curl: 0.05, tone: '#123a34', seed: 37 },
      { type: 'leaf', x: 405, y: 1120, len: 140, width: 0.42, rot: 0.05, round: 0.8, belly: 0.55, tone: 'yellow', seed: 38 },
      { type: 'tuft', x: 250, y: 1120, n: 5, len: 120, spread: 0.9, tones: ['dark', 'deep'], seed: 55 },
      { type: 'blade', x: 300, y: 1110, len: 140, width: 0.07, rot: 0.3, curl: 0.2, tone: 'dark', seed: 39 },
      { type: 'blade', x: 180, y: 1110, len: 120, width: 0.08, rot: -0.3, curl: -0.1, tone: 'dark', seed: 40 },
    ],
  ],
};

// ref01 bottom-left: purple coneflowers, lupines, marigolds, a red zinnia and daisies
// in a sunlit meadow.
const DUSK_BRIDGE = {
  palette: 'dusk',
  rows: [
    [
      { type: 'backing', x0: -300, y0: 400, x1: 800, y1: 1380, edge: [[0, 420], [120, 460], [250, 560], [400, 690], [550, 790], [700, 860], [790, 960]], tones: { top: 'mid', bottom: 'deep' }, seed: 61 },
    ],
    [
      { type: 'undergrowth', x0: -40, x1: 780, y: 1000, edge: [[0, 470], [200, 540], [400, 690], [600, 800], [780, 880]], density: 1.7, tones: ['light', 'lime', 'mid', 'dark'], seed: 98 },
      { type: 'tuft', x: 120, y: 760, n: 9, len: 220, spread: 1.2, tones: ['light', 'lime', 'mid'], seed: 62 },
      { type: 'tuft', x: 300, y: 740, n: 8, len: 180, spread: 1.1, tones: ['lime', 'light'], seed: 63 },
      { type: 'shrub', x: 300, y: 700, w: 220, h: 150, leaf: 15, palette: { shrub: { top: '#c8c440', mid: '#a8b236', low: '#7a9a30', dark: '#4a6a28' } }, seed: 64 },
      { type: 'lupine', x: 14, y: 640, h: 230, w: 40, lean: 0.02, spike: 0.55, palette: { lupine: { florets: ['#5a2a8a', '#6a3496', '#7a40a0'], banner: '#9a6ac0', light: '#c0a0dc', bud: '#6a3a90', budTip: '#9a70c0' } }, seed: 65 },
      { type: 'lupine', x: 72, y: 660, h: 280, w: 62, lean: 0.01, spike: 0.55, seed: 66 },
      { type: 'astilbe', x: 150, y: 720, h: 250, w: 118, lean: -0.02, plume: 0.62, seed: 67 },
      { type: 'astilbe', x: 200, y: 700, h: 200, w: 70, lean: 0.06, plume: 0.6, seed: 68 },
      { type: 'sprig', x: 30, y: 900, h: 240, lean: 0.05, leaves: 4, bud: false, seed: 69 },
      { type: 'sprig', x: 170, y: 900, h: 230, lean: -0.05, leaves: 3, seed: 70 },
      { type: 'daisy', base: [65, 900], head: [60, 610], r: 33, petals: 11, rot: 0.3, seed: 71 },
      { type: 'daisy', base: [22, 920], head: [17, 655], r: 30, petals: 11, rot: 0.8, seed: 72 },
      { type: 'daisy', base: [130, 900], head: [125, 650], r: 30, petals: 11, rot: 0.1, seed: 73 },
      { type: 'daisy', base: [190, 900], head: [187, 630], r: 25, petals: 11, rot: 0.5, seed: 74 },
      { type: 'daisy', base: [80, 920], head: [78, 688], r: 30, petals: 11, rot: 0.2, seed: 75 },
      { type: 'marigold', base: [250, 900], head: [248, 612], r: 45, seed: 76 },
    ],
    [
      { type: 'tuft', x: 60, y: 1000, n: 8, len: 230, spread: 0.9, tones: ['light', 'mid'], seed: 77 },
      { type: 'tuft', x: 330, y: 1000, n: 9, len: 240, spread: 1.0, tones: ['light', 'lime', 'mid'], seed: 78 },
      { type: 'sprig', x: 300, y: 1000, h: 220, lean: 0.04, leaves: 4, bud: false, seed: 79 },
      { type: 'zinnia', base: [280, 1000], head: [270, 742], r: 70, rot: 0.2, seed: 80 },
      { type: 'echinacea', base: [160, 1110], head: [145, 752], size: 128, coneW: 72, roll: 0.2, seed: 81 },
    ],
    [
      { type: 'tuft', x: 560, y: 1110, n: 9, len: 260, spread: 1.0, tones: ['light', 'mid', 'lime'], seed: 82 },
      { type: 'tuft', x: 680, y: 1110, n: 7, len: 220, spread: 0.9, tones: ['light', 'mid'], seed: 83 },
      { type: 'marigold', base: [440, 1100], head: [437, 824], r: 38, seed: 84 },
      { type: 'lupine', x: 498, y: 1110, h: 320, w: 74, lean: 0.01, spike: 0.66, seed: 85 },
      { type: 'daisy', base: [215, 1110], head: [212, 890], r: 37, petals: 11, rot: 0.4, seed: 86 },
      { type: 'daisy', base: [318, 1110], head: [313, 876], r: 40, petals: 11, rot: 0.1, seed: 87 },
      { type: 'daisy', base: [425, 1110], head: [422, 945], r: 33, petals: 11, rot: 0.6, seed: 88 },
      { type: 'daisy', base: [585, 1110], head: [580, 950], r: 38, petals: 11, rot: 0.3, seed: 89 },
      { type: 'daisy', base: [632, 1110], head: [630, 978], r: 30, petals: 11, rot: 0.9, seed: 90 },
      { type: 'daisy', base: [688, 1110], head: [683, 952], r: 40, petals: 11, rot: 0.2, seed: 91 },
      { type: 'echinacea', base: [365, 1140], head: [355, 962], size: 132, coneW: 72, roll: 0.08, seed: 92 },
    ],
    [
      { type: 'blade', x: 30, y: 1110, len: 270, width: 0.13, rot: 0.04, curl: 0.04, tone: 'light', seed: 93 },
      { type: 'blade', x: 95, y: 1110, len: 230, width: 0.12, rot: 0.32, curl: 0.06, tone: 'mid', seed: 94 },
      { type: 'leaf', x: -25, y: 1120, len: 250, width: 0.28, rot: 0.1, tone: 'deep', seed: 95 },
      { type: 'tuft', x: 230, y: 1120, n: 6, len: 130, spread: 1.0, tones: ['mid', 'dark'], seed: 96 },
      { type: 'tuft', x: 470, y: 1120, n: 6, len: 140, spread: 1.0, tones: ['mid', 'light'], seed: 97 },
    ],
  ],
};

// ref03 bottom-left: fly agarics among anemones, ferns, violet spikes and clover.
const FOREST_LEFT = {
  palette: 'forest',
  rows: [
    [
      { type: 'backing', x0: -300, y0: 470, x1: 880, y1: 1380, edge: [[0, 480], [200, 520], [350, 600], [500, 670], [650, 720], [800, 800], [870, 920]], seed: 101 },
    ],
    [
      { type: 'undergrowth', x0: -40, x1: 880, y: 1000, edge: [[0, 600], [300, 660], [600, 740], [880, 880]], density: 1.1, tones: ['dark', 'mid', 'deep'], stems: 0.35, seed: 146 },
      { type: 'fern', x: 330, y: 760, len: 230, rot: -0.15, curl: 0.2, reach: 0.32, color: 'dark', seed: 102 },
      { type: 'fern', x: 450, y: 830, len: 260, rot: 0.08, curl: 0.18, reach: 0.32, color: 'light', seed: 103 },
      { type: 'leaf', x: 560, y: 900, len: 190, width: 0.13, rot: -0.35, tone: 'dark', seed: 104 },
      { type: 'leaf', x: 600, y: 900, len: 210, width: 0.12, rot: 0.05, tone: 'deep', seed: 105 },
      { type: 'leaf', x: 650, y: 900, len: 200, width: 0.13, rot: 0.42, tone: 'dark', seed: 106 },
      { type: 'amanita', x: 72, y: 700, size: 280, tall: 0.5, lean: 0.03, seed: 107 },
      { type: 'larkspur', x: 30, y: 880, h: 300, w: 92, lean: 0.03, spike: 0.75, seed: 108 },
      { type: 'larkspur', x: 92, y: 860, h: 230, w: 70, lean: -0.04, spike: 0.7, seed: 109 },
      { type: 'sprig', x: 300, y: 760, h: 140, lean: 0.05, leaves: 3, bud: '#e8e2f0', seed: 110 },
      { type: 'sprig', x: 340, y: 760, h: 120, lean: -0.08, leaves: 2, bud: '#c8b8e8', seed: 111 },
      { type: 'daisy', base: [175, 820], head: [166, 645], r: 40, petals: 5, rot: 0.3, seed: 112 },
    ],
    [
      { type: 'fern', x: 610, y: 990, len: 330, rot: 0.68, curl: -0.12, reach: 0.34, color: 'light', seed: 113 },
      { type: 'amanita', x: 232, y: 968, size: 352, tall: 0.38, lean: -0.02, seed: 114 },
      { type: 'daisy', base: [540, 1000], head: [531, 788], r: 33, petals: 5, rot: 0.1, seed: 115 },
      { type: 'daisy', base: [525, 1000], head: [520, 853], r: 33, petals: 5, rot: 0.5, seed: 116 },
      { type: 'daisy', base: [480, 1050], head: [474, 922], r: 33, petals: 5, rot: 0.9, seed: 117 },
      { type: 'daisy', base: [612, 1050], head: [608, 926], r: 33, petals: 5, rot: 0.2, seed: 118 },
    ],
    [
      { type: 'fern', x: 700, y: 1100, len: 260, rot: 0.3, curl: 0.1, reach: 0.34, color: 'teal', seed: 119 },
      { type: 'amanita', x: 348, y: 992, size: 128, tall: 0.45, lean: 0.04, seed: 120 },
      { type: 'daisy', base: [110, 1100], head: [103, 893], r: 40, petals: 5, rot: 0.6, palette: { daisy: { petal: '#efe2b8', tip: '#f8efd0' } }, seed: 121 },
      { type: 'daisy', base: [380, 1100], head: [376, 998], r: 36, petals: 5, rot: 0.4, seed: 122 },
      { type: 'daisy', base: [490, 1100], head: [485, 1006], r: 33, petals: 5, rot: 0.0, seed: 123 },
    ],
    [
      { type: 'clover', x: 60, y: 990, r: 58, rot: 0.2, squash: 0.75, color: '#2f6a60', stalk: [70, 1120], seed: 124 },
      { type: 'clover', x: 175, y: 1040, r: 52, rot: 0.9, squash: 0.75, color: '#2a6258', stalk: [180, 1130], seed: 125 },
      { type: 'clover', x: 290, y: 1065, r: 48, rot: 0.4, squash: 0.8, color: '#33706a', stalk: [300, 1140], seed: 126 },
      { type: 'clover', x: 650, y: 1020, r: 44, rot: 0.1, squash: 0.78, stalk: [655, 1130], seed: 127 },
      { type: 'clover', x: 750, y: 1050, r: 46, rot: 0.7, squash: 0.78, stalk: [760, 1140], seed: 128 },
    ],
  ],
};

// ref03 bottom-right: a big fly agaric with two smaller ones, mossy greens, violets
// and a dark fern (the mossy log itself belongs to the terrain).
const FOREST_RIGHT = {
  palette: 'forest',
  rows: [
    [
      { type: 'backing', x0: 1200, y0: 520, x1: 2220, y1: 1380, anchor: 'right', edge: [[1260, 940], [1400, 820], [1500, 700], [1600, 600], [1750, 540], [1920, 520]], seed: 131 },
    ],
    [
      { type: 'undergrowth', x0: 1240, x1: 1960, y: 1000, edge: [[1240, 960], [1450, 780], [1650, 660], [1960, 600]], density: 1.1, tones: ['dark', 'mid', 'deep'], stems: 0.35, seed: 147 },
      { type: 'moss', x: 1700, y: 760, w: 380, h: 60, scale: 1.6, seed: 132 },
      { type: 'fern', x: 1600, y: 760, len: 200, rot: 0.9, curl: 0.25, color: 'light', reach: 0.22, seed: 133 },
      { type: 'fern', x: 1880, y: 700, len: 180, rot: -0.7, curl: -0.2, color: 'mid', reach: 0.22, seed: 134 },
      { type: 'larkspur', x: 1540, y: 700, h: 180, w: 62, lean: 0.03, spike: 0.6, seed: 135 },
      { type: 'daisy', base: [1480, 720], head: [1470, 650], r: 20, petals: 6, palette: { daisy: { petal: '#f08a3a', tip: '#f8a858', shade: '#b05a20', center: '#f8c040' } }, seed: 136 },
      { type: 'daisy', base: [1515, 720], head: [1508, 672], r: 16, petals: 6, palette: { daisy: { petal: '#f0c040', tip: '#f8d860', shade: '#b08020', center: '#e88a20' } }, seed: 137 },
      { type: 'amanita', x: 1808, y: 565, size: 52, tall: 0.6, palette: { amanita: { cap: '#e8682a', capLight: '#f8904a', capDark: '#a83810' } }, seed: 138 },
      { type: 'amanita', x: 1622, y: 640, size: 118, tall: 0.42, lean: 0.03, seed: 139 },
    ],
    [
      { type: 'fern', x: 1570, y: 1080, len: 260, rot: -0.35, curl: -0.15, color: 'dark', seed: 140 },
      { type: 'amanita', x: 1800, y: 915, size: 330, tall: 0.32, lean: -0.03, seed: 141 },
    ],
    [
      { type: 'amanita', x: 1685, y: 1010, size: 140, tall: 0.5, lean: 0.02, seed: 142 },
      { type: 'larkspur', x: 1850, y: 1120, h: 250, w: 120, lean: -0.02, spike: 0.7, seed: 143 },
      { type: 'blade', x: 1470, y: 1110, len: 160, width: 0.14, rot: -0.4, curl: -0.1, tone: 'light', seed: 144 },
      { type: 'clover', x: 1560, y: 1050, r: 40, rot: 0.3, squash: 0.78, color: '#2f6a60', stalk: [1565, 1130], seed: 145 },
    ],
  ],
};

export const FLOWER_BEDS = {
  'night-lake': NIGHT_LAKE,
  'dusk-bridge': DUSK_BRIDGE,
  'forest-left': FOREST_LEFT,
  'forest-right': FOREST_RIGHT,
};
