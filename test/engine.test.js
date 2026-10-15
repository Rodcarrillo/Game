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
      assert.ok(Object.values(b.tiles).some((t) => t.type === 'itemshop'));
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
  assert.ok(s.timer && s.timer.at === 5000 + 3000);
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

test('fases nuevas: tienda de objetos, Safari, Examen y regalo de shots aparecen y terminan', () => {
  const all = new Set();
  let shots = 0;
  let companions = 0;
  let used = 0;
  for (let i = 0; i < 12; i++) {
    const { s, phases } = simulate(dispatch(lobby(4, { totalRounds: 10 }, `nuevo${i}`), { type: 'START' }, { now: 0 }).state);
    assert.equal(s.phase, 'WINNER_REVEAL');
    phases.forEach((p) => all.add(p));
    for (const id of s.order) {
      shots += s.players[id].shots;
      if (s.players[id].companion) companions++;
      used += s.players[id].stats.itemsUsed;
      assert.ok(s.players[id].items.length <= s.config.maxItems);
    }
  }
  for (const ph of ['ITEM_SHOP', 'SAFARI', 'EXAM', 'SHOT_GIFT']) assert.ok(all.has(ph), `nunca pasó por ${ph}`);
  assert.ok(shots > 0 && companions > 0 && used > 0);
});

test('sin modo shots no hay shots ni objetos de shots', () => {
  for (let i = 0; i < 4; i++) {
    const { s, phases } = simulate(dispatch(lobby(3, { totalRounds: 6, shotsEnabled: false }, `seco${i}`), { type: 'START' }, { now: 0 }).state);
    assert.ok(!phases.has('SHOT_GIFT'));
    for (const id of s.order) {
      assert.equal(s.players[id].shots, 0);
      assert.ok(!s.players[id].items.some((it) => it === 'pass' || it === 'water'));
    }
  }
});

function rollReady(items = []) {
  let s = dispatch(lobby(2), { type: 'START' }, { now: 0 }).state;
  s.players.p0.isBot = false;
  s.players.p0.items = items.slice();
  s.phase = 'DICE_ROLL';
  s.turnIndex = 0;
  s.pending = { kind: 'roll', playerId: 'p0', token: 'r', dice: null, used: [] };
  return s;
}

test('objetos: dado a elección, dado doble y validaciones', () => {
  let s = rollReady(['choice', 'double']);
  assert.equal(dispatch(s, { type: 'USE_ITEM', playerId: 'p0', item: 'choice', value: 9 }, { now: 0 }).ok, false);
  assert.equal(dispatch(s, { type: 'USE_ITEM', playerId: 'p1', item: 'choice', value: 3 }, { now: 0 }).ok, false);
  s = dispatch(s, { type: 'USE_ITEM', playerId: 'p0', item: 'choice', value: 4 }, { now: 0 }).state;
  assert.deepEqual(s.players.p0.items, ['double']);
  assert.equal(dispatch(s, { type: 'USE_ITEM', playerId: 'p0', item: 'double' }, { now: 0 }).ok, false, 'dos dados especiales');
  s = dispatch(s, { type: 'ROLL', playerId: 'p0' }, { now: 0 }).state;
  assert.equal(s.lastRoll.value, 4);
  let d = rollReady(['double']);
  d = dispatch(d, { type: 'USE_ITEM', playerId: 'p0', item: 'double' }, { now: 0 }).state;
  d = dispatch(d, { type: 'ROLL', playerId: 'p0' }, { now: 0 }).state;
  assert.equal(d.lastRoll.dice.length, 2);
  assert.equal(dispatch(rollReady([]), { type: 'USE_ITEM', playerId: 'p0', item: 'triple' }, { now: 0 }).ok, false);
});

test('shots: el vaso de agua salva y el límite se respeta', async () => {
  const { giveShot } = await import('../src/engine/wallet.js');
  const s = lobby(2, { shotLimit: 2 });
  s.players.p0.items = ['water'];
  giveShot(s, 'p0', 1, 'x');
  assert.equal(s.players.p0.shots, 0);
  giveShot(s, 'p0', 5, 'x');
  assert.equal(s.players.p0.shots, 2);
});

