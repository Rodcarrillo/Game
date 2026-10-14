// TurnManager: máquina de estados autoritativa del tablero.
//
//   LOBBY → BOARD_INTRO → TURN_START → DICE_ROLL → MOVEMENT
//        ↘ (ROUTE_CHOICE | SHOP)* → TILE_RESOLUTION → siguiente turno
//   … → MINIGAME_INTRO → MINIGAME_PLAYING → MINIGAME_RESULTS → siguiente turno
//   … → BOARD_END → FINAL_BONUSES → FINAL_LEADERBOARD → WINNER_REVEAL
//
// `dispatch(state, action, {now})` es puro: clona el estado, valida la acción
// y devuelve { ok, state, error }. Nunca confía en datos del cliente: el dado,
// las recompensas y las compras se calculan aquí.
//
// Los tiempos se modelan con `state.timer = {at, seq}`. Quien ejecuta el motor
// (servidor o modo local) programa un TICK con ese `seq`; un TICK con otro seq
// se ignora, lo que hace idempotentes los avances.

import { normalizeConfig } from './config.js';
import { buildBoard } from './board.js';
import { makeRng, seedFrom } from './rng.js';
import { resolveTile } from './tileEffects.js';
import { changePemolares, changePerritas, pushEvent, log } from './wallet.js';
import { MINIGAMES, eligibleMinigames } from './minigames/index.js';

export const PHASES = [
  'LOBBY', 'BOARD_INTRO', 'TURN_START', 'DICE_ROLL', 'MOVEMENT', 'ROUTE_CHOICE', 'SHOP',
  'TILE_RESOLUTION', 'MINIGAME_INTRO', 'MINIGAME_PLAYING', 'MINIGAME_RESULTS',
  'BOARD_END', 'FINAL_BONUSES', 'FINAL_LEADERBOARD', 'WINNER_REVEAL',
];

// Tiempos de presentación (ms). La TV usa los mismos valores para animar.
export const TIMING = {
  intro: 3500,
  turnStart: 1600,
  diceSpin: 1400,
  step: 300,
  afterMove: 450,
  tileResult: 2800,
  shopDone: 1600,
  minigameIntro: 5500,
  minigameResults: 6000,
  boardEnd: 3000,
  perBonus: 2600,
  leaderboard: 6000,
  routeTimeout: 20000,
  shopTimeout: 15000,
};

export const MAX_PLAYERS = 8;
export const MAX_PER_VISIT = 3; // Perritas que se pueden comprar en una sola visita
export const PLAYER_COLORS = ['#ff6b4a', '#3d8bff', '#ffc531', '#2ecc8f', '#b06bff', '#ff5fae', '#22c7d6', '#8a5a3c'];
export const HATS = ['corona', 'gorra', 'moño', 'antena', 'cuernos', 'flor', 'chef', 'casco'];

const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

// ---------------------------------------------------------------------------
// Creación
// ---------------------------------------------------------------------------

export function createGame({ config = {}, seed = Date.now(), now = Date.now() } = {}) {
  return {
    version: 1,
    seq: 0,
    phase: 'LOBBY',
    paused: false,
    pausedTimer: null,
    config: normalizeConfig(config, Object.keys(MINIGAMES)),
    board: null,
    players: {},
    order: [],
    round: 0,
    turnIndex: 0,
    roundClosing: false,
    pending: null,
    move: null,
    anim: null,
    animSeq: 0,
    lastRoll: null,
    lastTile: null,
    minigame: null,
    minigameSeq: 0,
    lastMinigameId: null,
    queue: [],
    timer: null,
    timerSeq: 0,
    events: [],
    eventSeq: 0,
    log: [],
    final: null,
    rngState: seedFrom(seed),
    createdAt: now,
  };
}

