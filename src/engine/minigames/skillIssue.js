// SKILL ISSUE — detén el reloj lo más cerca posible del objetivo.
// El reloj sólo se ve el primer segundo y medio; después, a ciegas.
// El servidor mide el tiempo con su propio reloj (no confía en el celular).

const READY_MS = 3200;
const REVEAL_MS = 4500;
const GRACE_MS = 3000;

function toReveal(d) {
  const results = {};
  for (const pid of d.participants) {
    const t = d.stops[pid];
    results[pid] = t == null ? { t: null, diff: null } : { t, diff: Math.abs(t - d.target * 1000) };
  }
  d.results = results;
  d.step = 'reveal';
  d.wantTimerMs = REVEAL_MS;
}

export default {
  id: 'skill-issue',
  name: 'SKILL ISSUE',
  tagline: 'Detén el reloj… a ciegas.',
  instructions: 'Aparece un tiempo objetivo. Cuando arranque el reloj, presiona ALTO lo más cerca posible. ¡El reloj desaparece al segundo y medio!',
  implemented: true,
  minPlayers: 2,
  controls: [{ key: 'stop', label: '¡ALTO! ✋' }],

  init({ participants, rng }) {
    return {
      step: 'ready',
      participants: participants.slice(),
      target: rng.int(30, 70) / 10,
      startedAt: null,
      stops: {},
      results: null,
      done: false,
      wantTimerMs: READY_MS,
    };
  },

  input(d, playerId, payload, { now }) {
    if (d.step !== 'run' || payload?.action !== 'stop') return false;
    if (d.stops[playerId] != null) return false;
    d.stops[playerId] = now - d.startedAt;
    if (Object.keys(d.stops).length >= d.participants.length) toReveal(d);
    return true;
  },

  tick(d, { now }) {
    if (d.step === 'ready') {
      d.step = 'run';
      d.startedAt = now;
      d.wantTimerMs = d.target * 1000 + GRACE_MS;
      return;
    }
    if (d.step === 'run') return toReveal(d);
    if (d.step === 'reveal') d.done = true;
  },

  isDone: (d) => d.done,
  scores(d) {
    const out = {};
    for (const pid of d.participants) {
      const t = d.stops[pid];
      out[pid] = t == null ? -1e9 : -Math.abs(t - d.target * 1000);
    }
    return out;
  },
  scoreLabel(d, pid) {
    const t = d.stops[pid];
    if (t == null) return 'No se detuvo';
    const diff = (t - d.target * 1000) / 1000;
    return `${(t / 1000).toFixed(2)} s (${diff >= 0 ? '+' : ''}${diff.toFixed(2)})`;
  },

  publicView(d) {
    return {
      step: d.step,
      target: d.target,
      visibleMs: 1500,
      stopped: Object.keys(d.stops),
      results: d.step === 'reveal' ? d.results : null,
    };
  },

  privateView(d, playerId) {
    return { stopped: d.stops[playerId] != null };
  },

  bot(d, playerId, rand) {
    if (d.step !== 'run' || d.stops[playerId] != null) return null;
    const noise = (rand() - 0.5) * 1100;
    return { key: 'run', payload: { action: 'stop' }, delayMs: Math.max(200, d.target * 1000 + noise) };
  },
};
