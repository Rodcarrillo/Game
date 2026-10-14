// Servidor de MICHELSON'S ARCADE sin dependencias externas:
// archivos estáticos + WebSocket en /ws con un protocolo JSON sencillo:
//   cliente → { id, ev, data }   servidor → { re: id, data } (respuesta)
//   servidor → { ev, data }      (eventos: 'state', 'meta')

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachWebSocket } from './ws.js';
import { RoomManager } from './room.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const lanAddresses = () => Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => `http://${i.address}:${PORT}`);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/info') {
    res.writeHead(200, { 'content-type': MIME['.json'] });
    return res.end(JSON.stringify({ lan: lanAddresses(), port: PORT }));
  }
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': MIME['.json'] });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.rooms.size }));
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  if (!path.extname(rel)) rel += '.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('No encontrado'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

const rooms = new RoomManager({ dataDir: process.env.DATA_DIR || path.join(ROOT, 'data', 'rooms') });

// Limitador simple por conexión: 25 acciones por segundo como máximo.
function limiter() {
  let tokens = 25;
  let last = Date.now();
  return () => {
    const now = Date.now();
    tokens = Math.min(25, tokens + ((now - last) / 1000) * 25);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

attachWebSocket(server, '/ws', (conn) => {
  const socket = {
    id: conn.id,
    data: {},
    emit(ev, data) { conn.send(JSON.stringify({ ev, data })); },
  };
  const allow = limiter();
  const room = () => rooms.get(socket.data.room);
  const handlers = {
    'host:create': (msg) => {
      const r = rooms.create(msg?.config || {});
      r.attach(socket, 'host');
      return { ok: true, code: r.code, hostToken: r.hostToken };
    },
    'host:attach': ({ code, hostToken } = {}) => {
      const r = rooms.get(code);
      if (!r || r.hostToken !== hostToken) return { ok: false, error: 'Sala no encontrada' };
      r.attach(socket, 'host');
      return { ok: true, code: r.code };
    },
    'tv:watch': ({ code } = {}) => {
      const r = rooms.get(code);
      if (!r) return { ok: false, error: 'Sala no encontrada' };
      r.attach(socket, 'viewer');
      return { ok: true, code: r.code };
    },
    'player:join': ({ code, name, color, hat } = {}) => {
      const r = rooms.get(code);
      if (!r) return { ok: false, error: 'No existe esa sala' };
      const res = r.join({ name, color, hat });
      if (res.error) return { ok: false, error: res.error };
      r.attach(socket, 'player', res.playerId);
      return { ok: true, code: r.code, ...res };
    },
    'player:resume': ({ code, token } = {}) => {
      const r = rooms.get(code);
      if (!r) return { ok: false, error: 'No existe esa sala' };
      const playerId = r.resume(token);
      if (!playerId) return { ok: false, error: 'Sesión no encontrada' };
      r.attach(socket, 'player', playerId);
      return { ok: true, code: r.code, playerId };
    },
    'host:action': (action) => {
      const r = room();
      const entry = r?.sockets.get(socket.id);
      if (!r || entry?.role !== 'host') return { ok: false, error: 'Sólo el host' };
      if (!allow()) return { ok: false, error: 'Demasiadas acciones' };
      const res = r.hostAction(action);
      return { ok: res.ok !== false, error: res.error };
    },
    'player:action': (action) => {
      const r = room();
      const entry = r?.sockets.get(socket.id);
      if (!r || entry?.role !== 'player') return { ok: false, error: 'No estás en una sala' };
      if (!allow()) return { ok: false, error: 'Más despacio' };
      const res = r.playerAction(entry.playerId, action);
      return { ok: res.ok, error: res.error };
    },
  };

  conn.on('message', (text) => {
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    const h = handlers[msg?.ev];
    if (!h) return;
    // si el socket cambia de sala, se desconecta de la anterior
    const prevRoom = room();
    let out;
    try {
      if (['host:create', 'host:attach', 'tv:watch', 'player:join', 'player:resume'].includes(msg.ev) && prevRoom) prevRoom.detach(socket);
      out = h(msg.data);
    } catch (e) {
      console.error(e);
      out = { ok: false, error: 'Error del servidor' };
    }
    if (msg.id != null) conn.send(JSON.stringify({ re: msg.id, data: out }));
  });
  conn.on('close', () => room()?.detach(socket));
});

server.listen(PORT, () => {
  console.log(`MICHELSON'S ARCADE en http://localhost:${PORT}`);
  for (const a of lanAddresses()) console.log(`  En tu red: ${a}  (TV: ${a}/tv · celulares: ${a}/play)`);
});

export { server, rooms };
