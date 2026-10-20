// Every scene and element test sheet, loaded on demand.

export const SCENES = {
  s01: () => import('./scenes/s01_dusk_bridge.js'),
  s02: () => import('./scenes/s02_night_lake.js'),
  s03: () => import('./scenes/s03_firefly_forest.js'),
  s04: () => import('./scenes/s04_waterfall_canyon.js'),
  s05: () => import('./scenes/s05_snow_peaks.js'),
  s06: () => import('./scenes/s06_crystal_cave.js'),
  s07: () => import('./scenes/s07_storm_coast.js'),
  s08: () => import('./scenes/s08_aurora_arch.js'),
  s09: () => import('./scenes/s09_star_portal.js'),
  s10: () => import('./scenes/s10_dawn.js'),
};

export const GALLERIES = {
  calib: () => import('./gallery/calib.js'),
  sky: () => import('./gallery/sky.js'),
  clouds: () => import('./gallery/clouds.js'),
  terrain: () => import('./gallery/terrain.js'),
  trees: () => import('./gallery/trees.js'),
  flora: () => import('./gallery/flora.js'),
  water: () => import('./gallery/water.js'),
  fox: () => import('./gallery/fox.js'),
};
