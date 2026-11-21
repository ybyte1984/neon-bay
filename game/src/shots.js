// Screenshot scenes behind ?shot=start|foot|chase|mission. Each one plays
// the real rules forward from a fresh world with a fixed seed, steered by a
// simple autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame. Driving scenes run along a
// straight street, the way a player actually drives, so the car does not
// cut across buildings.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Steer the player on foot toward a target point. */
function steerTo(world, tx, ty) {
  const p = world.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { mx: dx / len, my: dy / len, run: true, enter: false, punch: false };
}

/** Drive straight along a street: full throttle, no steering. */
function driveStraight() {
  return { mx: 0, my: 0, run: false, enter: false, punch: false, throttle: 1, steer: 0 };
}

function stepWorld(world, seconds, inputFn) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, inputFn());
}

/** Put the player in a car parked on a street, facing east. */
function putInCar(world, x, y) {
  const car = world.traffic.cars.find((c) => c.kind === 'parked');
  car.x = x; car.y = y; car.angle = 0; car.speed = 0;
  world.player.x = x; world.player.y = y;
  world.step(STEP, { mx: 0, my: 0, run: false, enter: true, punch: false });
  world.combat.addArmor(100);
  world.combat.heal(100);
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'foot') {
    // Walk through Old Town toward Rico's pier, with traffic and peds around.
    world.player.x = 900; world.player.y = 480;
    world.camera.x = world.player.x; world.camera.y = world.player.y;
    stepWorld(world, 6, () => steerTo(world, 480, 200));
    return { screen: SCREEN_PLAY, best: world.state.cash };
  }
  if (name === 'chase') {
    // Steal a car on the Marina street, get 3 stars, and run east from
    // police cars that spawn behind the player.
    putInCar(world, 500, 480);
    world.police.setWanted(3);
    stepWorld(world, 3.5, driveStraight);
    return { screen: SCREEN_PLAY, best: world.state.cash };
  }
  if (name === 'mission') {
    // Mission 2 in progress: drive east along the Old Town street toward
    // the first package, with the timer and wanted stars on the HUD.
    world.missions.start(1);
    putInCar(world, 1200, 480);
    stepWorld(world, 1.5, driveStraight);
    return { screen: SCREEN_PLAY, best: world.state.cash };
  }
  // start (default): the title screen over a living city.
  stepWorld(world, 4, () => ({ mx: 0, my: 0, run: false, enter: false, punch: false }));
  return { screen: SCREEN_TITLE, best: 0 };
}
