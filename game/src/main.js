// Boot and the one loop for Neon Bay: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, busted, wasted. Save lives in localStorage.
//
// ?seed=N fixes the city. ?shot=start|foot|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_COIN, EVENT_CRASH, EVENT_MISSION, EVENT_PUNCH, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261121;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readNumber(key) {
  try { return Number.parseInt(window.localStorage.getItem(key) ?? '0', 10) || 0; } catch { return 0; }
}
function saveGame() {
  try {
    const save = {
      cash: world.state.cash,
      respect: world.state.respect,
      mission: world.missions.state.index,
      coins: world.coins.filter((c) => c.taken).length,
      best: readNumber(BEST_KEY),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    if (world.state.cash > readNumber(BEST_KEY)) window.localStorage.setItem(BEST_KEY, String(world.state.cash));
  } catch { /* storage can be off */ }
}
function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, { shake: 0 });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readNumber(BEST_KEY);
  let accumulator = 0;
  // Debug/test handles: the playtest reads the live world through these.
  window.__world = world;
  window.__screen = () => screen;
  let last = performance.now();
  let shake = 0;
  const saved = loadSave();
  if (saved && saved.cash > 0) {
    world.state.cash = saved.cash;
    world.state.respect = saved.respect || 0;
    if (saved.mission > 0 && saved.mission < 4) world.missions.start(saved.mission);
  }

  function announce(message) { status.textContent = message; }
  function startGame() {
    world.reset();
    if (saved && saved.cash > 0) { world.state.cash = saved.cash; world.state.respect = saved.respect || 0; }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.ensure();
    audio.startMusic();
    announce('Playing Neon Bay. Meet Rico at the Marina pier.');
  }
  function endGame(kind) {
    screen = kind;
    saveGame();
    if (world.state.cash > best) best = world.state.cash;
    announce(kind === SCREEN_BUSTED ? 'Busted by the police.' : 'Wasted.');
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Read input once per frame.
    let actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const m = audio.toggleMute();
      announce(m ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_BUSTED)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
    else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }

    if (screen === SCREEN_PLAY) {
      const move = input.move();
      const drive = input.drive();
      while (accumulator >= STEP) {
        const worldInput = world.player.inCar
          ? { mx: drive.steer, my: drive.throttle, run: false, enter: Boolean(actions & ACTION_ENTER), punch: false }
          : { mx: move.mx, my: move.my, run: move.run, enter: Boolean(actions & ACTION_ENTER), punch: Boolean(actions & ACTION_PUNCH) };
        // One-shot flags must fire only on the first step of the frame.
        actions &= ~(ACTION_ENTER | ACTION_PUNCH);
        const events = world.step(STEP, worldInput);
        if (events & EVENT_COIN) audio.coin();
        if (events & EVENT_CASH) audio.pickup();
        if (events & EVENT_CRASH) { audio.crash(); shake = 10; }
        if (events & EVENT_PUNCH) audio.punch();
        if (events & EVENT_MISSION) audio.mission();
        if (world.police.stars() > 0 && Math.random() < 0.01) audio.siren();
        audio.engine(world.player.inCar ? Math.abs(world.player.speed) / 560 : 0);
        if (events & EVENT_BUSTED) { endGame(SCREEN_BUSTED); audio.busted(); break; }
        if (events & EVENT_WASTED) { endGame(SCREEN_OVER); audio.busted(); break; }
        accumulator -= STEP;
      }
      if (shake > 0) shake = Math.max(0, shake - 0.6);
    } else {
      accumulator = 0;
      audio.engineOff();
    }
    renderer.draw(world, screen, best, { shake });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  announce('Neon Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
