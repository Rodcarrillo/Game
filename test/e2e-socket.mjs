// Prueba de punta a punta contra un servidor corriendo (PORT, por defecto 3000).
// Uso: node test/e2e-socket.mjs   — juega una partida corta con 2 "celulares" + 1 bot.
const PORT = process.env.PORT || 3000;
const URL = `ws://localhost:${PORT}/ws`;

function client(name) {
  const ws = new WebSocket(URL);
  const c = { ws, name, state: null, you: null, acks: new Map(), seq: 0, handlers: {} };
  c.ready = new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.re != null) { c.acks.get(m.re)?.(m.data); c.acks.delete(m.re); return; }
    if (m.ev === 'state') { c.state = m.data.state; c.you = m.data.you; c.handlers.state?.(); }
  });
  c.emit = (ev, data) => new Promise((r) => { const id = ++c.seq; c.acks.set(id, r); ws.send(JSON.stringify({ id, ev, data })); });
  return c;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(14, 19), ...a);

const tv = client('tv');
await tv.ready;
const created = await tv.emit('host:create', {});
log('sala', created.code);
await tv.emit('host:action', { type: 'UPDATE_CONFIG', config: { totalRounds: 2, turnTimeoutSec: 15 } });

const phones = [client('Ana'), client('Beto')];
for (const p of phones) {
  await p.ready;
  const r = await p.emit('player:join', { code: created.code, name: p.name, color: p.name === 'Ana' ? '#ff5fae' : '#3d8bff' });
  if (!r.ok) throw new Error(r.error);
  p.token = r.token; p.id = r.playerId;
}
await tv.emit('host:action', { type: 'ADD_BOT' });
await sleep(200);
console.assert(tv.state.order.length === 3, 'deben ser 3 jugadores');

// seguridad: un celular no puede ejecutar acciones de host
const hack = await phones[0].emit('host:action', { type: 'START' });
console.assert(!hack.ok, 'un jugador no debe poder iniciar');
const s = await tv.emit('host:action', { type: 'START' });
console.assert(s.ok, 'START falló');
log('¡partida iniciada!');

let rejectedOutOfTurn = false;
let reconnected = false;
const phases = new Set();
let mgSeen = 0;

async function play(p) {
  const st = p.state; if (!st) return;
  const me = p.id;
  if (st.phase === 'DICE_ROLL' && st.currentPlayerId !== me && !rejectedOutOfTurn) {
    const r = await p.emit('player:action', { type: 'ROLL' });
    if (!r.ok) { rejectedOutOfTurn = true; log(`  ${p.name} intentó tirar fuera de turno → rechazado: ${r.error}`); }
  }
  if (st.currentPlayerId === me && st.pending?.playerId === me) {
    if (st.phase === 'DICE_ROLL') await p.emit('player:action', { type: 'ROLL' });
    if (st.phase === 'ROUTE_CHOICE') await p.emit('player:action', { type: 'CHOOSE_ROUTE', to: st.pending.options[1].to });
    if (st.phase === 'SHOP' && !st.pending.done) {
      const r = await p.emit('player:action', st.pending.canBuy ? { type: 'SHOP_BUY', token: st.pending.token, qty: 1 } : { type: 'SHOP_SKIP', token: st.pending.token });
      log(`  ${p.name} en tienda: ${st.pending.canBuy ? 'compra' : 'pasa'} → ${r.ok}`);
    }
  }
  if (st.phase === 'MINIGAME_PLAYING' && st.minigame.participants.includes(me)) {
    const v = st.minigame.view;
    if (st.minigame.gameId === 'cap-or-fact' && v.step === 'ask' && !p.you?.minigame?.myAnswer) await p.emit('player:action', { type: 'MG_INPUT', payload: { answer: Math.random() < 0.5 ? 'cap' : 'fact' } });
    if (st.minigame.gameId === 'skill-issue' && v.step === 'run' && !p.you?.minigame?.stopped) {
      await sleep(v.target * 1000 * (0.8 + Math.random() * 0.4));
      await p.emit('player:action', { type: 'MG_INPUT', payload: { action: 'stop' } });
    }
  }
}
for (const p of phones) p.handlers.state = () => play(p).catch((e) => log('error', e.message));

let last = '';
const t0 = Date.now();
while (tv.state.phase !== 'WINNER_REVEAL') {
  await sleep(250);
  const st = tv.state;
  phases.add(st.phase);
  const line = `${st.phase} r${st.round} turno=${st.players[st.currentPlayerId]?.name ?? '-'}`;
  if (line !== last) { last = line; if (['TURN_START', 'MINIGAME_INTRO', 'MINIGAME_RESULTS', 'BOARD_END', 'FINAL_BONUSES'].includes(st.phase)) log(line); }
  if (st.phase === 'MINIGAME_INTRO') mgSeen++;
  // a media partida, Beto pierde la conexión y vuelve con su token
  if (!reconnected && st.round === 2 && st.phase === 'TURN_START') {
    reconnected = true;
    const beto = phones[1];
    beto.ws.close();
    await sleep(600);
    console.assert(tv.state.players[beto.id].connected === false, 'el TV debe ver a Beto desconectado');
    const nb = client('Beto');
    await nb.ready;
    const r = await nb.emit('player:resume', { code: created.code, token: beto.token });
    console.assert(r.ok && r.playerId === beto.id, 'reconexión falló');
    nb.id = beto.id; nb.token = beto.token;
    phones[1] = nb;
    nb.handlers.state = () => play(nb).catch((e) => log('error', e.message));
    await sleep(300);
    log(`  Beto se reconectó: connected=${tv.state.players[beto.id].connected}, casilla=${tv.state.players[beto.id].tileId}`);
  }
  if (Date.now() - t0 > 380000) throw new Error('tiempo agotado en ' + tv.state.phase);
}
const st = tv.state;
log('GANADOR:', st.final.winners.map((id) => st.players[id].name).join(' y '));
for (const r of st.final.ranking) log(`  ${r.rank}º ${st.players[r.playerId].name}: ${r.perritas} Perritas, ${r.pemolares} Pemolares`);
const json = JSON.stringify(st);
const checks = {
  rechazoFueraDeTurno: rejectedOutOfTurn,
  reconexion: reconnected,
  huboMinijuego: phases.has('MINIGAME_PLAYING'),
  sinRngEnPublico: !json.includes('rngState'),
  fasesFinales: ['BOARD_END', 'FINAL_BONUSES', 'FINAL_LEADERBOARD'].every((p) => phases.has(p)),
};
log(checks);
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
