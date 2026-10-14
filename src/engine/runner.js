// Ejecuta el motor en un proceso (servidor o modo local del artefacto):
// guarda el estado, programa los TICK del temporizador y las jugadas de bots.

import { dispatch, botActions } from './turnManager.js';

export function createRunner({ state: initial, onChange = () => {}, now = () => Date.now(), rand = Math.random } = {}) {
  let state = initial;
  let timerHandle = null;
  const botTimers = new Map();
  let stopped = false;

  function armTimer() {
    clearTimeout(timerHandle);
    timerHandle = null;
    if (stopped || !state.timer) return;
    const { seq, at } = state.timer;
    timerHandle = setTimeout(() => {
      if (state.timer && state.timer.seq === seq) run({ type: 'TICK', seq });
    }, Math.max(0, at - now()) + 10);
  }

  function armBots() {
    if (stopped) return;
    for (const b of botActions(state, rand)) {
      if (botTimers.has(b.key)) continue;
      const handle = setTimeout(() => {
        const res = run(b.action);
        // si falló (p. ej. pausa) se libera la llave para reintentar después
        if (!res.ok) botTimers.delete(b.key);
        else botTimers.set(b.key, 'done');
      }, b.delayMs);
      botTimers.set(b.key, handle);
    }
    if (botTimers.size > 400) {
      for (const [k, v] of botTimers) if (v === 'done') botTimers.delete(k);
    }
  }

  function changed() {
    armTimer();
    armBots();
    onChange(state);
  }

  function run(action) {
    if (stopped) return { ok: false, error: 'detenido' };
    const res = dispatch(state, action, { now: now() });
    if (res.ok) {
      state = res.state;
      changed();
    }
    return res;
  }

  return {
    dispatch: run,
    getState: () => state,
    replaceState(next) {
      for (const h of botTimers.values()) if (h !== 'done') clearTimeout(h);
      botTimers.clear();
      state = next;
      changed();
    },
    /** Reprograma temporizadores (p. ej. después de cargar de disco). */
    resume() {
      changed();
    },
    stop() {
      stopped = true;
      clearTimeout(timerHandle);
      for (const h of botTimers.values()) if (h !== 'done') clearTimeout(h);
      botTimers.clear();
    },
  };
}
