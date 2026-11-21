// Neon Bay world: the simulation, with no drawing and no browser in it.
// The player (on foot or in a car), traffic, pedestrians, police, missions,
// collectibles, taxi fares and the chop shop all live here. step() advances
// one fixed step and returns what happened as bit flags.
import { CAR, CITY, PED, PLAYER, STEP, VIEW, WANTED_MAX } from './config.js';
import { buildCity, clampToCity, districtAt, randomRoadPoint, randomSidewalkPoint, resolveBuilding, onRoad } from './city.js';
import { createTraffic, makeCar } from './traffic.js';
import { createPolice, CRIME } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';

export const EVENT_COIN = 1;
export const EVENT_HIT = 2;
export const EVENT_BUSTED = 4;
export const EVENT_WASTED = 8;
export const EVENT_MISSION = 16;
export const EVENT_CASH = 32;
export const EVENT_CRASH = 64;
export const EVENT_PUNCH = 128;

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function createWorld(random) {
  const city = buildCity(random);
  const traffic = createTraffic(random, city);
  const police = createPolice(random);
  const combat = createCombat();
  const missions = createMissions();
  const player = { x: 480, y: 320, angle: 0, speed: 0, inCar: false, car: null, moving: false };
  const camera = { x: 480, y: 320 };
  const coins = [];
  const particles = [];
  const skids = [];
  const state = {
    cash: 250, respect: 0, elapsed: 0, bustedCount: 0, wastedCount: 0,
    banner: '', bannerTimer: 0, missionFailed: false, storyComplete: false,
    taxi: null, chopCash: 0,
  };

  function spawnCoins() {
    coins.length = 0;
    const spots = [
      [320, 160], [1120, 480], [1760, 160], [2240, 480], [160, 800], [800, 1120],
      [1440, 800], [2080, 1440], [480, 1440], [1120, 1760], [1760, 1760], [2240, 1760],
    ];
    for (const [x, y] of spots) coins.push({ x, y, taken: false });
  }
  function addParticles(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * Math.PI * 2;
      particles.push({ x, y, vx: Math.cos(a) * speed * (0.4 + random() * 0.6), vy: Math.sin(a) * speed * (0.4 + random() * 0.6), life: 0.5 + random() * 0.4, color, size: 3 + random() * 4 });
      if (particles.length > 220) particles.shift();
    }
  }
  function addSkid(x, y, angle) {
    skids.push({ x, y, angle, life: 4 });
    if (skids.length > 200) skids.shift();
  }

  function reset() {
    player.x = 480; player.y = 320; player.angle = 0; player.speed = 0; player.inCar = false; player.car = null;
    camera.x = player.x; camera.y = player.y;
    traffic.reset();
    police.reset();
    combat.reset();
    missions.reset();
    missions.start(0);
    state.cash = 250; state.respect = 0; state.elapsed = 0;
    state.banner = 'Welcome to Neon Bay'; state.bannerTimer = 3;
    state.taxi = null;
    spawnCoins();
    particles.length = 0; skids.length = 0;
  }

  function nearestCar(maxDist) {
    let best = null; let bestD = maxDist;
    for (const car of traffic.cars) {
      const d = dist(player, car);
      if (d < bestD) { best = car; bestD = d; }
    }
    return best;
  }

  // Stealing is judged at entry time by the car's previous kind, kept here.
  function tryEnterCar() {
    const car = nearestCar(78);
    if (!car || car.kind === 'police') return false;
    const wasTaxi = car.kind === 'taxi';
    player.inCar = true;
    player.car = car;
    car.kind = 'player';
    if (!wasTaxi) police.addCrime(CRIME.stealCar);
    if (wasTaxi) startTaxiFare();
    return true;
  }
  function exitCar() {
    if (!player.inCar || !player.car) return;
    const car = player.car;
    car.kind = 'parked';
    car.speed = 0;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
    clampToCity(player, 16);
    resolveBuilding(city, player, PLAYER.radius);
    player.inCar = false;
    player.car = null;
    player.speed = 0;
  }

  function startTaxiFare() {
    const p = randomSidewalkPoint(random);
    const d = randomRoadPoint(random);
    state.taxi = { stage: 'pickup', px: p.x, py: p.y, dx: d.x, dy: d.y, fare: 120 };
    state.banner = 'Taxi fare: pick up the passenger';
    state.bannerTimer = 3;
  }

  function driveCar(dt, input) {
    const car = player.car;
    const forward = input.throttle !== undefined ? input.throttle : input.my;
    const steer = input.steer !== undefined ? input.steer : input.mx;
    if (forward > 0) car.speed += CAR.accel * dt;
    else if (forward < 0) car.speed -= (car.speed > 20 ? CAR.brake : CAR.reverse) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const steerAmount = CAR.steer * (car.speed / CAR.maxSpeed) * steer * dt * (car.speed < 0 ? -1 : 1);
    car.angle += steerAmount;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = nx; car.y = ny;
    player.x = car.x; player.y = car.y; player.angle = car.angle; player.speed = car.speed;
    if (Math.abs(car.speed) > 320 && steer !== 0) addSkid(car.x, car.y, car.angle);
    if (resolveBuilding(city, car, 26)) {
      if (Math.abs(car.speed) > 260 && combat.state.hurtTimer <= 0) {
        combat.damage(8);
        addParticles(car.x, car.y, '#e8a13d', 10, 160);
        police.addCrime(CRIME.crash);
        car.speed *= -0.2;
        return EVENT_CRASH;
      }
      car.speed *= 0.4;
    }
    clampToCity(car, 30);
    return 0;
  }

  function walkPlayer(dt, input) {
    const len = Math.hypot(input.mx, input.my);
    player.moving = len > 0.1;
    if (player.moving) {
      const speed = input.run ? PLAYER.run : PLAYER.walk;
      player.angle = Math.atan2(input.my, input.mx);
      player.x += (input.mx / (len || 1)) * speed * dt;
      player.y += (input.my / (len || 1)) * speed * dt;
      player.speed = speed;
    } else player.speed = 0;
    clampToCity(player, PLAYER.radius);
    resolveBuilding(city, player, PLAYER.radius);
  }

  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    combat.step(dt);
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    const m = missions.current();
    const obj = missions.objective();
    if (obj && obj.timer) {
      missions.state.timer -= dt;
      if (missions.state.timer <= 0) {
        missions.start(missions.state.index);
        state.cash = Math.max(0, state.cash - 50);
        state.banner = 'Too slow — the job reset. -$50';
        state.bannerTimer = 3;
      }
    }

    if (input.enter) {
      if (player.inCar) exitCar();
      else if (tryEnterCar()) events |= EVENT_CASH;
    }
    if (input.punch && !player.inCar) {
      const hit = combat.punch(player, traffic.peds, police.cops);
      if (hit.length) {
        events |= EVENT_PUNCH;
        for (const h of hit) {
          if (h.foot) police.addCrime(CRIME.hitCop);
          else {
            police.addCrime(CRIME.hitPed);
            const i = traffic.peds.indexOf(h);
            if (i >= 0) traffic.peds.splice(i, 1);
            addParticles(h.x, h.y, '#e8e8e8', 8, 120);
          }
        }
      }
    }

    if (player.inCar) events |= driveCar(dt, input);
    else walkPlayer(dt, input);

    // Traffic and pedestrians.
    traffic.stepCars(dt, player.car);
    traffic.stepPeds(dt, player, player);

    // Car vs traffic cars: bounce and slow down.
    if (player.inCar) {
      for (const car of traffic.cars) {
        if (car === player.car || car.kind === 'parked') continue;
        if (dist(player.car, car) < 52) {
          const push = 52 - dist(player.car, car);
          const a = Math.atan2(player.car.y - car.y, player.car.x - car.x);
          player.car.x += Math.cos(a) * push * 0.5;
          player.car.y += Math.sin(a) * push * 0.5;
          if (Math.abs(player.car.speed) > 240) {
            combat.damage(8);
            events |= EVENT_CRASH;
            addParticles(player.car.x, player.car.y, '#e8a13d', 8, 140);
          }
          player.car.speed *= 0.7;
          car.speed *= 0.5;
        }
      }
      // Car vs pedestrians.
      for (let i = traffic.peds.length - 1; i >= 0; i -= 1) {
        const ped = traffic.peds[i];
        if (dist(player.car, ped) < 34 && Math.abs(player.car.speed) > 40) {
          traffic.peds.splice(i, 1);
          police.addCrime(CRIME.hitPed);
          addParticles(ped.x, ped.y, '#e8e8e8', 10, 160);
          events |= EVENT_HIT;
        }
      }
    } else {
      // On foot, a fast traffic car can hit the player.
      for (const car of traffic.cars) {
        if (car.kind === 'parked') continue;
        if (dist(player, car) < 30 && Math.abs(car.speed) > 120) {
          if (combat.damage(15)) events |= EVENT_HIT;
          player.x += (player.x - car.x) * 0.4;
          player.y += (player.y - car.y) * 0.4;
        }
      }
    }

    // Collectibles.
    for (const coin of coins) {
      if (!coin.taken && dist(player, coin) < 34) {
        coin.taken = true;
        state.cash += 50;
        state.respect += 1;
        events |= EVENT_COIN;
        addParticles(coin.x, coin.y, '#f2c94c', 10, 120);
      }
    }

    // Taxi fare.
    if (state.taxi && player.inCar) {
      const t = state.taxi;
      if (t.stage === 'pickup' && dist(player, { x: t.px, y: t.py }) < 60) {
        t.stage = 'dropoff';
        state.banner = 'Passenger aboard — drive to the marker';
        state.bannerTimer = 3;
      } else if (t.stage === 'dropoff' && dist(player, { x: t.dx, y: t.dy }) < 70) {
        state.cash += t.fare;
        state.respect += 2;
        state.taxi = null;
        state.banner = `Fare complete +$${t.fare}`;
        state.bannerTimer = 3;
        events |= EVENT_CASH;
      }
    }

    // Chop shop: drive a stolen car in, get cash, lose the car.
    if (player.inCar && Math.hypot(player.x - 2240, player.y - 1440) < 80) {
      const car = player.car;
      const i = traffic.cars.indexOf(car);
      if (i >= 0) traffic.cars.splice(i, 1);
      player.inCar = false; player.car = null; player.speed = 0;
      player.x = 2240; player.y = 1520;
      state.cash += 150;
      state.banner = 'Chop shop +$150';
      state.bannerTimer = 3;
      events |= EVENT_CASH;
    }

    // Police.
    const policeResult = police.step(dt, player, player.inCar, Math.abs(player.speed));
    if (policeResult === 'busted') {
      state.bustedCount += 1;
      const lost = Math.min(state.cash, 100);
      state.cash -= lost;
      police.reset();
      combat.heal(40);
      player.x = 480; player.y = 320;
      if (player.inCar) { player.inCar = false; player.car = null; }
      // Getting caught fails the current mission: it restarts, so losing
      // the cops by getting busted does not complete mission 3 for free.
      if (missions.current()) missions.start(missions.state.index);
      state.banner = `Busted! -$${lost}. You wake up at the Marina.`;
      state.bannerTimer = 4;
      return events | EVENT_BUSTED;
    }
    if (policeResult === 'rammed') {
      if (combat.damage(4)) events |= EVENT_HIT;
    }

    // Mission progress.
    if (obj) {
      if (obj.loseWanted) {
        if (police.stars() === 0) {
          const r = missions.advance();
          if (r) { state.cash += r.reward; state.respect += 5; state.banner = `Mission complete +$${r.reward}`; state.bannerTimer = 4; events |= EVENT_MISSION; if (r.type === 'story') state.storyComplete = true; }
        }
      } else if (dist(player, obj) < obj.r) {
        if (!obj.needCar || player.inCar) {
          const r = missions.advance();
          if (r) {
            if (r.type === 'objective') { state.banner = 'Objective complete'; state.bannerTimer = 2; }
            else { state.cash += r.reward; state.respect += 5; state.banner = `Mission complete +$${r.reward}`; state.bannerTimer = 4; events |= EVENT_MISSION; if (r.type === 'story') state.storyComplete = true; }
          }
        }
      }
      // Mission 3 starts with heat: set it once when the mission begins.
      if (missions.current() && missions.current().id === 'lose-the-heat' && missions.state.objective === 0 && !missions.state.heatSet) {
        police.setWanted(Math.max(3, police.stars()));
        missions.state.heatSet = true;
      }
      if (missions.current() && missions.current().id !== 'lose-the-heat') missions.state.heatSet = false;
    }

    if (combat.state.health <= 0) {
      state.wastedCount += 1;
      combat.reset();
      police.reset();
      player.x = 480; player.y = 320;
      if (player.inCar) { player.inCar = false; player.car = null; }
      if (missions.current()) missions.start(missions.state.index);
      state.banner = 'Wasted! You wake up at the Marina, $100 lighter.';
      state.bannerTimer = 4;
      state.cash = Math.max(0, state.cash - 100);
      return events | EVENT_WASTED;
    }

    // Particles and skids age.
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = skids.length - 1; i >= 0; i -= 1) {
      skids[i].life -= dt;
      if (skids[i].life <= 0) skids.splice(i, 1);
    }

    // Camera follows the player, smoothed.
    const tx = Math.max(VIEW.width / 2, Math.min(CITY.width - VIEW.width / 2, player.x));
    const ty = Math.max(VIEW.height / 2, Math.min(CITY.height - VIEW.height / 2, player.y));
    camera.x += (tx - camera.x) * Math.min(1, dt * 5);
    camera.y += (ty - camera.y) * Math.min(1, dt * 5);
    return events;
  }

  reset();
  return {
    state, player, camera, city, traffic, police, combat, missions, coins, particles, skids,
    reset, step, districtAt: () => districtAt(player.x, player.y),
  };
}
