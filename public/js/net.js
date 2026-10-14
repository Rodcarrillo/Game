// Cliente WebSocket con reconexión automática y respuestas (ack),
// con una interfaz parecida a socket.io: on(ev, fn) · emit(ev, data, ack).

export class Net {
  constructor(path = '/ws') {
    this.url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`;
    this.handlers = {};
    this.acks = new Map();
    this.seq = 0;
    this.queue = [];
    this.delay = 500;
    this.open();
  }

  open() {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.delay = 500;
      this.fire('connect');
      for (const m of this.queue.splice(0)) ws.send(m);
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.re != null) {
        const fn = this.acks.get(msg.re);
        this.acks.delete(msg.re);
        if (fn) fn(msg.data);
      } else if (msg.ev) this.fire(msg.ev, msg.data);
    };
    ws.onclose = () => {
      this.fire('disconnect');
      for (const fn of this.acks.values()) fn({ ok: false, error: 'Sin conexión' });
      this.acks.clear();
      setTimeout(() => this.open(), this.delay);
      this.delay = Math.min(5000, this.delay * 1.6);
    };
  }

  on(ev, fn) {
    (this.handlers[ev] ||= []).push(fn);
  }

  fire(ev, data) {
    for (const fn of this.handlers[ev] || []) fn(data);
  }

  emit(ev, data, ack) {
    const id = ++this.seq;
    if (ack) this.acks.set(id, ack);
    const text = JSON.stringify({ id, ev, data });
    if (this.ws.readyState === 1) this.ws.send(text);
    else this.queue.push(text);
  }
}
