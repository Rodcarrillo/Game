// Única vía para mover Perritas y Pemolares. Registra un evento por cambio para
// que la TV y los celulares animen el saldo.

const MAX_EVENTS = 60;

export function pushEvent(s, ev) {
  s.eventSeq = (s.eventSeq || 0) + 1;
  s.events.push({ id: s.eventSeq, ...ev });
  if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
}

export function log(s, text) {
  s.log.push(text);
  if (s.log.length > 30) s.log.splice(0, s.log.length - 30);
}

/**
 * Cambia Pemolares. Devuelve el delta real aplicado (puede ser menor si no
 * se permiten saldos negativos o si un escudo bloqueó la pérdida).
 */
export function changePemolares(s, playerId, delta, reason, { blockable = false } = {}) {
  const p = s.players[playerId];
  if (!p || !delta) return 0;
  if (delta < 0 && blockable && p.shield) {
    p.shield = false;
    pushEvent(s, { type: 'shield', playerId, reason: 'Escudo usado' });
    return 0;
  }
  let applied = delta;
  if (delta < 0 && !s.config.allowNegativePemolares) applied = -Math.min(p.pemolares, -delta);
  if (!applied) return 0;
  p.pemolares += applied;
  if (applied > 0) p.stats.pemolaresEarned += applied;
  pushEvent(s, { type: 'currency', currency: 'pemolares', playerId, delta: applied, reason });
  return applied;
}

export function changePerritas(s, playerId, delta, reason) {
  const p = s.players[playerId];
  if (!p || !delta) return 0;
  const applied = delta < 0 ? -Math.min(p.perritas, -delta) : delta;
  if (!applied) return 0;
  p.perritas += applied;
  pushEvent(s, { type: 'currency', currency: 'perritas', playerId, delta: applied, reason });
  return applied;
}

/** Transfiere Pemolares de un jugador a otro sin crear ni destruir moneda. */
export function transferPemolares(s, fromId, toId, amount, reason) {
  const from = s.players[fromId];
  if (!from || amount <= 0) return 0;
  const real = Math.min(amount, Math.max(0, from.pemolares));
  if (!real) return 0;
  changePemolares(s, fromId, -real, reason);
  changePemolares(s, toId, real, reason);
  return real;
}
