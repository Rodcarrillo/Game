// Salas: cada sala tiene un motor autoritativo (runner), un host (la TV),
// y jugadores identificados por un token secreto que permite reconectar.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame, createRunner, publicState, privateView, isHostAction, listMinigames, DEFAULT_CONFIG,
  PLAYER_COLORS, HATS, MAX_PLAYERS,
} from '../src/engine/index.js';

const PLAYER_ACTIONS = new Set(['ROLL', 'CHOOSE_ROUTE', 'SHOP_BUY', 'SHOP_SKIP', 'MG_INPUT', 'UPDATE_PLAYER']);
const BOT_NAMES = ['Gomi', 'Chicloso', 'Mazapán', 'Tamarindo', 'Pulparindo', 'Gansito', 'Bubulubu', 'Duvalín'];
const ROOM_TTL_MS = 8 * 60 * 60 * 1000;

const token = () => crypto.randomBytes(18).toString('base64url');
const newId = () => crypto.randomBytes(6).toString('hex');

function roomCode(existing) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += A[crypto.randomInt(A.length)];
    if (!existing.has(c)) return c;
  }
}

export class RoomManager {
  constructor({ dataDir }) {
    this.dataDir = dataDir;
    this.rooms = new Map();
    if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
    this.loadAll();
    setInterval(() => this.sweep(), 10 * 60 * 1000).unref();
  }

  meta() {
    return { minigames: listMinigames(), defaults: DEFAULT_CONFIG, colors: PLAYER_COLORS, hats: HATS, maxPlayers: MAX_PLAYERS };
  }

  create(config) {
    const code = roomCode(this.rooms);
    const room = new Room(this, { code, hostToken: token(), state: createGame({ config, seed: token() }) });
    this.rooms.set(code, room);
    room.persist();
    return room;
  }

  get(code) {
    return this.rooms.get(String(code || '').toUpperCase().trim());
  }

  loadAll() {
    if (!this.dataDir) return;
    for (const f of fs.readdirSync(this.dataDir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(this.dataDir, f), 'utf8'));
        if (Date.now() - (raw.touchedAt || 0) > ROOM_TTL_MS) continue;
        const room = new Room(this, raw);
        this.rooms.set(raw.code, room);
        console.log(`Sala ${raw.code} restaurada (${raw.state.phase})`);
      } catch (e) {
        console.warn('No se pudo restaurar', f, e.message);
      }
    }
  }

  sweep() {
    for (const [code, room] of this.rooms) {
      if (Date.now() - room.touchedAt > ROOM_TTL_MS && room.connectedCount() === 0) {
        room.destroy();
        this.rooms.delete(code);
      }
    }
  }
}

export class Room {
  constructor(manager, { code, hostToken, playerTokens = {}, state, touchedAt }) {
    this.manager = manager;
    this.code = code;
    this.hostToken = hostToken;
    this.playerTokens = playerTokens; // token → playerId
    this.touchedAt = touchedAt || Date.now();
    this.sockets = new Map(); // socket.id → { socket, role, playerId }
    this.persistTimer = null;
    this.runner = createRunner({ state, onChange: () => this.onChange() });
    // reprograma temporizadores pendientes (recuperación tras reinicio)
    this.runner.resume();
  }

  get state() {
    return this.runner.getState();
  }

  connectedCount() {
    return this.sockets.size;
  }

  onChange() {
    this.touchedAt = Date.now();
    this.broadcast();
    this.persist();
  }

  broadcast() {
    const s = this.state;
    const pub = publicState(s);
    for (const { socket, role, playerId } of this.sockets.values()) {
      if (role === 'player') socket.emit('state', { state: pub, you: privateView(s, playerId), serverNow: Date.now() });
      else socket.emit('state', { state: pub, host: role === 'host', serverNow: Date.now() });
    }
  }

