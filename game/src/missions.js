// Neon Bay story: four chained missions, plus side work. A mission is a
// small state machine: an ordered list of objectives, each with a target
// point, a radius and a line of HUD text. The world calls advance() when the
// player reaches a target or when a timed objective expires.
export const MISSIONS = [
  {
    id: 'meet-rico',
    title: '1 · Meet Rico',
    intro: 'Rico is waiting by the Marina pier. Go and meet him — on foot is fine.',
    objectives: [
      { text: 'Meet Rico at the Marina pier', x: 480, y: 200, r: 70 },
      { text: 'Drive Rico to the Harbor drop-off (take a car!)', x: 2080, y: 1120, r: 80, needCar: true },
    ],
    reward: 300,
  },
  {
    id: 'package-run',
    title: '2 · Package Run',
    intro: 'Three packages, ninety seconds. Pick them all up, then get to the Uptown safehouse.',
    objectives: [
      { text: 'Pick up package 1/3 — Old Town', x: 1760, y: 480, r: 60, timer: 90 },
      { text: 'Pick up package 2/3 — Uptown', x: 800, y: 800, r: 60 },
      { text: 'Pick up package 3/3 — Harbor', x: 2080, y: 800, r: 60 },
      { text: 'Deliver the packages to the Uptown safehouse', x: 480, y: 800, r: 80 },
    ],
    reward: 500,
  },
  {
    id: 'lose-the-heat',
    title: '3 · Lose the Heat',
    intro: 'The cops saw the packages. Lose them — break line of sight and stay quiet for a while.',
    objectives: [
      { text: 'Lose the cops: get your wanted level to zero', x: 0, y: 0, r: 0, loseWanted: true },
    ],
    reward: 400,
  },
  {
    id: 'bay-getaway',
    title: '4 · Bay Getaway',
    intro: 'One last job. Grab the Harbor cash, then cross the bridge to South Beach. Do not stop.',
    objectives: [
      { text: 'Grab the cash at the Harbor warehouse', x: 2080, y: 960, r: 70 },
      { text: 'Escape across the bridge to South Beach', x: 1280, y: 1760, r: 90, needCar: true },
    ],
    reward: 1000,
  },
];

export function createMissions() {
  const state = { index: 0, objective: 0, timer: 0, done: false, storyComplete: false };
  function current() {
    return state.index < MISSIONS.length ? MISSIONS[state.index] : null;
  }
  function objective() {
    const m = current();
    return m ? m.objectives[state.objective] : null;
  }
  function objectiveText() {
    const m = current();
    if (!m) return state.storyComplete ? 'Story complete — Neon Bay is yours. Free roam!' : '';
    const o = objective();
    return o ? o.text : '';
  }
  function start(index) {
    state.index = index;
    state.objective = 0;
    state.done = false;
    const o = objective();
    state.timer = o && o.timer ? o.timer : 0;
  }
  /** Move to the next objective; returns 'mission' when a mission ends, 'story' at the last. */
  function advance() {
    const m = current();
    if (!m) return null;
    state.objective += 1;
    if (state.objective >= m.objectives.length) {
      const reward = m.reward;
      state.index += 1;
      state.objective = 0;
      if (state.index >= MISSIONS.length) {
        state.storyComplete = true;
        return { type: 'story', reward };
      }
      const next = objective();
      state.timer = next && next.timer ? next.timer : 0;
      return { type: 'mission', reward };
    }
    const o = objective();
    state.timer = o && o.timer ? o.timer : 0;
    return { type: 'objective' };
  }
  function reset() {
    state.index = 0;
    state.objective = 0;
    state.timer = 0;
    state.done = false;
    state.storyComplete = false;
  }
  return { state, current, objective, objectiveText, start, advance, reset };
}
