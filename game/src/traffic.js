// Traffic cars and pedestrians: they wander the city on their own, follow
// the streets, and give the world something to hit, steal and dodge.
import { CAR, PED } from './config.js';
import { STREET_X, STREET_Y, randomRoadPoint, randomSidewalkPoint, resolveBuilding, clampToCity, onRoad } from './city.js';

function nearest(list, v) { return list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)); }

export const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8e8e8', '#2f2f38', '#e8a13d', '#4f9e5f', '#8a5fd0', '#c0c8d0'];
export const PED_COLORS = ['#e8e8e8', '#f5c518', '#7fd0e8', '#e89ac0', '#a8e8a0', '#d0a0e8'];

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function makeCar(x, y, angle, color, kind) {
  return { x, y, angle, speed: 0, color, kind: kind || 'traffic', targetSpeed: 120 + Math.random() * 60, turn: 0, stuck: 0 };
}

export function makePed(x, y, color) {
  return { x, y, angle: Math.random() * Math.PI * 2, color, speed: PED.speed, wander: 0, scared: 0 };
}

export function createTraffic(random, city) {
  const cars = [];
  const peds = [];
  function spawnCars(n) {
    for (let i = 0; i < n; i += 1) {
      const p = randomRoadPoint(random);
      // Align the car's heading with the street it spawned on: vertical
      // streets run north-south, horizontal streets east-west.
      const onVertical = STREET_X.some((s) => Math.abs(s - p.x) < 5);
      const angle = onVertical ? Math.PI / 2 : 0;
      cars.push(makeCar(p.x, p.y, angle + (random() < 0.5 ? 0 : Math.PI), CAR_COLORS[Math.floor(random() * CAR_COLORS.length)], 'traffic'));
    }
  }
  function spawnPeds(n) {
    for (let i = 0; i < n; i += 1) {
      const p = randomSidewalkPoint(random);
      peds.push(makePed(p.x, p.y, PED_COLORS[Math.floor(random() * PED_COLORS.length)]));
    }
  }
  function reset() {
    cars.length = 0;
    peds.length = 0;
    spawnCars(14);
    spawnPeds(18);
    // Parked cars the player can steal, near the start.
    cars.push(makeCar(560, 420, 0, '#d94f3d', 'parked'));
    cars.push(makeCar(880, 180, Math.PI / 2, '#3d7bd9', 'parked'));
    cars.push(makeCar(1440, 1120, 0, '#e8a13d', 'parked'));
    cars.push(makeCar(1760, 1440, Math.PI / 2, '#4f9e5f', 'parked'));
    cars.push(makeCar(1120, 1760, 0, '#f5c518', 'taxi'));
  }
  /** Traffic drives along streets, turning at intersections; parked cars stay put. */
  function stepCars(dt, playerCar) {
    for (const car of cars) {
      if (car.kind === 'parked' || car === playerCar) continue;
      // Steer toward the nearest street axis, keeping the current heading
      // (east, west, north or south) rather than turning back on itself.
      const ax = Math.abs(Math.cos(car.angle));
      const ay = Math.abs(Math.sin(car.angle));
      const target = ax >= ay ? (Math.cos(car.angle) >= 0 ? 0 : Math.PI) : (Math.sin(car.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2);
      const diff = angleDiff(car.angle, target);
      car.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      // Turns only at intersections, and the car snaps back to the street
      // centreline on its new axis, so a turn never leaves it driving
      // across a block or through a building.
      const atCross = Math.abs(car.x - nearest(STREET_X, car.x)) < 40 && Math.abs(car.y - nearest(STREET_Y, car.y)) < 40;
      if (Math.abs(diff) < 0.15 && atCross && Math.random() < dt * 0.12) {
        car.angle += (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      }
      if (Math.abs(Math.sin(car.angle)) > 0.5) car.x = nearest(STREET_X, car.x);
      else car.y = nearest(STREET_Y, car.y);
      car.speed += (car.targetSpeed - car.speed) * Math.min(1, dt * 1.5);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      clampToCity(car, 40);
      // Wrap around the city edge instead of piling up in a corner.
      if (car.x <= 40 || car.x >= 2520 || car.y <= 40 || car.y >= 1880) {
        const p = randomRoadPoint(Math.random);
        car.x = p.x; car.y = p.y;
        const onVertical = STREET_X.some((s) => Math.abs(s - p.x) < 5);
        car.angle = onVertical ? Math.PI / 2 : 0;
        car.speed = car.targetSpeed;
      }
    }
  }
  function stepPeds(dt, player, playerPos) {
    for (const ped of peds) {
      ped.wander -= dt;
      const dx = playerPos.x - ped.x;
      const dy = playerPos.y - ped.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 160) {
        // Flee from a speeding player or a car.
        ped.scared = 1.5;
        ped.angle = Math.atan2(-dy, -dx);
      } else if (ped.wander <= 0) {
        ped.wander = 2 + Math.random() * 3;
        ped.angle += (Math.random() - 0.5) * 2.2;
      }
      const speed = ped.scared > 0 ? PED.speed * 2.1 : PED.speed;
      if (ped.scared > 0) ped.scared -= dt;
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
      clampToCity(ped, 16);
      resolveBuilding(city, ped, PED.radius);
    }
  }
  reset();
  return { cars, peds, reset, stepCars, stepPeds, spawnCars, spawnPeds };
}
