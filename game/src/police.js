// The wanted system: heat, stars, and the police who respond to them.
// Heat rises with crimes and falls when the player stays out of trouble and
// out of sight; police cars and foot cops spawn at the city edge and chase.
import { WANTED_MAX } from './config.js';
import { clampToCity } from './city.js';
import { makeCar } from './traffic.js';

export const CRIME = {
  stealCar: 1.2,
  hitPed: 1.5,
  hitCop: 2.0,
  crash: 0.2,
  speeding: 0.05,
};

export function createPolice(random) {
  const cops = []; // {x,y,angle,speed,car|null,foot}
  const state = { heat: 0, stars: 0, quiet: 0, sirenTimer: 0 };

  function stars() { return Math.min(WANTED_MAX, Math.floor(state.heat)); }
  function addCrime(amount) {
    state.heat = Math.min(WANTED_MAX + 0.99, state.heat + amount);
    state.quiet = 0;
    state.timeSinceCrime = 0;
    state.stars = stars();
  }
  function setWanted(n) {
    state.heat = n;
    state.stars = n;
    state.quiet = 0;
    state.timeSinceCrime = 0;
  }
  function spawnCop(playerPos, inCar) {
    const edge = Math.floor(random() * 4);
    let x = playerPos.x;
    let y = playerPos.y;
    if (edge === 0) { x = playerPos.x - 700; y = playerPos.y - 500; }
    else if (edge === 1) { x = playerPos.x + 700; y = playerPos.y - 500; }
    else if (edge === 2) { x = playerPos.x - 700; y = playerPos.y + 500; }
    else { x = playerPos.x + 700; y = playerPos.y + 500; }
    x = Math.max(60, Math.min(2500, x));
    y = Math.max(60, Math.min(1860, y));
    if (inCar) {
      const car = makeCar(x, y, 0, '#1f4fd8', 'police');
      cops.push({ x, y, angle: 0, speed: 0, car, foot: false });
    } else {
      cops.push({ x, y, angle: 0, speed: 0, car: null, foot: true });
    }
  }
  function ensureCops(playerPos, inCar) {
    const want = state.stars <= 1 ? 1 : state.stars <= 3 ? state.stars : 5;
    while (cops.length < want) spawnCop(playerPos, inCar && cops.length % 2 === 0);
    while (cops.length > want) cops.pop();
  }
  /** Step the chase. Returns 'busted' when a foot cop catches the player. */
  function step(dt, playerPos, playerInCar, playerSpeed) {
    state.stars = stars();
    state.timeSinceCrime = (state.timeSinceCrime || 0) + dt;
    if (state.stars === 0) {
      cops.length = 0;
      return null;
    }
    ensureCops(playerPos, playerInCar);
    const nearest = cops.length ? Math.min(...cops.map((c) => Math.hypot(c.x - playerPos.x, c.y - playerPos.y))) : 9999;
    if (nearest > 520 && playerSpeed < 60) state.quiet += dt;
    else state.quiet = 0;
    // No new crime for a while and the player is not right under a cop:
    // the heat cools off on its own, so losing the cops is achievable.
    if (state.timeSinceCrime > 12 && nearest > 300) {
      state.heat = Math.max(0, state.heat - dt * 0.2);
      state.stars = stars();
    }
    if (state.quiet > 14) {
      state.heat = Math.max(0, state.heat - dt * 0.25);
      state.stars = stars();
    }
    state.sirenTimer -= dt;
    for (const cop of cops) {
      const dx = playerPos.x - cop.x;
      const dy = playerPos.y - cop.y;
      const dist = Math.hypot(dx, dy) || 1;
      cop.angle = Math.atan2(dy, dx);
      const speed = cop.foot ? 200 + state.stars * 12 : 380 + state.stars * 45;
      cop.speed = speed;
      cop.x += (dx / dist) * speed * dt;
      cop.y += (dy / dist) * speed * dt;
      if (cop.car) { cop.car.x = cop.x; cop.car.y = cop.y; cop.car.angle = cop.angle; cop.car.speed = speed; }
      clampToCity(cop, 20);
      if (!playerInCar && cop.foot && dist < 26) return 'busted';
      if (playerInCar && dist < 34) return 'rammed';
    }
    return null;
  }
  function reset() {
    cops.length = 0;
    state.heat = 0;
    state.stars = 0;
    state.quiet = 0;
    state.timeSinceCrime = 999;
  }
  return { cops, state, stars, addCrime, setWanted, step, reset, ensureCops };
}
