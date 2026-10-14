// Servidor WebSocket mínimo (RFC 6455) sin dependencias: suficiente para
// mensajes JSON pequeños de texto. Maneja ping/pong, cierre y fragmentación.

import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 256 * 1024;

export class WsConnection extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.fragments = [];
    this.open = true;
    this.id = crypto.randomBytes(8).toString('hex');
    socket.setNoDelay(true);
    socket.on('data', (d) => this.onData(d));
    socket.on('close', () => this.finish());
    socket.on('error', () => this.finish());
    this.alive = true;
  }

  finish() {
    if (!this.open) return;
    this.open = false;
    this.emit('close');
  }

  onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0];
      const b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0;
      const op = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) return;
        const big = this.buf.readBigUInt64BE(2);
        if (big > BigInt(MAX_MESSAGE)) return this.close(1009);
        len = Number(big);
        off = 10;
      }
      if (len > MAX_MESSAGE) return this.close(1009);
      if (!masked) return this.close(1002); // los clientes deben enmascarar
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4);
      const payload = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      this.handleFrame(fin, op, payload);
      if (!this.open) return;
    }
  }

  handleFrame(fin, op, payload) {
    if (op === 0x8) return this.close(1000);
    if (op === 0x9) return this.sendFrame(0xa, payload);
    if (op === 0xa) { this.alive = true; return undefined; }
    if (op === 0x1 || op === 0x0) {
      this.fragments.push(payload);
      if (!fin) return undefined;
      const msg = Buffer.concat(this.fragments).toString('utf8');
      this.fragments = [];
      this.emit('message', msg);
    }
    return undefined;
  }

  sendFrame(op, payload) {
    if (!this.open) return;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | op, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | op;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | op;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    this.socket.write(Buffer.concat([header, payload]));
  }

  send(text) {
    this.sendFrame(0x1, Buffer.from(text, 'utf8'));
  }

  close(code = 1000) {
    if (!this.open) return;
    const b = Buffer.alloc(2);
    b.writeUInt16BE(code, 0);
    try { this.sendFrame(0x8, b); } catch { /* nada */ }
    this.socket.end();
    this.finish();
  }
}

/** Conecta el upgrade de un http.Server. `onConnection(conn, req)` */
export function attachWebSocket(server, path, onConnection) {
  const conns = new Set();
  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url, 'http://x');
    const key = req.headers['sec-websocket-key'];
    if (url.pathname !== path || !key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '', '',
    ].join('\r\n'));
    const conn = new WsConnection(socket);
    conns.add(conn);
    conn.on('close', () => conns.delete(conn));
    onConnection(conn, req);
  });
  // latido: cierra conexiones muertas
  setInterval(() => {
    for (const c of conns) {
      if (!c.alive) { c.close(1001); continue; }
      c.alive = false;
      c.sendFrame(0x9, Buffer.alloc(0));
    }
  }, 20000).unref();
  return conns;
}
