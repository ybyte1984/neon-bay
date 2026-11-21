// Neon Bay — every tuning number and colour in one place.
// The world is a 2560x1920 coastal city; the renderer shows a 1280x720 camera
// window that follows the player, scaled to the browser window.
export const STEP = 1 / 60;
export const VIEW = { width: 1280, height: 720 };
export const CITY = { width: 2560, height: 1920 };
export const ROAD_W = 72;
export const BLOCK = 320; // street pitch: road + block

export const PLAYER = {
  radius: 14,
  walk: 185,
  run: 310,
  punchRange: 34,
  punchDamage: 25,
  punchCooldown: 0.45,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 620,
  reverse: 200,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 6.5,
};

export const PED = { radius: 11, speed: 55 };

export const WANTED_MAX = 5;
export const SAVE_KEY = 'neon-bay.save.v1';
export const BEST_KEY = 'neon-bay.best';

export const PALETTE = {
  backdrop: '#0e1622',
  grass: '#5da24a',
  park: '#4c8f3e',
  sand: '#e8d39a',
  water: '#2f7fb8',
  deepWater: '#256b9e',
  road: '#3a3f4a',
  roadLine: '#e8d44d',
  sidewalk: '#9aa0a8',
  buildingRoof: ['#c96f4a', '#7d8aa0', '#b0a06a', '#8a6f9e', '#5f8a7a', '#a05a5a'],
  buildingEdge: '#2c2f36',
  window: '#ffe9a8',
  tree: '#2f6b2a',
  player: '#ffd23f',
  playerShirt: '#e74c3c',
  cop: '#2f6fd0',
  policeCar: '#1f4fd8',
  taxi: '#f5c518',
  hudBg: 'rgba(10,16,26,0.72)',
  hudText: '#f2f5f7',
  hudMuted: '#aeb8c4',
  star: '#ffd23f',
  health: '#3ddc5f',
  armor: '#4fc3f7',
  marker: '#ff5fa2',
  text: '#f2f5f7',
  muted: '#aeb8c4',
  panel: '#141c28',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const DISTRICTS = [
  { name: 'Marina', x: 0, y: 0, w: 1280, h: 640, tint: '#7fb8d8' },
  { name: 'Old Town', x: 1280, y: 0, w: 1280, h: 640, tint: '#d8b47f' },
  { name: 'Uptown', x: 0, y: 640, w: 1280, h: 640, tint: '#9fb8d8' },
  { name: 'Harbor', x: 1280, y: 640, w: 1280, h: 640, tint: '#8ad0c0' },
  { name: 'South Beach', x: 0, y: 1280, w: 2560, h: 640, tint: '#e8d39a' },
];
