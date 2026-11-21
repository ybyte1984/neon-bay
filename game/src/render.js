// Drawing only: the world's state and the current screen in, pixels out.
// A camera follows the player over the city; the HUD, minimap and panels
// are drawn in screen space. Flat shapes, canvas text, no images.
import { CITY, PALETTE, VIEW, FONT, WANTED_MAX, ROAD_W } from './config.js';
import { STREET_X, STREET_Y } from './city.js';
import { MISSIONS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function drawCity(world) {
    const { city } = world;
    const camX = world.camera.x - VIEW.width / 2;
    const camY = world.camera.y - VIEW.height / 2;
    // Ground: grass, then beach sand and water along the south shore.
    context.fillStyle = PALETTE.grass;
    context.fillRect(camX, camY, VIEW.width, VIEW.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(camX, 1780, VIEW.width, VIEW.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(camX, 1560, VIEW.width, 220);
    context.fillStyle = PALETTE.deepWater;
    for (let x = 0; x < 8; x += 1) {
      context.fillRect(camX + x * 340 + 60, 1820, 180, 8);
    }
    // Parks.
    for (const p of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(p.x, p.y, p.w, p.h);
    }
    // Roads.
    context.fillStyle = PALETTE.road;
    for (const sx of STREET_X) context.fillRect(sx - ROAD_W / 2, 0, ROAD_W, CITY.height);
    for (const sy of STREET_Y) context.fillRect(0, sy - ROAD_W / 2, CITY.width, ROAD_W);
    // Centre dashes.
    context.fillStyle = PALETTE.roadLine;
    for (const sx of STREET_X) {
      for (let y = 0; y < CITY.height; y += 64) context.fillRect(sx - 3, y, 6, 30);
    }
    for (const sy of STREET_Y) {
      for (let x = 0; x < CITY.width; x += 64) context.fillRect(x, sy - 3, 30, 6);
    }
    // Bridge over the beach road, south.
    context.fillStyle = '#7d8aa0';
    context.fillRect(1240, 1560, 80, 200);
    context.fillStyle = PALETTE.roadLine;
    for (let y = 1560; y < 1760; y += 48) context.fillRect(1277, y, 6, 24);
    // Buildings with roofs and windows.
    for (const b of city.buildings) {
      context.fillStyle = PALETTE.buildingEdge;
      context.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.window;
      const cols = Math.max(2, Math.floor(b.w / 46));
      const rows = Math.max(2, Math.floor(b.h / 46));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c + r) % 2 === 0) context.fillRect(b.x + 12 + c * 44, b.y + 12 + r * 44, 18, 14);
        }
      }
    }
    // Trees.
    for (const t of city.trees) {
      context.fillStyle = '#6b4a2f';
      context.fillRect(t.x - 3, t.y - 3, 6, 6);
      context.fillStyle = PALETTE.tree;
      context.beginPath(); context.arc(t.x, t.y - 6, t.r, 0, Math.PI * 2); context.fill();
    }
    // Marina pier, drawn on the west edge over the sand, not over buildings.
    context.fillStyle = '#8a6f4a';
    context.fillRect(0, 200, 90, 24);
  }

  function drawCar(car, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = '#14181f';
    context.fillRect(-29, -15, 58, 30);
    context.fillStyle = car.color;
    context.fillRect(-27, -13, 54, 26);
    context.fillStyle = '#bfe8ff';
    context.fillRect(-6, -11, 14, 22);
    context.fillStyle = '#ffd23f';
    context.fillRect(24, -11, 3, 6);
    context.fillRect(24, 5, 3, 6);
    if (isPlayer) {
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      context.strokeRect(-29, -15, 58, 30);
    }
    context.restore();
  }
  function drawPed(ped, isCop) {
    context.fillStyle = isCop ? '#1f4fd8' : ped.color;
    context.beginPath(); context.arc(ped.x, ped.y, 11, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#f2c9a0';
    context.beginPath(); context.arc(ped.x, ped.y - 2, 6, 0, Math.PI * 2); context.fill();
    if (isCop) {
      context.fillStyle = '#1f4fd8';
      context.fillRect(ped.x - 8, ped.y - 16, 16, 5);
    }
  }
  function drawPlayer(world) {
    const p = world.player;
    if (p.inCar) return;
    context.save();
    context.translate(p.x, p.y);
    context.rotate(p.angle);
    context.fillStyle = PALETTE.playerShirt;
    context.beginPath(); context.arc(0, 0, 14, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#f2c9a0';
    context.beginPath(); context.arc(6, 0, 7, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#222';
    context.fillRect(10, -4, 6, 8);
    context.restore();
    // Facing tick.
    context.strokeStyle = 'rgba(255,255,255,0.8)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
    context.lineTo(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24);
    context.stroke();
  }

  function drawMinimap(world) {
    const mw = 190; const mh = 142;
    const x0 = VIEW.width - mw - 16; const y0 = VIEW.height - mh - 16;
    const sx = mw / CITY.width; const sy = mh / CITY.height;
    context.fillStyle = PALETTE.hudBg;
    context.fillRect(x0 - 6, y0 - 6, mw + 12, mh + 12);
    context.fillStyle = '#2c3a2c';
    context.fillRect(x0, y0, mw, mh);
    context.strokeStyle = '#9aa0a8';
    context.lineWidth = 1;
    for (const s of STREET_X) { context.beginPath(); context.moveTo(x0 + s * sx, y0); context.lineTo(x0 + s * sx, y0 + mh); context.stroke(); }
    for (const s of STREET_Y) { context.beginPath(); context.moveTo(x0, y0 + s * sy); context.lineTo(x0 + mw, y0 + s * sy); context.stroke(); }
    context.fillStyle = '#2f7fb8';
    context.fillRect(x0, y0 + 1560 * sy, mw, mh - 1560 * sy);
    const obj = world.missions.objective();
    if (obj && obj.x) {
      context.fillStyle = PALETTE.marker;
      context.beginPath(); context.arc(x0 + obj.x * sx, y0 + obj.y * sy, 6, 0, Math.PI * 2); context.fill();
    }
    if (world.state.taxi) {
      const t = world.state.taxi;
      const tx = t.stage === 'pickup' ? t.px : t.dx;
      const ty = t.stage === 'pickup' ? t.py : t.dy;
      context.fillStyle = '#f5c518';
      context.beginPath(); context.arc(x0 + tx * sx, y0 + ty * sy, 5, 0, Math.PI * 2); context.fill();
    }
    for (const cop of world.police.cops) {
      context.fillStyle = '#4f8cff';
      context.fillRect(x0 + cop.x * sx - 3, y0 + cop.y * sy - 3, 6, 6);
    }
    context.fillStyle = '#ffd23f';
    context.beginPath(); context.arc(x0 + world.player.x * sx, y0 + world.player.y * sy, 6, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.beginPath(); context.arc(x0 + world.player.x * sx, y0 + world.player.y * sy, 6, 0, Math.PI * 2); context.stroke();
    text('N', x0 + mw - 10, y0 + 16, 14, PALETTE.hudText, 'center', 'top');
  }

  function drawHud(world, best) {
    const stars = world.police.stars();
    const c = world.combat.state;
    // Top-left panel: cash, health, armour, respect, district.
    context.fillStyle = PALETTE.hudBg;
    context.fillRect(12, 12, 300, 96);
    text(`$${world.state.cash}`, 24, 40, 26, PALETTE.gold, 'left', 'top');
    text(`Respect ${world.state.respect}`, 150, 42, 16, PALETTE.hudMuted, 'left', 'top');
    text(world.districtAt(), 24, 66, 16, PALETTE.hudText, 'left', 'top');
    context.fillStyle = '#222';
    context.fillRect(24, 88, 180, 10);
    context.fillStyle = PALETTE.health;
    context.fillRect(24, 88, 180 * (c.health / 100), 10);
    if (c.armor > 0) {
      context.fillStyle = PALETTE.armor;
      context.fillRect(214, 88, 60 * (c.armor / 100), 10);
    }
    // Wanted stars, top centre.
    for (let i = 0; i < WANTED_MAX; i += 1) {
      text('★', VIEW.width / 2 - 70 + i * 30, 30, 30, i < stars ? PALETTE.star : 'rgba(255,255,255,0.25)', 'center', 'top');
    }
    // Mission objective, top centre below stars.
    const objText = world.missions.objectiveText();
    if (objText) {
      const w = context.measureText(objText).width;
      context.fillStyle = PALETTE.hudBg;
      context.fillRect(VIEW.width / 2 - 230, 52, 460, 34);
      text(objText, VIEW.width / 2, 74, 18, PALETTE.hudText, 'center', 'top');
      void w;
    }
    const timer = world.missions.state.timer;
    if (timer > 0) text(`⏱ ${Math.ceil(timer)}s`, VIEW.width / 2, 100, 20, '#ff8a80', 'center', 'top');
    // Banner.
    if (world.state.bannerTimer > 0 && world.state.banner) {
      context.fillStyle = PALETTE.hudBg;
      context.fillRect(VIEW.width / 2 - 260, 120, 520, 36);
      text(world.state.banner, VIEW.width / 2, 144, 19, PALETTE.gold, 'center', 'top');
    }
    // Speed, bottom left, when driving.
    if (world.player.inCar) {
      const mph = Math.round(Math.abs(world.player.speed) * 0.12);
      text(`${mph} mph`, 24, VIEW.height - 30, 28, PALETTE.hudText, 'left', 'top');
      text('W/S drive · A/D steer · E exit', 24, VIEW.height - 62, 15, PALETTE.hudMuted, 'left', 'top');
    } else {
      text('WASD move · Shift run · E enter car · Space punch · P pause', 24, VIEW.height - 30, 15, PALETTE.hudMuted, 'left', 'top');
    }
    drawMinimap(world);
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 32;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 62, 44, PALETTE.gold, 'center', 'top');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 120 + i * 32, 20, PALETTE.muted, 'center', 'top');
    }
    text(prompt, VIEW.width / 2, y + height - 38, 20, PALETTE.hudText, 'center', 'top');
  }

  function draw(world, screen, best, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const camX = world.camera.x - VIEW.width / 2;
    const camY = world.camera.y - VIEW.height / 2;
    // World space, scaled, with a little shake when crashing.
    let shakeX = 0; let shakeY = 0;
    if (extra && extra.shake > 0) { shakeX = (Math.random() - 0.5) * extra.shake; shakeY = (Math.random() - 0.5) * extra.shake; }
    context.setTransform(view.scale, 0, 0, view.scale, view.x - camX * view.scale + shakeX, view.y - camY * view.scale + shakeY);
    drawCity(world);
    // Skid marks.
    context.strokeStyle = 'rgba(20,20,20,0.5)';
    context.lineWidth = 5;
    for (const s of world.skids) {
      context.beginPath();
      context.moveTo(s.x - Math.cos(s.angle) * 12, s.y - Math.sin(s.angle) * 12);
      context.lineTo(s.x + Math.cos(s.angle) * 12, s.y + Math.sin(s.angle) * 12);
      context.stroke();
    }
    // Collectibles.
    for (const coin of world.coins) {
      if (coin.taken) continue;
      context.fillStyle = PALETTE.gold;
      context.beginPath(); context.arc(coin.x, coin.y, 12, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#8a6d00';
      text('N', coin.x, coin.y + 5, 16, '#8a6d00', 'center', 'top');
    }
    // Mission marker.
    const obj = world.missions.objective();
    if (obj && obj.x) {
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 4;
      context.beginPath(); context.arc(obj.x, obj.y, 34 + Math.sin(Date.now() / 300) * 6, 0, Math.PI * 2); context.stroke();
      context.fillStyle = PALETTE.marker;
      context.beginPath(); context.arc(obj.x, obj.y, 8, 0, Math.PI * 2); context.fill();
    }
    if (world.state.taxi) {
      const t = world.state.taxi;
      const tx = t.stage === 'pickup' ? t.px : t.dx;
      const ty = t.stage === 'pickup' ? t.py : t.dy;
      context.fillStyle = '#f5c518';
      context.beginPath(); context.arc(tx, ty, 10, 0, Math.PI * 2); context.fill();
    }
    // Chop shop marker.
    context.fillStyle = '#8a5fd0';
    context.fillRect(2200, 1400, 80, 80);
    text('CHOP', 2240, 1444, 16, '#fff', 'center', 'top');
    // Cars, peds, cops, player.
    for (const car of world.traffic.cars) drawCar(car, car === world.player.car);
    for (const cop of world.police.cops) {
      if (cop.car) drawCar(cop.car, false);
      else drawPed(cop, true);
    }
    for (const ped of world.traffic.peds) drawPed(ped, false);
    for (const p of world.particles) {
      context.fillStyle = p.color;
      context.beginPath(); context.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); context.fill();
    }
    drawPlayer(world);
    // Screen space: HUD and panels.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawPanel('NEON BAY', ['A sun-soaked open-world crime game.', 'Steal cars. Lose the cops. Finish the story.', `Best cash $${best}`, ''], 'Press Space or click to start');
      return;
    }
    drawHud(world, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.', `Cash $${world.state.cash} · Mission: ${world.missions.current() ? world.missions.current().title : 'Free roam'}`], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('Wasted', [`Cash $${world.state.cash}`, `Best $${best}`, ''], 'Press Space to play again');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('Busted', ['The Neon Bay police caught up with you.', `Cash $${world.state.cash}`, ''], 'Press Space to play again');
    }
  }

  return { draw };
}
