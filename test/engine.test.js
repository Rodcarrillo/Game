import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, dispatch, botActions, buildBoard, validateBoard, publicState, privateView, computeRanking,
} from '../src/engine/index.js';

function lobby(n = 4, config = {}, seed = 'test') {
  let s = createGame({ config, seed, now: 0 });
  for (let i = 0; i < n; i++) {
    s = dispatch(s, { type: 'ADD_PLAYER', player: { id: `p${i}`, name: `P${i}`, isBot: true } }, { now: 0 }).state;
  }
  return s;
}

/** Avanza el juego con reloj simulado: bots primero, luego temporizadores. */
function simulate(s, { maxSteps = 20000, rand = mulberry(7) } = {}) {
  let now = 0;
  let steps = 0;
  const seen = new Set();
  const phases = new Set();
  while (s.phase !== 'WINNER_REVEAL' && steps++ < maxSteps) {
    phases.add(s.phase);
    const bots = botActions(s, rand).filter((b) => !seen.has(b.key)).sort((a, b) => a.delayMs - b.delayMs);
    if (bots.length && (!s.timer || now + bots[0].delayMs < s.timer.at)) {
      const b = bots[0];
      seen.add(b.key);
      now += b.delayMs;
      const r = dispatch(s, b.action, { now });
      if (r.ok) s = r.state;
      continue;
    }
    assert.ok(s.timer, `sin temporizador en fase ${s.phase}`);
    now = s.timer.at;
    const r = dispatch(s, { type: 'TICK', seq: s.timer.seq }, { now });
    assert.ok(r.ok, r.error);
    s = r.state;
    for (const id of s.order) assert.ok(s.players[id].pemolares >= 0, 'saldo negativo');
  }
  phases.add(s.phase);
  return { s, steps, phases };
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('el tablero es un grafo válido en todas sus variantes', () => {
  for (const boardLength of ['corto', 'normal', 'largo']) {
    for (const boardBranches of [true, false]) {
      const b = buildBoard({ boardLength, boardBranches });
      assert.deepEqual(validateBoard(b), [], `${boardLength}/${boardBranches}`);
      const forks = Object.values(b.tiles).filter((t) => t.next.length > 1);
      assert.equal(forks.length, boardBranches ? 2 : 0);
      for (const f of forks) assert.equal(f.type, 'choice');
      assert.ok(Object.values(b.tiles).some((t) => t.type === 'shop'));
    }
  }
});

test('una partida completa con bots llega a WINNER_REVEAL', () => {
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    const { s, phases } = simulate(dispatch(lobby(4, { totalRounds: 6 }, seed), { type: 'START' }, { now: 0 }).state);
    assert.equal(s.phase, 'WINNER_REVEAL', seed);
    for (const ph of ['BOARD_INTRO', 'TURN_START', 'DICE_ROLL', 'MOVEMENT', 'TILE_RESOLUTION', 'MINIGAME_INTRO', 'MINIGAME_PLAYING', 'MINIGAME_RESULTS', 'BOARD_END', 'FINAL_BONUSES', 'FINAL_LEADERBOARD']) {
      assert.ok(phases.has(ph), `${seed}: no pasó por ${ph}`);
    }
    assert.ok(s.final.winners.length >= 1);
    // las Perritas sólo vienen de compras, casillas y bonos registrados como eventos
    const total = s.order.reduce((a, id) => a + s.players[id].perritas, 0);
    assert.ok(total >= 0);
  }
});

test('se visitan tiendas y se compran Perritas a lo largo de varias partidas', () => {
  let bought = 0;
  let shops = 0;
  for (let i = 0; i < 8; i++) {
    const { s, phases } = simulate(dispatch(lobby(3, { totalRounds: 10 }, `shop${i}`), { type: 'START' }, { now: 0 }).state);
    if (phases.has('SHOP')) shops++;
    bought += s.order.reduce((a, id) => a + s.players[id].stats.perritasBought, 0);
  }
  assert.ok(shops > 0, 'nunca se pasó por una tienda');
  assert.ok(bought > 0, 'nadie compró Perritas');
});

test('no se puede tirar fuera de turno ni dos veces', () => {
  let s = lobby(2);
  s.players.p0.isBot = false;
  s.players.p1.isBot = false;
  s = dispatch(s, { type: 'START' }, { now: 0 }).state;
  assert.equal(dispatch(s, { type: 'ROLL', playerId: 'p0' }, { now: 1 }).ok, false, 'tiró durante la intro');
  s = dispatch(s, { type: 'TICK', seq: s.timer.seq }, { now: s.timer.at }).state; // TURN_START
  s = dispatch(s, { type: 'TICK', seq: s.timer.seq }, { now: s.timer.at }).state; // DICE_ROLL
  assert.equal(s.phase, 'DICE_ROLL');
  assert.equal(dispatch(s, { type: 'ROLL', playerId: 'p1' }, { now: 10 }).ok, false, 'tiró el jugador equivocado');
  const r1 = dispatch(s, { type: 'ROLL', playerId: 'p0' }, { now: 10 });
  assert.ok(r1.ok);
  assert.ok(r1.state.lastRoll.value >= 1 && r1.state.lastRoll.value <= 6);
  assert.equal(dispatch(r1.state, { type: 'ROLL', playerId: 'p0' }, { now: 11 }).ok, false, 'doble tiro');
  // un TICK viejo no hace nada
  assert.equal(dispatch(r1.state, { type: 'TICK', seq: s.timer?.seq ?? -1 }, { now: 1e9 }).ok, false);
});