  sendTo(socket) {
    const entry = this.sockets.get(socket.id);
    if (!entry) return;
    const s = this.state;
    const pub = publicState(s);
    socket.emit('meta', { ...this.manager.meta(), code: this.code });
    if (entry.role === 'player') socket.emit('state', { state: pub, you: privateView(s, entry.playerId), serverNow: Date.now() });
    else socket.emit('state', { state: pub, host: entry.role === 'host', serverNow: Date.now() });
  }

  persist() {
    if (!this.manager.dataDir) return;
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      const file = path.join(this.manager.dataDir, `${this.code}.json`);
      const data = JSON.stringify({
        code: this.code, hostToken: this.hostToken, playerTokens: this.playerTokens, state: this.state, touchedAt: this.touchedAt,
      });
      fs.writeFile(file + '.tmp', data, (err) => {
        if (!err) fs.rename(file + '.tmp', file, () => {});
      });
    }, 300);
  }

  destroy() {
    this.runner.stop();
    if (this.manager.dataDir) fs.rm(path.join(this.manager.dataDir, `${this.code}.json`), { force: true }, () => {});
  }

  attach(socket, role, playerId = null) {
    this.sockets.set(socket.id, { socket, role, playerId });
    socket.data.room = this.code;
    if (role === 'player') this.runner.dispatch({ type: 'SET_CONNECTED', playerId, connected: true });
    this.sendTo(socket);
  }

  detach(socket) {
    const entry = this.sockets.get(socket.id);
    if (!entry) return;
    this.sockets.delete(socket.id);
    if (entry.role === 'player') {
      const still = [...this.sockets.values()].some((e) => e.playerId === entry.playerId);
      if (!still && this.state.players[entry.playerId]) {
        this.runner.dispatch({ type: 'SET_CONNECTED', playerId: entry.playerId, connected: false });
      }
    }
  }

  join({ name, color, hat }) {
    const s = this.state;
    if (s.phase !== 'LOBBY') return { error: 'La partida ya empezó. Usa tu dispositivo original para reconectar.' };
    const playerId = newId();
    const res = this.runner.dispatch({ type: 'ADD_PLAYER', player: { id: playerId, name, color, hat, isBot: false } });
    if (!res.ok) return { error: res.error };
    const t = token();
    this.playerTokens[t] = playerId;
    this.persist();
    return { playerId, token: t };
  }

  resume(t) {
    const playerId = this.playerTokens[t];
    if (!playerId || !this.state.players[playerId]) return null;
    return playerId;
  }

  hostAction(action) {
    const s = this.state;
    if (action?.type === 'ADD_BOT') {
      const used = new Set(s.order.map((id) => s.players[id].name));
      const name = BOT_NAMES.find((n) => !used.has(n)) || `Bot ${s.order.length + 1}`;
      return this.runner.dispatch({ type: 'ADD_PLAYER', player: { id: `bot-${newId()}`, name, isBot: true } });
    }
    if (action?.type === 'RESET') {
      // Nueva partida con los mismos jugadores y configuración.
      const next = createGame({ config: s.config, seed: token() });
      let st = next;
      const fresh = createRunner({ state: st });
      for (const id of s.order) {
        const p = s.players[id];
        fresh.dispatch({ type: 'ADD_PLAYER', player: { id, name: p.name, color: p.color, hat: p.hat, isBot: p.isBot, connected: p.connected } });
      }
      st = fresh.getState();
      fresh.stop();
      this.runner.replaceState(st);
      return { ok: true };
    }
    if (!isHostAction(action?.type)) return { ok: false, error: 'Acción no permitida' };
    if (action.type === 'REMOVE_PLAYER') {
      for (const [t, id] of Object.entries(this.playerTokens)) if (id === action.playerId) delete this.playerTokens[t];
    }
    return this.runner.dispatch(action);
  }

  playerAction(playerId, action) {
    if (!PLAYER_ACTIONS.has(action?.type)) return { ok: false, error: 'Acción no permitida' };
    // El servidor fija la identidad: el cliente nunca elige por quién actúa.
    return this.runner.dispatch({ ...action, playerId });
  }
}
