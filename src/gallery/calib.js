// Calibration sheet for the paper look: sky, moon, clouds, mountains, rock.

import { Scene, W, H } from '../core/stage.js';
import { RNG } from '../core/rng.js';
import { piece, linear, radial, glow } from '../core/piece.js';
import { ridge, closeDown, ellipse, TAU } from '../core/geom.js';
import { flecks } from '../core/paper.js';
import { shade, mix } from '../core/color.js';

function star4(cx, cy, r, thin = 0.28) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * thin;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

export default function () {
  return new Scene({
    id: 'calib',
    duration: 6,
    background: '#141a3a',
    light: [0.55, -0.83],
    post: { bloom: 0.35, vignette: 0.25 },
    build(S) {
      const L = S.light;
      // Sky
      S.plane(20000, {
        name: 'sky', x: -200, y: -200, w: W + 400, h: H + 400, mat: 'sky', edge: false, shadow: false,
        draw(ctx) {
          ctx.fillStyle = linear(ctx, 0, 0, 0, H, ['#121838', '#1b2350', '#2a3266']);
          ctx.fillRect(-200, -200, W + 400, H + 400);
          flecks(ctx, -200, -200, W + 400, H * 0.8, 900, 5, { max: 1.2 });
        },
      });
      // Stars
      S.plane(15000, {
        name: 'stars', x: 0, y: 0, w: W, h: 600, mat: 'paper', shadow: { blur: 4 },
        draw(ctx) {
          const r = new RNG(3);
          for (let i = 0; i < 14; i++) {
            piece(ctx, star4(r.range(80, W - 80), r.range(40, 520), r.range(8, 22)), { fill: '#f2cf7f', bevel: { light: L, width: 1.2, hi: 0.4, lo: 0.25 } });
          }
        },
      }, { shadow: { alpha: 0.6, dx: -3, dy: 4 } });
      // Moon glow + moon
      S.add({ name: 'moonglow', z: 14000, blend: 'lighter', render(ctx) { glow(ctx, 1500, 250, 420, '#ffe9b0', 0.35); } });
      S.plane(14000, {
        name: 'moon', x: 1300, y: 50, w: 400, h: 400, mat: 'crumpled', shadow: { blur: 22 }, edge: { width: 3, hi: 0.35, lo: 0.25 },
        draw(ctx) {
          piece(ctx, ellipse(1500, 250, 175, 175, 90), { fill: radial(ctx, 1450, 200, 10, 200, ['#fff4cf', '#f4dc9a', '#e6c47a']) });
        },
      }, { shadow: { alpha: 0.75, dx: -8, dy: 14 } });
      // Cloud
      S.plane(9000, {
        name: 'cloud', x: 1050, y: 200, w: 800, h: 260, mat: 'crumpled', shadow: { blur: 14 },
        draw(ctx) {
          const r = new RNG(9);
          const base = 400;
          const puffs = [];
          for (let i = 0; i < 16; i++) {
            const x = 1100 + i * 44 + r.range(-8, 8);
            const hgt = Math.sin((i / 15) * Math.PI) * 90 + r.range(10, 40);
            puffs.push([x, base - hgt, 34 + r.range(0, 30)]);
          }
          for (const [x, y, rad] of puffs.sort((a, b) => a[1] - b[1])) {
            piece(ctx, ellipse(x, y, rad * 1.15, rad, 40), {
              fill: linear(ctx, 0, y - rad, 0, y + rad, ['#f6efe0', '#cfc5df', '#a59bc4']),
              shadow: { color: 'rgba(30,20,60,0.45)', blur: 8, x: -2, y: 5 },
              bevel: { light: L, width: 2, hi: 0.45, lo: 0.15 },
            });
          }
          piece(ctx, [[1080, base - 10], [1860, base - 10], [1860, base + 20], [1080, base + 20]], { fill: '#a39ac2', torn: { amp: 2, seed: 4 } });
        },
      });
      // Far mountains
      const mount = (name, z, baseY, amp, col, lit, snow, seed) => {
        S.plane(z, {
          name, x: -200, y: baseY - amp * 2.2, w: W + 400, h: H - baseY + amp * 2.2 + 200, mat: 'paper', shadow: { blur: 12 },
          draw(ctx) {
            const top = ridge(-200, W + 200, baseY, { amp, freq: 0.0035, sharp: 0.85, seed, step: 10 });
            piece(ctx, closeDown(top, H + 200), { fill: col, torn: { amp: 1.5, seed } });
            // Lit faces: from each local peak, a facet sloping down to the right.
            const r = new RNG(seed);
            for (let i = 1; i < top.length - 1; i++) {
              const p = top[i];
              if (p[1] < top[i - 1][1] && p[1] <= top[i + 1][1]) {
                const w = r.range(60, 160), h = r.range(120, 260);
                piece(ctx, [[p[0], p[1]], [p[0] + w, p[1] + h * 0.5], [p[0] + w * 0.3, p[1] + h]], { fill: lit, alpha: 0.85, torn: { amp: 2, seed: i } });
                if (snow && p[1] < baseY - amp * 0.2) {
                  piece(ctx, [[p[0] - 4, p[1] - 2], [p[0] + w * 0.45, p[1] + h * 0.22], [p[0] + w * 0.1, p[1] + h * 0.28], [p[0] - w * 0.25, p[1] + h * 0.18]], {
                    fill: '#eef0f8', torn: { amp: 3, freq: 0.15, seed: i + 7 }, rim: { color: '#ffffff', width: 1 },
                  });
                }
              }
            }
          },
        });
      };
      mount('mtn-far', 6000, 640, 160, '#5a5f9a', '#8a8fc4', true, 21);
      mount('mtn-mid', 3500, 760, 110, '#3d4a7e', '#62709f', true, 34);
      // Hills
      S.plane(2000, {
        name: 'hill', x: -200, y: 650, w: W + 400, h: 600, mat: 'paper',
        draw(ctx) {
          const top = ridge(-200, W + 200, 860, { amp: 70, freq: 0.002, sharp: 0.1, seed: 5, step: 12 });
          piece(ctx, closeDown(top, H + 200), { fill: linear(ctx, 0, 760, 0, H, ['#7d9a3c', '#4f6f2a']), torn: { amp: 1.2, seed: 2 } });
        },
      });
      // Rock
      S.plane(800, {
        name: 'rock', x: 300, y: 700, w: 700, h: 500, mat: 'stone', res: 1.25, shadow: { blur: 16 },
        draw(ctx) {
          const base = [[340, 1100], [380, 860], [520, 790], [760, 800], [930, 880], [980, 1100]];
          piece(ctx, base, { fill: '#5b5250' });
          piece(ctx, [[380, 860], [520, 790], [760, 800], [930, 880], [700, 900], [480, 905]], { fill: '#7b706b' });
        },
      }, { shadow: { alpha: 0.6, dx: -6, dy: 12 } });
    },
  });
}