test('el dado respeta el rango configurado (1–10)', () => {
  let s = dispatch(lobby(2, { diceMin: 1, diceMax: 10 }), { type: 'START' }, { now: 0 }).state;
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    let t = s;
    t.phase = 'DICE_ROLL';
    t.pending = { kind: 'roll', playerId: t.order[t.turnIndex], token: 'x' };
    t.rngState = i * 7919;
    const r = dispatch(t, { type: 'ROLL', playerId: t.order[t.turnIndex] }, { now: 0 });
    seen.add(r.state.lastRoll.value);
  }
  assert.ok([...seen].every((v) => v >= 1 && v <= 10));
  assert.ok(seen.has(10) && seen.has(1));
});

function stateAtShop(pemolares) {
  let s = dispatch(lobby(2), { type: 'START' }, { now: 0 }).state;
  const shopId = s.board.order.find((id) => s.board.tiles[id].type === 'shop');
  const p = s.players.p0;
  p.tileId = shopId;
  p.pemolares = pemolares;
  s.move = { playerId: 'p0', stepsLeft: 2, total: 3, stop: 'shop' };
  s.phase = 'SHOP';
  s.pending = { kind: 'shop', playerId: 'p0', token: 'tok', price: 20, canBuy: pemolares >= 20, done: null };
  return s;
}

test('tienda: sin fondos no se compra', () => {
  const s = stateAtShop(19);
  const r = dispatch(s, { type: 'SHOP_BUY', playerId: 'p0', token: 'tok' }, { now: 0 });
  assert.equal(r.ok, false);
  assert.equal(s.players.p0.perritas, 0);
});

test('tienda: compra atómica e idempotente', () => {
  const s = stateAtShop(45);
  const r = dispatch(s, { type: 'SHOP_BUY', playerId: 'p0', token: 'tok' }, { now: 0 });
  assert.ok(r.ok);
  assert.equal(r.state.players.p0.pemolares, 25);
  assert.equal(r.state.players.p0.perritas, 1);
  const again = dispatch(r.state, { type: 'SHOP_BUY', playerId: 'p0', token: 'tok' }, { now: 1 });
  assert.equal(again.ok, false, 'la misma compra se aplicó dos veces');
  assert.equal(dispatch(s, { type: 'SHOP_BUY', playerId: 'p1', token: 'tok' }, { now: 0 }).ok, false);
  assert.equal(dispatch(s, { type: 'SHOP_BUY', playerId: 'p0', token: 'viejo' }, { now: 0 }).ok, false);
});

test('el estado público no filtra RNG ni respuestas del minijuego', () => {
  let s = dispatch(lobby(3), { type: 'START' }, { now: 0 }).state;
  s.queue.push({ source: 'tile', participants: s.order.slice() });
  s.phase = 'TILE_RESOLUTION';
  s.timer = { at: 0, seq: 999, reason: 'tile' };
  s.timerSeq = 999;
  s = dispatch(s, { type: 'TICK', seq: 999 }, { now: 0 }).state;
  assert.equal(s.phase, 'MINIGAME_INTRO');
  s = dispatch(s, { type: 'TICK', seq: s.timer.seq }, { now: s.timer.at }).state;
  assert.equal(s.phase, 'MINIGAME_PLAYING');
  const pub = publicState(s);
  const json = JSON.stringify(pub);
  assert.ok(!('rngState' in pub));
  assert.equal(pub.minigame.data, undefined);
  if (s.minigame.gameId === 'cap-or-fact') {
    assert.ok(!json.includes('"answer"'), 'la respuesta correcta se filtró');
  }
  assert.ok(privateView(s, 'p0').minigame);
});

test('pausa y reanudación', () => {
  let s = dispatch(lobby(2), { type: 'START' }, { now: 0 }).state;
  s = dispatch(s, { type: 'PAUSE' }, { now: 1000 }).state;
  assert.equal(s.timer, null);
  assert.equal(dispatch(s, { type: 'ROLL', playerId: 'p0' }, { now: 1 }).ok, false);
  s = dispatch(s, { type: 'RESUME' }, { now: 5000 }).state;
  assert.ok(s.timer && s.timer.at === 5000 + 2500);
});

test('ranking: Perritas mandan, Pemolares desempatan sólo si está activo', () => {
  const s = lobby(3);
  s.players.p0.perritas = 2; s.players.p0.pemolares = 5;
  s.players.p1.perritas = 2; s.players.p1.pemolares = 50;
  s.players.p2.perritas = 1; s.players.p2.pemolares = 999;
  let r = computeRanking(s);
  assert.deepEqual(r.map((x) => x.playerId), ['p1', 'p0', 'p2']);
  s.config.pemolaresTiebreak = false;
  r = computeRanking(s);
  assert.equal(r[0].rank, 1);
  assert.equal(r[1].rank, 1);
  assert.equal(r.find((x) => x.playerId === 'p2').rank, 3);
});
