// Combat and damage: the player's punch, car rams, and health/armour.
// Damage goes to armour first, then health; health at zero is wasted.
import { PLAYER } from './config.js';

export function createCombat() {
  const state = { health: 100, armor: 0, punchTimer: 0, hurtTimer: 0 };
  function damage(amount) {
    if (state.hurtTimer > 0) return false;
    let left = amount;
    if (state.armor > 0) {
      const absorbed = Math.min(state.armor, left);
      state.armor -= absorbed;
      left -= absorbed;
    }
    state.health = Math.max(0, state.health - left);
    state.hurtTimer = 0.6;
    return true;
  }
  function heal(amount) { state.health = Math.min(100, state.health + amount); }
  function addArmor(amount) { state.armor = Math.min(100, state.armor + amount); }
  /** Punch in the facing direction; returns the peds hit. */
  function punch(player, peds, cops) {
    if (state.punchTimer > 0) return [];
    state.punchTimer = PLAYER.punchCooldown;
    const hit = [];
    const px = player.x + Math.cos(player.angle) * PLAYER.punchRange;
    const py = player.y + Math.sin(player.angle) * PLAYER.punchRange;
    for (const ped of peds) {
      if (Math.hypot(ped.x - px, ped.y - py) < 30) hit.push(ped);
    }
    for (const cop of cops) {
      if (cop.foot && Math.hypot(cop.x - px, cop.y - py) < 30) hit.push(cop);
    }
    return hit;
  }
  function step(dt) {
    if (state.punchTimer > 0) state.punchTimer -= dt;
    if (state.hurtTimer > 0) state.hurtTimer -= dt;
  }
  function reset() { state.health = 100; state.armor = 0; state.punchTimer = 0; state.hurtTimer = 0; }
  return { state, damage, heal, addArmor, punch, step, reset };
}