function newPlayer(input, index, config) {
  const name = String(input.name || `Jugador ${index + 1}`).trim().slice(0, 16) || `Jugador ${index + 1}`;
  return {
    id: String(input.id),
    name,
    color: PLAYER_COLORS.includes(input.color) ? input.color : PLAYER_COLORS[index % PLAYER_COLORS.length],
    hat: HATS.includes(input.hat) ? input.hat : HATS[index % HATS.length],
    isBot: !!input.isBot,
    connected: input.isBot ? true : input.connected !== false,
    pemolares: config.startingPemolares,
    perritas: config.startingPerritas,
    tileId: null,
    shield: false,
    stats: {
      minigameWins: 0,
      minigamePoints: 0,
      pemolaresEarned: 0,
      tilesWalked: 0,
      chaosHits: 0,
      minusHits: 0,
      perritasBought: 0,
      pemolaresSpent: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------

function setTimer(s, ms, reason, now) {
  s.timerSeq += 1;
  s.timer = { at: now + Math.max(0, Math.round(ms)), seq: s.timerSeq, reason };
}

function setDecisionTimer(s, ms, now) {
  if (ms > 0) setTimer(s, ms, 'timeout', now);
  else s.timer = null;
}

const currentPlayerId = (s) => s.order[s.turnIndex];

function rngOf(s) {
  return makeRng(s);
}

function api(s) {
  return {
    rng: rngOf(s),
    board: s.board,
    hasMinigames: () => eligibleMinigames(s.config, 2).length > 0,
  };
}

// ---------------------------------------------------------------------------
// Flujo de la partida
// ---------------------------------------------------------------------------

function startGame(s, now) {
  s.board = buildBoard(s.config);
  for (const id of s.order) {
    const p = s.players[id];
    p.tileId = s.board.startId;
    p.pemolares = s.config.startingPemolares;
    p.perritas = s.config.startingPerritas;
  }
  s.round = 1;
  s.turnIndex = 0;
  s.phase = 'BOARD_INTRO';
  log(s, '¡Comienza la partida!');
  setTimer(s, TIMING.intro, 'intro', now);
}

function beginTurn(s, now) {
  s.phase = 'TURN_START';
  s.pending = null;
  s.move = null;
  s.lastTile = null;
  setTimer(s, TIMING.turnStart, 'turn-start', now);
}

function openRoll(s, now) {
  s.phase = 'DICE_ROLL';
  const pid = currentPlayerId(s);
  s.pending = { kind: 'roll', playerId: pid, token: `r${s.seq}` };
  setDecisionTimer(s, s.config.turnTimeoutSec * 1000, now);
}

function doRoll(s, now) {
  const pid = currentPlayerId(s);
  const value = rngOf(s).int(s.config.diceMin, s.config.diceMax);
  s.lastRoll = { playerId: pid, value, id: s.seq };
  s.pending = null;
  s.move = { playerId: pid, stepsLeft: value, total: value, forced: null };
  log(s, `${s.players[pid].name} sacó ${value}`);
  walk(s, now, TIMING.diceSpin);
}

/**
 * Avanza casilla por casilla. Se detiene en bifurcaciones (ROUTE_CHOICE) y al
 * pasar por una tienda (SHOP). Prepara la animación correspondiente.
 */
function walk(s, now, delay = 0) {
  const m = s.move;
  const p = s.players[m.playerId];
  const path = [];
  m.stop = null;
  while (m.stepsLeft > 0) {
    const tile = s.board.tiles[p.tileId];
    let nextId;
    if (m.forced) {
      nextId = m.forced;
      m.forced = null;
    } else if (tile.next.length > 1) {
      m.stop = 'route';
      break;
    } else {
      nextId = tile.next[0];
    }
    p.tileId = nextId;
    path.push(nextId);
    m.stepsLeft -= 1;
    p.stats.tilesWalked += 1;
    const t = s.board.tiles[nextId];
    if (t.type === 'start' && s.config.passStartBonus) {
      changePemolares(s, p.id, s.config.passStartBonus, 'Pasaste por la salida');
    }
    if (t.type === 'shop' && m.stepsLeft > 0) {
      m.stop = 'shop';
      break;
    }
  }
  if (!m.stop && m.stepsLeft === 0) {
    m.stop = s.board.tiles[p.tileId].type === 'shop' ? 'shop' : 'land';
  }
  s.animSeq += 1;
  s.anim = { id: s.animSeq, playerId: p.id, path, delay, stepMs: TIMING.step };
  s.phase = 'MOVEMENT';
  setTimer(s, delay + path.length * TIMING.step + TIMING.afterMove, 'move', now);
}

function afterMovement(s, now) {
  const m = s.move;
  const p = s.players[m.playerId];
  if (m.stop === 'route') {
    const tile = s.board.tiles[p.tileId];
    s.phase = 'ROUTE_CHOICE';
    s.pending = {
      kind: 'route',
      playerId: p.id,
      token: `c${s.seq}`,
      stepsLeft: m.stepsLeft,
      options: (tile.routes || tile.next.map((to) => ({ to, label: to, risk: '' }))).map((r) => ({ ...r })),
    };
    setDecisionTimer(s, Math.min(TIMING.routeTimeout, s.config.turnTimeoutSec * 1000 || TIMING.routeTimeout), now);
    return;
  }
  if (m.stop === 'shop') {
    s.phase = 'SHOP';
    s.pending = {
      kind: 'shop',
      playerId: p.id,
      token: `s${s.seq}`,
      price: s.config.perritaPrice,
      balance: p.pemolares,
      canBuy: p.pemolares >= s.config.perritaPrice,
      maxQty: Math.min(MAX_PER_VISIT, Math.floor(p.pemolares / s.config.perritaPrice)),
      passing: m.stepsLeft > 0,
      done: null,
    };
    setDecisionTimer(s, Math.min(TIMING.shopTimeout, s.config.turnTimeoutSec * 1000 || TIMING.shopTimeout), now);
    return;
  }
  resolveLanding(s, now);
}

function resolveLanding(s, now) {
  const pid = s.move.playerId;
  const p = s.players[pid];
  const tile = s.board.tiles[p.tileId];
  s.phase = 'TILE_RESOLUTION';
  s.pending = null;
  const res = resolveTile(s, pid, tile, api(s));
  s.lastTile = { playerId: pid, tileId: tile.id, tileType: tile.type, ...res };
  if (res.warpTo) {
    s.animSeq += 1;
    s.anim = { id: s.animSeq, playerId: pid, path: [res.warpTo], delay: 900, stepMs: 900, warp: true };
  }
  if (res.minigame) s.queue.push({ source: 'tile', participants: res.minigame.participants });
  setTimer(s, TIMING.tileResult + (res.warpTo ? 1200 : 0), 'tile', now);
}

function finishShop(s, now) {
  const m = s.move;
  if (m.stepsLeft > 0) return walk(s, now, 0);
  // cayó justo en la tienda: no hay otro efecto, termina el turno
  s.lastTile = { playerId: m.playerId, tileId: s.players[m.playerId].tileId, tileType: 'shop', title: 'Tienda de Perritas', text: '', tone: 'neutral' };
  afterTurn(s, now);
}

function afterTurn(s, now) {
  if (s.queue.length) return startMinigame(s, s.queue.shift(), now);
  if (!s.roundClosing) {
    s.turnIndex += 1;
    if (s.turnIndex < s.order.length) return beginTurn(s, now);
    s.roundClosing = true;
    const N = s.config.minigameEveryNRounds;
    if (N > 0 && s.round % N === 0 && eligibleMinigames(s.config, s.order.length).length) {
      return startMinigame(s, { source: 'round', participants: s.order.slice() }, now);
    }
  }
  s.roundClosing = false;
  s.turnIndex = 0;
  if (s.round >= s.config.totalRounds) return endBoard(s, now);
  s.round += 1;
  log(s, `Ronda ${s.round} de ${s.config.totalRounds}`);
  beginTurn(s, now);
}

// ---------------------------------------------------------------------------
// Minijuegos
// ---------------------------------------------------------------------------

function startMinigame(s, { source, participants }, now) {
  const options = eligibleMinigames(s.config, participants.length);
  if (!options.length) {
    // Sin minijuegos habilitados: compensación pequeña y seguimos.
    for (const id of participants) changePemolares(s, id, s.config.minigameRewards.participation, 'Minijuego (sin modos activos)');
    return afterTurn(s, now);
  }
  const rng = rngOf(s);
  const pool = options.length > 1 ? options.filter((g) => g.id !== s.lastMinigameId) : options;
  const game = rng.pick(pool);
  s.minigameSeq += 1;
  s.lastMinigameId = game.id;
  s.minigame = {
    key: s.minigameSeq,
    gameId: game.id,
    name: game.name,
    tagline: game.tagline,
    instructions: game.instructions,
    controls: game.controls,
    source,
    participants: participants.slice(),
    data: null,
    results: null,
  };
  s.phase = 'MINIGAME_INTRO';
  s.pending = null;
  log(s, `Minijuego: ${game.name}`);
  setTimer(s, TIMING.minigameIntro, 'mg-intro', now);
}

function applyMinigameTimer(s, now) {
  const d = s.minigame.data;
  if (d.wantTimerMs != null) {
    setTimer(s, d.wantTimerMs, 'mg', now);
    d.wantTimerMs = null;
  }
}

function finishMinigame(s, now) {
  const mg = s.minigame;
  const game = MINIGAMES[mg.gameId];
  const scores = game.scores(mg.data);
  const ranked = mg.participants.slice().sort((a, b) => scores[b] - scores[a]);
  const R = s.config.minigameRewards;
  const duel = mg.participants.length === 2;
  let place = 0;
  let prev = null;
  const results = ranked.map((pid, i) => {
    if (prev === null || scores[pid] !== prev) place = i + 1;
    prev = scores[pid];
    let reward = R.participation;
    if (place === 1) reward = R.first;
    else if (place === 2 && !duel) reward = R.second;
    return { playerId: pid, place, score: scores[pid], label: game.scoreLabel ? game.scoreLabel(mg.data, pid) : String(scores[pid]), reward };
  });
  for (const r of results) {
    const p = s.players[r.playerId];
    if (r.place === 1) p.stats.minigameWins += 1;
    p.stats.minigamePoints += Math.max(0, Math.round(r.score));
    changePemolares(s, r.playerId, r.reward, `${mg.name} · lugar ${r.place}`);
  }
  mg.results = results;
  s.phase = 'MINIGAME_RESULTS';
  const winners = results.filter((r) => r.place === 1).map((r) => s.players[r.playerId].name);
  log(s, `${mg.name}: gana ${winners.join(' y ')}`);
  setTimer(s, TIMING.minigameResults, 'mg-results', now);
}

// ---------------------------------------------------------------------------
// Final
// ---------------------------------------------------------------------------

function endBoard(s, now) {
  s.phase = 'BOARD_END';
  s.pending = null;
  log(s, '¡Se terminó el tablero!');
  setTimer(s, TIMING.boardEnd, 'board-end', now);
}

const BONUS_DEFS = {
  minigameKing: { title: 'Rey del Minijuego', stat: (p) => p.stats.minigameWins, desc: 'Más minijuegos ganados' },
  richest: { title: 'Bolsillo de Oro', stat: (p) => p.stats.pemolaresEarned, desc: 'Más Pemolares ganados en total' },
  chaosMagnet: { title: 'Imán del Caos', stat: (p) => p.stats.chaosHits, desc: 'Más casillas de caos' },
};

function applyBonuses(s, now) {
  s.phase = 'FINAL_BONUSES';
  const bonuses = [];
  for (const [key, on] of Object.entries(s.config.endBonuses)) {
    if (!on || !BONUS_DEFS[key]) continue;
    const def = BONUS_DEFS[key];
    const best = Math.max(...s.order.map((id) => def.stat(s.players[id])));
    if (best <= 0) continue;
    const winners = s.order.filter((id) => def.stat(s.players[id]) === best);
    for (const id of winners) changePerritas(s, id, 1, def.title);
    bonuses.push({ key, title: def.title, desc: def.desc, value: best, winners });
  }
  s.final = { bonuses, ranking: null, awards: null };
  setTimer(s, TIMING.perBonus * Math.max(1, bonuses.length) + 600, 'bonuses', now);
}

export function computeRanking(s) {
  const tb = s.config.pemolaresTiebreak;
  const sorted = s.order.slice().sort((a, b) => {
    const A = s.players[a];
    const B = s.players[b];
    if (B.perritas !== A.perritas) return B.perritas - A.perritas;
    if (tb && B.pemolares !== A.pemolares) return B.pemolares - A.pemolares;
    return 0;
  });
  let rank = 0;
  let prevKey = null;
  return sorted.map((id, i) => {
    const p = s.players[id];
    const key = tb ? `${p.perritas}|${p.pemolares}` : `${p.perritas}`;
    if (key !== prevKey) rank = i + 1;
    prevKey = key;
    return {
      playerId: id,
      rank,
      perritas: p.perritas,
      pemolares: p.pemolares,
      minigameWins: p.stats.minigameWins,
    };
  });
}

function computeAwards(s) {
  const pick = (title, desc, stat) => {
    const best = Math.max(...s.order.map((id) => stat(s.players[id])));
    if (best <= 0) return null;
    const id = s.order.find((x) => stat(s.players[x]) === best);
    return { title, desc, playerId: id, value: best };
  };
  return [
    pick('Imán de Desgracias', 'Más casillas rojas', (p) => p.stats.minusHits),
    pick('Turista Profesional', 'Más casillas recorridas', (p) => p.stats.tilesWalked),
    pick('Comprador Compulsivo', 'Más Pemolares gastados', (p) => p.stats.pemolaresSpent),
    pick('Cerebro Galáctico', 'Más puntos en minijuegos', (p) => p.stats.minigamePoints),
  ].filter(Boolean);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const HOST_ACTIONS = new Set(['ADD_PLAYER', 'REMOVE_PLAYER', 'UPDATE_CONFIG', 'START', 'PAUSE', 'RESUME', 'RESET']);
export const isHostAction = (type) => HOST_ACTIONS.has(type);

export function dispatch(prev, action, ctx = {}) {
  const now = ctx.now ?? Date.now();
  const s = clone(prev);
  const fail = (error) => ({ ok: false, state: prev, error });
  const type = action?.type;

  if (s.paused && !['RESUME', 'SET_CONNECTED', 'PAUSE'].includes(type)) return fail('Juego en pausa');

  switch (type) {
    case 'ADD_PLAYER': {
      if (s.phase !== 'LOBBY') return fail('La partida ya empezó');
      if (s.order.length >= MAX_PLAYERS) return fail('Sala llena');
      const id = String(action.player?.id || '');
      if (!id || s.players[id]) return fail('Jugador inválido');
      const p = newPlayer(action.player, s.order.length, s.config);
      // evita colores repetidos
      const used = new Set(s.order.map((x) => s.players[x].color));
      if (used.has(p.color)) p.color = PLAYER_COLORS.find((c) => !used.has(c)) || p.color;
      const usedHats = new Set(s.order.map((x) => s.players[x].hat));
      if (usedHats.has(p.hat)) p.hat = HATS.find((h) => !usedHats.has(h)) || p.hat;
      s.players[id] = p;
      s.order.push(id);
      break;
    }
    case 'UPDATE_PLAYER': {
      if (s.phase !== 'LOBBY') return fail('La partida ya empezó');
      const p = s.players[action.playerId];
      if (!p) return fail('No existe');
      if (action.name) p.name = String(action.name).trim().slice(0, 16) || p.name;
      if (PLAYER_COLORS.includes(action.color) && !s.order.some((x) => x !== p.id && s.players[x].color === action.color)) p.color = action.color;
      if (HATS.includes(action.hat)) p.hat = action.hat;
      break;
    }
    case 'REMOVE_PLAYER': {
      if (s.phase !== 'LOBBY') return fail('La partida ya empezó');
      if (!s.players[action.playerId]) return fail('No existe');
      delete s.players[action.playerId];
      s.order = s.order.filter((x) => x !== action.playerId);
      break;
    }
    case 'UPDATE_CONFIG': {
      if (s.phase !== 'LOBBY') return fail('Sólo antes de empezar');
      s.config = normalizeConfig({ ...s.config, ...action.config }, Object.keys(MINIGAMES));
      for (const id of s.order) {
        s.players[id].pemolares = s.config.startingPemolares;
        s.players[id].perritas = s.config.startingPerritas;
      }
      break;
    }
    case 'START': {
      if (s.phase !== 'LOBBY') return fail('Ya empezó');
      if (s.order.length < 2) return fail('Se necesitan al menos 2 jugadores');
      startGame(s, now);
      break;
    }
    case 'PAUSE': {
      if (['LOBBY', 'WINNER_REVEAL'].includes(s.phase) || s.paused) return fail('No se puede pausar');
      s.paused = true;
      s.pausedTimer = s.timer ? { remaining: Math.max(0, s.timer.at - now), reason: s.timer.reason } : null;
      s.timer = null;
      break;
    }
    case 'RESUME': {
      if (!s.paused) return fail('No está en pausa');
      s.paused = false;
      if (s.pausedTimer) {
        // las decisiones recuperan tiempo completo; las animaciones el que les quedaba
        const ms = s.pausedTimer.reason === 'timeout' ? Math.max(s.pausedTimer.remaining, 10000) : s.pausedTimer.remaining;
        setTimer(s, ms, s.pausedTimer.reason, now);
      }
      s.pausedTimer = null;
      break;
    }
    case 'SET_CONNECTED': {
      const p = s.players[action.playerId];
      if (!p) return fail('No existe');
      p.connected = !!action.connected;
      break;
    }
    case 'ROLL': {
      if (s.phase !== 'DICE_ROLL' || s.pending?.kind !== 'roll') return fail('No es momento de tirar');
      if (action.playerId !== s.pending.playerId) return fail('No es tu turno');
      doRoll(s, now);
      break;
    }
    case 'CHOOSE_ROUTE': {
      if (s.phase !== 'ROUTE_CHOICE' || s.pending?.kind !== 'route') return fail('No hay ruta que elegir');
      if (action.playerId !== s.pending.playerId) return fail('No es tu turno');
      if (!s.pending.options.some((o) => o.to === action.to)) return fail('Ruta inválida');
      s.move.forced = action.to;
      s.pending = null;
      walk(s, now, 0);
      break;
    }
    case 'SHOP_BUY':
    case 'SHOP_SKIP': {
      const pend = s.pending;
      if (s.phase !== 'SHOP' || pend?.kind !== 'shop') return fail('La tienda está cerrada');
      if (action.playerId !== pend.playerId) return fail('No es tu turno');
      if (action.token && action.token !== pend.token) return fail('Solicitud vencida');
      if (pend.done) return fail('Ya decidiste'); // idempotente
      const p = s.players[pend.playerId];
      if (type === 'SHOP_BUY') {
        const price = s.config.perritaPrice;
        const qty = Math.max(1, Math.min(MAX_PER_VISIT, Math.floor(Number(action.qty) || 1)));
        const cost = price * qty;
        if (p.pemolares < cost) return fail('No te alcanzan los Pemolares');
        // Operación atómica: ambas mutaciones ocurren en el mismo clon de estado.
        p.pemolares -= cost;
        p.perritas += qty;
        p.stats.perritasBought += qty;
        p.stats.pemolaresSpent += cost;
        pushEvent(s, { type: 'currency', currency: 'pemolares', playerId: p.id, delta: -cost, reason: 'Compra de Perritas' });
        pushEvent(s, { type: 'currency', currency: 'perritas', playerId: p.id, delta: qty, reason: 'Compra de Perritas' });
        log(s, `${p.name} compró ${qty} Perrita${qty > 1 ? 's' : ''}`);
        pend.bought = qty;
        pend.done = 'bought';
      } else {
        pend.done = 'skipped';
      }
      setTimer(s, pend.done === 'bought' ? TIMING.shopDone : 500, 'shop-done', now);
      break;
    }
    case 'MG_INPUT': {
      if (s.phase !== 'MINIGAME_PLAYING') return fail('No hay minijuego activo');
      const mg = s.minigame;
      if (!mg.participants.includes(action.playerId)) return fail('No participas');
      const game = MINIGAMES[mg.gameId];
      const accepted = game.input(mg.data, action.playerId, action.payload, { now });
      if (!accepted) return fail('Entrada no válida');
      if (game.isDone(mg.data)) finishMinigame(s, now);
      else applyMinigameTimer(s, now);
      break;
    }
    case 'TICK': {
      if (!s.timer || action.seq !== s.timer.seq) return fail('Tick vencido');
      if (now + 50 < s.timer.at) return fail('Todavía no');
      const reason = s.timer.reason;
      s.timer = null;
      onTick(s, reason, now);
      break;
    }
    default:
      return fail('Acción desconocida');
  }
  s.seq += 1;
  return { ok: true, state: s };
}

function onTick(s, reason, now) {
  switch (s.phase) {
    case 'BOARD_INTRO':
      return beginTurn(s, now);
    case 'TURN_START':
      return openRoll(s, now);
    case 'DICE_ROLL': // se acabó el tiempo: tiro automático
      return doRoll(s, now);
    case 'MOVEMENT':
      return afterMovement(s, now);
    case 'ROUTE_CHOICE': {
      const to = s.pending.options[0].to;
      s.move.forced = to;
      s.pending = null;
      return walk(s, now, 0);
    }
    case 'SHOP':
      if (!s.pending.done) s.pending.done = 'skipped';
      return finishShop(s, now);
    case 'TILE_RESOLUTION':
      return afterTurn(s, now);
    case 'MINIGAME_INTRO': {
      const mg = s.minigame;
      const game = MINIGAMES[mg.gameId];
      mg.data = game.init({ participants: mg.participants, rng: rngOf(s), now, config: s.config });
      s.phase = 'MINIGAME_PLAYING';
      return applyMinigameTimer(s, now);
    }
    case 'MINIGAME_PLAYING': {
      const game = MINIGAMES[s.minigame.gameId];
      game.tick(s.minigame.data, { now });
      if (game.isDone(s.minigame.data)) return finishMinigame(s, now);
      return applyMinigameTimer(s, now);
    }
    case 'MINIGAME_RESULTS':
      s.minigame = null;
      return afterTurn(s, now);
    case 'BOARD_END':
      return applyBonuses(s, now);
    case 'FINAL_BONUSES':
      s.phase = 'FINAL_LEADERBOARD';
      s.final.ranking = computeRanking(s);
      s.final.awards = computeAwards(s);
      return setTimer(s, TIMING.leaderboard, 'leaderboard', now);
    case 'FINAL_LEADERBOARD':
      s.phase = 'WINNER_REVEAL';
      s.final.winners = s.final.ranking.filter((r) => r.rank === 1).map((r) => r.playerId);
      log(s, `¡Gana ${s.final.winners.map((id) => s.players[id].name).join(' y ')}!`);
      return;
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Vistas: sólo estado público seguro
// ---------------------------------------------------------------------------

export function publicState(s) {
  const { rngState, pausedTimer, ...rest } = s;
  const out = clone(rest);
  if (s.minigame) {
    const game = MINIGAMES[s.minigame.gameId];
    out.minigame.data = undefined;
    out.minigame.view = s.minigame.data ? game.publicView(s.minigame.data) : null;
  }
  out.currentPlayerId = s.phase === 'LOBBY' ? null : currentPlayerId(s);
  return out;
}

export function privateView(s, playerId) {
  const out = { playerId };
  if (s.minigame?.data && s.minigame.participants.includes(playerId)) {
    out.minigame = MINIGAMES[s.minigame.gameId].privateView(s.minigame.data, playerId);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bots: devuelven acciones de jugador (pasan por la misma validación)
// ---------------------------------------------------------------------------

export function botActions(s, rand = Math.random) {
  if (s.paused) return [];
  const out = [];
  const cur = s.players[currentPlayerId(s)];
  const pend = s.pending;
  if (pend && cur?.isBot && pend.playerId === cur.id) {
    if (s.phase === 'DICE_ROLL') out.push({ key: pend.token, delayMs: 1100, action: { type: 'ROLL', playerId: cur.id } });
    if (s.phase === 'ROUTE_CHOICE') {
      const opt = pend.options[Math.floor(rand() * pend.options.length)];
      out.push({ key: pend.token, delayMs: 1500, action: { type: 'CHOOSE_ROUTE', playerId: cur.id, to: opt.to } });
    }
    if (s.phase === 'SHOP' && !pend.done) {
      const buy = pend.canBuy && rand() < 0.9;
      const qty = buy ? Math.max(1, pend.maxQty - (rand() < 0.3 ? 1 : 0)) : 0;
      out.push({ key: pend.token, delayMs: 1500, action: { type: buy ? 'SHOP_BUY' : 'SHOP_SKIP', playerId: cur.id, token: pend.token, qty } });
    }
  }
  if (s.phase === 'MINIGAME_PLAYING' && s.minigame?.data) {
    const game = MINIGAMES[s.minigame.gameId];
    for (const pid of s.minigame.participants) {
      if (!s.players[pid].isBot) continue;
      const b = game.bot(s.minigame.data, pid, rand);
      if (b) out.push({ key: `mg${s.minigame.key}:${b.key}:${pid}`, delayMs: b.delayMs, action: { type: 'MG_INPUT', playerId: pid, payload: b.payload } });
    }
  }
  return out;
}
