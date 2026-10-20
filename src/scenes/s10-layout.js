// Shared layout of the dawn scene (s10): where the light, the fox and the landed star
// sit with the camera at rest, in film px (reference px x 1.1483).

// Key light: the rising sun low on the right.
export const LIGHT = [0.75, -0.66];

// Sun disc behind the right-hand peaks (the ridge in front cuts it at its centre line).
export const SUN = { x: 1507, y: 356, r: 84 };

// The fox sits on the flat rock at the left, looking up toward the sun.
export const FOX = { x: 618, y: 650, scale: 0.9, z: 950 };

// The landed guiding star: a glowing star-shaped flower beside the fox.
export const BLOOM = { x: 703, y: 548, stem: [707, 648], z: 944 };

// Story beats (local time): the star falls from the sky and lands, then the flower opens.
export const T_FALL = 1.6;
export const T_LAND = 2.375;
export const T_OPEN = 0.6;   // seconds the petals take to unfold

// The lake, shared by the land and water modules.
export const LAKE = { top: 580, x0: 1000, x1: 2200 };

// Planes of the near foreground extend this far past the frame (camera overscan).
export const OVER = 320;
