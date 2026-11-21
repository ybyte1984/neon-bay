// Neon Bay city generation: streets, blocks, buildings, parks, beach and
// the bridge. Pure data + collision helpers, no drawing and no browser in it.
import { BLOCK, CITY, ROAD_W } from './config.js';

export const STREET_X = []; // centre x of every vertical street
export const STREET_Y = []; // centre y of every horizontal street
for (let x = BLOCK / 2; x < CITY.width; x += BLOCK) STREET_X.push(x);
for (let y = BLOCK / 2; y < CITY.height; y += BLOCK) STREET_Y.push(y);

function nearestStreet(list, v) {
  let best = list[0];
  for (const s of list) if (Math.abs(s - v) < Math.abs(best - v)) best = s;
  return best;
}

/** True when the point is on a road (street centre band). */
export function onRoad(x, y) {
  for (const sx of STREET_X) if (Math.abs(x - sx) <= ROAD_W / 2 + 6) return true;
  for (const sy of STREET_Y) if (Math.abs(y - sy) <= ROAD_W / 2 + 6) return true;
  return false;
}

/** Snap a point to the nearest street centre line. */
export function snapToRoad(x, y) {
  const sx = nearestStreet(STREET_X, x);
  const sy = nearestStreet(STREET_Y, y);
  return Math.abs(x - sx) < Math.abs(y - sy) ? { x: sx, y } : { x, y: sy };
}

export function districtAt(x, y) {
  if (y >= 1560) return 'South Beach';
  if (x < 1280 && y < 640) return 'Marina';
  if (x >= 1280 && y < 640) return 'Old Town';
  if (x < 1280) return 'Uptown';
  return 'Harbor';
}

/**
 * Build the city from a seeded random: one building (sometimes a park) per
 * block, plus fixed landmarks — the marina pier, the Harbor bridge and the
 * beach. Buildings are axis-aligned rectangles; cars and people collide
 * with them through collidesBuilding().
 */
export function buildCity(random) {
  const buildings = [];
  const parks = [];
  const trees = [];
  const roofColors = ['#c96f4a', '#7d8aa0', '#b0a06a', '#8a6f9e', '#5f8a7a', '#a05a5a'];
  let colorIndex = 0;
  // Blocks sit BETWEEN streets: streets run at 160 + 320k, so a block
  // between two streets spans (street + 36) to (next street - 36).
  for (let bx = 0; bx < 7; bx += 1) {
    for (let by = 0; by < 5; by += 1) {
      const x0 = 214 + bx * BLOCK;
      const y0 = 214 + by * BLOCK;
      const w = BLOCK - ROAD_W - 36;
      const h = BLOCK - ROAD_W - 36;
      if ((bx === 2 && by === 2) || (bx === 5 && by === 3)) {
        parks.push({ x: x0, y: y0, w, h });
        for (let t = 0; t < 7; t += 1) {
          trees.push({ x: x0 + 30 + random() * (w - 60), y: y0 + 30 + random() * (h - 60), r: 12 + random() * 8 });
        }
        continue;
      }
      const inset = 14 + random() * 30;
      buildings.push({
        x: x0 + inset, y: y0 + inset,
        w: w - inset * 2, h: h - inset * 2,
        color: roofColors[colorIndex % roofColors.length],
        height: 1 + Math.floor(random() * 3),
      });
      colorIndex += 1;
    }
  }
  // Beach trees along the shore.
  for (let i = 0; i < 10; i += 1) {
    trees.push({ x: 120 + i * 240 + random() * 60, y: 1660 + random() * 80, r: 13 });
  }
  return { buildings, parks, trees };
}

/** Circle-vs-building collision; returns the building hit, or null. */
export function collidesBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/** Push a circle out of any building it overlaps; returns true if pushed. */
export function resolveBuilding(city, p, r) {
  const b = collidesBuilding(city, p.x, p.y, r);
  if (!b) return false;
  const dxLeft = p.x + r - b.x;
  const dxRight = b.x + b.w - (p.x - r);
  const dyTop = p.y + r - b.y;
  const dyBottom = b.y + b.h - (p.y - r);
  const m = Math.min(dxLeft, dxRight, dyTop, dyBottom);
  if (m === dxLeft) p.x = b.x - r;
  else if (m === dxRight) p.x = b.x + b.w + r;
  else if (m === dyTop) p.y = b.y - r;
  else p.y = b.y + b.h + r;
  return true;
}

export function clampToCity(p, r) {
  p.x = Math.max(r, Math.min(CITY.width - r, p.x));
  p.y = Math.max(r, Math.min(CITY.height - r, p.y));
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    return { x: STREET_X[Math.floor(random() * STREET_X.length)], y: 80 + random() * (CITY.height - 160) };
  }
  return { x: 80 + random() * (CITY.width - 160), y: STREET_Y[Math.floor(random() * STREET_Y.length)] };
}

/** A random point on a sidewalk / block edge, for pedestrians. */
export function randomSidewalkPoint(random) {
  const p = randomRoadPoint(random);
  p.x += (random() - 0.5) * 90;
  p.y += (random() - 0.5) * 90;
  clampToCity(p, 20);
  return p;
}
