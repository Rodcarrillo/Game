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

/**
 * Da `n` shots a un jugador. El "Vaso de agua" lo salva y "Pasa el shot" se lo
 * manda a un rival al azar (un rebote como máximo). Devuelve shots aplicados.
 */
export function giveShot(s, playerId, n, reason, rng, { bounce = true } = {}) {
  if (!s.config.shotsEnabled || n <= 0) return 0;
  const p = s.players[playerId];
  if (!p) return 0;
  let applied = 0;
  for (let i = 0; i < n; i++) {
    const w = p.items.indexOf('water');
    if (w >= 0) {
      p.items.splice(w, 1);
      pushEvent(s, { type: 'shot-saved', playerId, reason: 'Vaso de agua' });
      continue;
    }
    const k = p.items.indexOf('pass');
    if (bounce && k >= 0 && rng) {
      p.items.splice(k, 1);
      const to = rng.pick(s.order.filter((id) => id !== playerId));
      pushEvent(s, { type: 'shot-pass', playerId, to });
      giveShot(s, to, 1, `${p.name} le pasó su shot`, rng, { bounce: false });
      continue;
    }
    if (s.config.shotLimit && p.shots >= s.config.shotLimit) {
      pushEvent(s, { type: 'shot-saved', playerId, reason: 'Llegó al límite: le toca agua' });
      continue;
    }
    p.shots += 1;
    applied += 1;
  }
  if (applied) {
    pushEvent(s, { type: 'shot', playerId, n: applied, reason });
    log(s, `${p.name}: ${applied} ${s.config.shotWord}${applied > 1 ? 's' : ''} (${reason})`);
  }
  return applied;
}