test('examen: la respuesta no se ve en el estado público', () => {
  let s = dispatch(lobby(2), { type: 'START' }, { now: 0 }).state;
  const exam = s.board.order.find((id) => s.board.tiles[id].type === 'exam');
  s.players.p0.tileId = exam;
  s.move = { playerId: 'p0', stepsLeft: 0, total: 1, stop: 'land' };
  s.phase = 'MOVEMENT';
  s.timer = { at: 0, seq: 500, reason: 'move' };
  s.timerSeq = 500;
  s = dispatch(s, { type: 'TICK', seq: 500 }, { now: 0 }).state;
  assert.equal(s.phase, 'EXAM');
  const pub = publicState(s);
  assert.ok(!JSON.stringify(pub).includes('examAnswer'));
  const r = dispatch(s, { type: 'EXAM_ANSWER', playerId: 'p0', answer: 'cap' }, { now: 1 });
  assert.ok(r.ok);
  const pend = r.state.phase === 'SHOT_CONFIRM' ? r.state.shotHold.pending : r.state.pending;
  assert.equal(typeof pend.result.ok, 'boolean');
});

test('cada shot pausa el juego hasta que se pulsa Continuar', async () => {
  const { giveShot } = await import('../src/engine/wallet.js');
  let s = dispatch(lobby(2), { type: 'START' }, { now: 0 }).state;
  s.players.p1.isBot = false;
  giveShot(s, 'p1', 1, 'prueba');
  const r = dispatch(s, { type: 'SET_CONNECTED', playerId: 'p0', connected: true }, { now: 10 });
  s = r.state;
  assert.equal(s.phase, 'SHOT_CONFIRM');
  assert.equal(s.pending.playerId, 'p1');
  assert.equal(dispatch(s, { type: 'SHOT_OK', playerId: 'p0' }, { now: 11 }).ok, false, 'otro jugador no confirma');
  s = dispatch(s, { type: 'SHOT_OK', playerId: 'p1' }, { now: 12 }).state;
  assert.equal(s.phase, 'BOARD_INTRO');
  assert.ok(s.timer);
});

test('entradas: Escuela, La Pérez y Safari tienen casilla de entrada', () => {
  const b = buildBoard({});
  const places = Object.values(b.tiles).filter((t) => t.type === 'place').map((t) => t.place).sort();
  assert.deepEqual(places, ['disco', 'escuela', 'safari']);
});

test('Bachelor of Abdo: viaje a Las Vegas, turno exprés y regreso a las mismas casillas', () => {
  let s = dispatch(lobby(3), { type: 'START' }, { now: 0 }).state;
  const abdo = s.board.order.filter((id) => s.board.tiles[id].type === 'abdo');
  assert.equal(abdo.length, 1, 'debe haber exactamente una casilla Bachelor of Abdo');
  s.players.p1.tileId = 'L2';
  s.players.p2.tileId = 'T2';
  s.players.p0.tileId = abdo[0];
  s.move = { playerId: 'p0', stepsLeft: 0, total: 1, stop: 'land' };
  s.phase = 'MOVEMENT';
  s.timer = { at: 0, seq: 700, reason: 'move' };
  s.timerSeq = 700;
  s = dispatch(s, { type: 'TICK', seq: 700 }, { now: 0 }).state;
  assert.equal(s.phase, 'ABDO_INTRO');
  // avanza hasta el regreso y revisa que cada quien vuelva a su casilla
  let guard = 0;
  let now = 0;
  const seen = new Set();
  while (s.phase !== 'VEGAS_RETURN' && guard++ < 5000) {
    const bots = botActions(s, () => 0.5).filter((b) => !seen.has(b.key));
    if (bots.length) { seen.add(bots[0].key); now += bots[0].delayMs; const r = dispatch(s, bots[0].action, { now }); if (r.ok) s = r.state; continue; }
    now = s.timer.at;
    s = dispatch(s, { type: 'TICK', seq: s.timer.seq }, { now }).state;
  }
  assert.equal(s.board.theme, 'vegas');
  now = s.timer.at;
  s = dispatch(s, { type: 'TICK', seq: s.timer.seq }, { now }).state;
  assert.equal(s.players.p1.tileId, 'L2');
  assert.equal(s.players.p2.tileId, 'T2');
  assert.ok(!s.board.theme);
  const { s: end } = simulate(s);
  assert.equal(end.phase, 'WINNER_REVEAL');
});

test('reto de Las Vegas: sólo el host decide y paga al cumplir', () => {
  let s = dispatch(lobby(2), { type: 'START' }, { now: 0 }).state;
  s.phase = 'CHALLENGE';
  s.pending = { kind: 'challenge', playerId: 'p0', token: 'x', text: 'baila', reward: 'perritas', amount: 1, result: null };
  assert.equal(dispatch(s, { type: 'CHALLENGE_RESULT', playerId: 'p0', done: true }, { now: 0 }).ok, false);
  const r = dispatch(s, { type: 'CHALLENGE_RESULT', host: true, done: true }, { now: 0 });
  assert.equal(r.state.players.p0.perritas, 1);
});
