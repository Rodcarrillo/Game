// GameBoard · BoardTile · PlayerToken · BoardCameraController
// Dibuja el tablero a partir de los datos del servidor. No contiene reglas.

import { beanInner, TILE_STYLE, tileGlyph, esc } from './assets.js';

const NS = 'http://www.w3.org/2000/svg';
const INK = '#2a1d5c';

const REGION_TINT = {
  plaza: '#c7a8ff',
  bosque: '#4fc262',
  pantano: '#36b7a4',
  cumbre: '#ffb6dc',
  volcan: '#f29a5c',
  isla: '#ffd96b',
  muelle: '#8fd8ff',
};
const REGION_DECOR = {
  plaza: ['house', 'flag', 'bush'],
  bosque: ['tree', 'tree', 'lolly', 'bush'],
  pantano: ['reed', 'pad', 'bush'],
  cumbre: ['cotton', 'cotton', 'lolly'],
  volcan: ['rock', 'mallow', 'rock'],
  isla: ['palm', 'coins', 'bush'],
  muelle: ['barrel', 'umbrella', 'bush'],
};

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function inPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function decorSvg(kind, region, r) {
  const tint = REGION_TINT[region];
  switch (kind) {
    case 'tree': {
      const c = ['#3fb850', '#5fd16a', '#2fa35a'][Math.floor(r * 3)];
      return `<rect x="-5" y="-6" width="10" height="26" rx="4" fill="#a8693f" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="0" cy="-22" r="24" fill="${c}" stroke="${INK}" stroke-width="3"/>
        <circle cx="-9" cy="-30" r="7" fill="#fff" opacity=".35"/>`;
    }
    case 'lolly':
      return `<rect x="-3" y="-14" width="6" height="34" rx="3" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="0" cy="-26" r="16" fill="#ff5fae" stroke="${INK}" stroke-width="3"/>
        <path d="M-10 -26a10 10 0 0 1 20 0a6 6 0 0 1-12 0" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`;
    case 'bush':
      return `<ellipse cx="-12" cy="0" rx="14" ry="12" fill="${tint}" stroke="${INK}" stroke-width="2.5"/>
        <ellipse cx="10" cy="-2" rx="16" ry="14" fill="${tint}" stroke="${INK}" stroke-width="2.5"/>
        <ellipse cx="6" cy="-8" rx="5" ry="3" fill="#fff" opacity=".4"/>`;
    case 'cotton':
      return `<rect x="-3" y="-4" width="6" height="22" rx="3" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="-10" cy="-14" r="13" fill="#ffc6e6" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="9" cy="-16" r="14" fill="#ffd6ef" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="0" cy="-27" r="12" fill="#ffe3f4" stroke="${INK}" stroke-width="2.5"/>`;
    case 'rock':
      return `<path d="M-20 10l6-20 14-6 16 8 6 18z" fill="#9b8bb8" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M-10 -8l9-4" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round"/>`;
    case 'mallow':
      return `<rect x="-14" y="-18" width="28" height="30" rx="8" fill="#fff4f9" stroke="${INK}" stroke-width="3"/>
        <ellipse cx="0" cy="-18" rx="14" ry="5" fill="#ffd1e6" stroke="${INK}" stroke-width="2.5"/>`;
    case 'reed':
      return `<path d="M-6 14c-2-14-2-24-6-34M2 14c0-16 2-26 6-36M8 14c2-10 6-16 10-22" fill="none" stroke="#2b8f6a" stroke-width="4" stroke-linecap="round"/>
        <rect x="-15" y="-30" width="6" height="14" rx="3" fill="#a8693f" stroke="${INK}" stroke-width="2"/>`;
    case 'pad':
      return `<ellipse cx="0" cy="0" rx="22" ry="11" fill="#5fd18a" stroke="${INK}" stroke-width="2.5"/><path d="M0 0l20-6" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="-6" cy="-6" r="4" fill="#ff8cc6" stroke="${INK}" stroke-width="2"/>`;
    case 'palm':
      return `<path d="M0 20c2-14 0-26-4-38" fill="none" stroke="#a8693f" stroke-width="7" stroke-linecap="round"/>
        <path d="M-4 -18c-14-6-22 0-26 6 10-6 18-4 26-6zM-4 -18c4-14 16-16 24-12-10 0-18 4-24 12zM-4 -18c14-2 22 6 24 14-8-8-16-10-24-14zM-4 -18c-10 2-16 10-16 20 4-10 10-16 16-20z" fill="#3fb850" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
    case 'coins':
      return `<g>${[0, 1, 2, 3].map((i) => `<ellipse cx="${i % 2 ? 4 : -2}" cy="${12 - i * 7}" rx="14" ry="5" fill="#ffc94a" stroke="${INK}" stroke-width="2.5"/>`).join('')}</g>`;
    case 'barrel':
      return `<rect x="-13" y="-18" width="26" height="32" rx="9" fill="#c98a4f" stroke="${INK}" stroke-width="3"/><path d="M-13 -8h26M-13 4h26" stroke="${INK}" stroke-width="2.5"/>`;
    case 'umbrella':
      return `<path d="M0 22V-14" stroke="${INK}" stroke-width="3"/><path d="M-26 -12a26 18 0 0 1 52 0z" fill="#ff6b4a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-9 -12a9 18 0 0 1 18 0" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`;
    case 'house':
      return `<rect x="-20" y="-16" width="40" height="32" rx="4" fill="#fff4e0" stroke="${INK}" stroke-width="3"/>
        <path d="M-26 -14L0 -36l26 22z" fill="#ff5fae" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
        <rect x="-6" y="0" width="12" height="16" rx="3" fill="#3d8bff" stroke="${INK}" stroke-width="2.5"/>`;
    case 'flag':
      return `<path d="M0 20V-30" stroke="${INK}" stroke-width="3"/><path d="M0 -30l26 8-26 9z" fill="#ffc531" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
    default:
      return '';
  }
}

function el(tag, attrs = {}, html) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html != null) e.innerHTML = html;
  return e;
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class GameBoard {
  constructor(root) {
    this.root = root;
    this.svg = el('svg', { class: 'board-svg', preserveAspectRatio: 'xMidYMid meet' });
    root.appendChild(this.svg);
    this.boardKey = null;
    this.tokens = new Map(); // playerId → { g, tileId, anim }
    this.lastAnimId = null;
    this.firstState = true;
    this.cam = { x: 0, y: 0, w: 1600, h: 1000 };
    this.camTarget = { ...this.cam };
    this.state = null;
    this.seenEvents = 0;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ---- construcción estática ------------------------------------------------

  build(board) {
    this.svg.innerHTML = '';
    this.board = board;
    const tiles = Object.values(board.tiles);
    const pts = tiles.map((t) => [t.x, t.y]);
    const H = hull(pts);
    const hullPath = `M${H.map((p) => p.join(',')).join('L')}Z`;
    this.hullPoly = H;

    // Mar + nubes
    const bg = el('g', { class: 'layer-bg' });
    bg.appendChild(el('rect', { x: -900, y: -700, width: 3400, height: 2400, fill: '#7fd0ff' }));
    const rnd = lcg(7);
    let waves = '';
    for (let i = 0; i < 70; i++) {
      const x = -800 + rnd() * 3200;
      const y = -600 + rnd() * 2200;
      waves += `<path d="M${x} ${y}q12 -8 24 0t24 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".45"/>`;
    }
    bg.insertAdjacentHTML('beforeend', waves);
    this.svg.appendChild(bg);

    // Isla: acantilado + pasto + tintes de región
    const land = el('g', { class: 'layer-land' });
    land.appendChild(el('path', { d: hullPath, transform: 'translate(0 34)', fill: '#c98a4f', stroke: '#c98a4f', 'stroke-width': 230, 'stroke-linejoin': 'round' }));
    land.appendChild(el('path', { d: hullPath, transform: 'translate(0 34)', fill: 'none', stroke: INK, 'stroke-width': 236, 'stroke-linejoin': 'round', opacity: 0.0 }));
    land.appendChild(el('path', { d: hullPath, fill: '#7fdc6a', stroke: '#7fdc6a', 'stroke-width': 220, 'stroke-linejoin': 'round' }));
    // borde de espuma
    land.insertBefore(el('path', { d: hullPath, transform: 'translate(0 40)', fill: 'none', stroke: '#e8f8ff', 'stroke-width': 262, 'stroke-linejoin': 'round', opacity: 0.8 }), land.firstChild);
    const bySeg = {};
    for (const id of board.order) (bySeg[board.tiles[id].segment] ||= []).push(board.tiles[id]);
    for (const seg of Object.values(bySeg)) {
      const d = `M${seg.map((t) => `${t.x},${t.y}`).join('L')}`;
      land.appendChild(el('path', { d, fill: 'none', stroke: REGION_TINT[seg[0].region], 'stroke-width': 150, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.55 }));
    }
    this.svg.appendChild(land);

    // Lago central con fuente de Pemolares + volcán
    const marks = el('g', { class: 'layer-marks' });
    marks.innerHTML = `
      <g transform="translate(830 585)">
        <ellipse rx="190" ry="98" fill="#4fb8ff" stroke="${INK}" stroke-width="5"/>
        <ellipse rx="160" ry="76" fill="#7fd0ff"/>
        <path d="M-120 -10q20 -12 40 0t40 0M30 30q20 -12 40 0t40 0" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/>
        <ellipse cx="0" cy="18" rx="48" ry="16" fill="#9b8bb8" stroke="${INK}" stroke-width="4"/>
        <rect x="-12" y="-40" width="24" height="58" rx="6" fill="#b8a9d6" stroke="${INK}" stroke-width="4"/>
        <g transform="translate(0 -82)"><circle r="40" fill="#d98a00" stroke="${INK}" stroke-width="5" transform="translate(4 6)"/><circle r="40" fill="#ffc94a" stroke="${INK}" stroke-width="5"/><circle r="29" fill="#ffd977" stroke="#e8a51c" stroke-width="4"/>
          <ellipse cy="9" rx="12" ry="10" fill="#e8a51c"/><ellipse cx="-14" cy="-5" rx="5" ry="7" fill="#e8a51c"/><ellipse cx="-5" cy="-14" rx="5" ry="7" fill="#e8a51c"/><ellipse cx="5" cy="-14" rx="5" ry="7" fill="#e8a51c"/><ellipse cx="14" cy="-5" rx="5" ry="7" fill="#e8a51c"/></g>
        <text y="80" text-anchor="middle" class="board-label">Fuente Pemolar</text>
      </g>
      <g transform="translate(430 262)">
        <path d="M-130 50L-40 -60h80L130 50z" fill="#e0894f" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M-40 -60c10 18 22 10 30 22s20-4 28 6 14-2 22-28z" fill="#fff4f9" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        <ellipse cy="-62" rx="40" ry="10" fill="#ff8cc6" stroke="${INK}" stroke-width="4"/>
        <circle cx="-20" cy="-96" r="14" fill="#fff4f9" stroke="${INK}" stroke-width="3"/><circle cx="8" cy="-112" r="18" fill="#fff4f9" stroke="${INK}" stroke-width="3"/><circle cx="30" cy="-92" r="12" fill="#fff4f9" stroke="${INK}" stroke-width="3"/>
      </g>`;
    this.svg.appendChild(marks);

    // Decoraciones procedurales (deterministas)
    const decor = el('g', { class: 'layer-decor' });
    const rd = lcg(board.order.length * 97 + 13);
    const avoid = [[830, 585, 230], [430, 262, 150]];
    const placed = [];
    let html = '';
    const minX = Math.min(...H.map((p) => p[0])) - 90;
    const maxX = Math.max(...H.map((p) => p[0])) + 90;
    const minY = Math.min(...H.map((p) => p[1])) - 90;
    const maxY = Math.max(...H.map((p) => p[1])) + 90;
    for (let i = 0; i < 900 && placed.length < 85; i++) {
      const p = [minX + rd() * (maxX - minX), minY + rd() * (maxY - minY)];
      const nearHull = inPoly(p, H) || H.some((h, k) => {
        const q = H[(k + 1) % H.length];
        const L = Math.hypot(q[0] - h[0], q[1] - h[1]) || 1;
        const u = Math.max(0, Math.min(1, ((p[0] - h[0]) * (q[0] - h[0]) + (p[1] - h[1]) * (q[1] - h[1])) / (L * L)));
        return Math.hypot(p[0] - (h[0] + u * (q[0] - h[0])), p[1] - (h[1] + u * (q[1] - h[1]))) < 80;
      });
      if (!nearHull) continue;
      let near = null;
      let nd = Infinity;
      for (const t of tiles) {
        const dd = Math.hypot(t.x - p[0], t.y - p[1]);
        if (dd < nd) { nd = dd; near = t; }
      }
      if (nd < 62) continue;
      if (avoid.some(([ax, ay, ar]) => Math.hypot(ax - p[0], (ay - p[1]) * 1.6) < ar)) continue;
      if (placed.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 58)) continue;
      // no sobre las líneas del camino
      if (board.edges.some(([a, b]) => {
        const A = board.tiles[a];
        const B = board.tiles[b];
        const L = Math.hypot(B.x - A.x, B.y - A.y) || 1;
        const u = Math.max(0, Math.min(1, ((p[0] - A.x) * (B.x - A.x) + (p[1] - A.y) * (B.y - A.y)) / (L * L)));
        return Math.hypot(p[0] - (A.x + u * (B.x - A.x)), p[1] - (A.y + u * (B.y - A.y))) < 46;
      })) continue;
      placed.push(p);
      const kinds = REGION_DECOR[near.region];
      const kind = kinds[Math.floor(rd() * kinds.length)];
      html += `<g transform="translate(${p[0].toFixed(0)} ${p[1].toFixed(0)}) scale(${(0.85 + rd() * 0.4).toFixed(2)})">${decorSvg(kind, near.region, rd())}</g>`;
    }
    decor.innerHTML = html;
    this.decorLayer = decor;

    // Caminos
    const road = el('g', { class: 'layer-road' });
    let edges = '';
    for (const [a, b] of board.edges) {
      const A = board.tiles[a];
      const B = board.tiles[b];
      edges += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/>`;
    }
    road.innerHTML = `<g stroke="#b9854d" stroke-width="44" stroke-linecap="round">${edges}</g>
      <g stroke="#f7e3b0" stroke-width="32" stroke-linecap="round">${edges}</g>`;
    // flechas de dirección
    let arrows = '';
    for (const [a, b] of board.edges) {
      const A = board.tiles[a];
      const B = board.tiles[b];
      const ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2;
      arrows += `<path d="M-5 -6l7 6-7 6" transform="translate(${mx} ${my}) rotate(${ang})" fill="none" stroke="#d9a866" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    road.insertAdjacentHTML('beforeend', arrows);
    this.svg.appendChild(road);
    this.svg.appendChild(decor);

    // Casillas
    const tl = el('g', { class: 'layer-tiles' });
    this.tileEls = {};
    for (const t of tiles) {
      const g = el('g', { class: `tile tile-${t.type}`, transform: `translate(${t.x} ${t.y})`, 'data-tile': t.id });
      g.innerHTML = this.tileMarkup(t);
      tl.appendChild(g);
      this.tileEls[t.id] = g;
    }
    this.svg.appendChild(tl);

    // Letreros de región
    const labels = el('g', { class: 'layer-labels' });
    let lab = '';
    for (const seg of Object.values(bySeg)) {
      const mid = seg[Math.floor(seg.length / 2)];
      const name = board.regions[mid.region]?.name;
      const dx = mid.x > 800 ? 1 : -1;
      const dy = mid.y > 500 ? 1 : -1;
      const lx = mid.x + dx * 6;
      const ly = mid.y + dy * 74;
      lab += `<g transform="translate(${lx} ${ly})"><rect x="${-name.length * 7.2 - 16}" y="-19" width="${name.length * 14.4 + 32}" height="34" rx="17" fill="#fff" stroke="${INK}" stroke-width="3.5"/><text y="7" text-anchor="middle" class="board-label">${esc(name)}</text></g>`;
    }
    labels.innerHTML = lab;
    this.svg.appendChild(labels);

    this.fxLayer = el('g', { class: 'layer-fx' });
    this.tokenLayer = el('g', { class: 'layer-tokens' });
    this.uiLayer = el('g', { class: 'layer-ui' });
    this.svg.appendChild(this.fxLayer);
    this.svg.appendChild(this.tokenLayer);
    this.svg.appendChild(this.uiLayer);
    this.tokens.clear();
  }

  tileMarkup(t) {
    const st = TILE_STYLE[t.type] || TILE_STYLE.pemolar_plus;
    const big = t.type === 'shop' || t.type === 'start';
    const rx = big ? 34 : 27;
    const ry = big ? 25 : 20;
    let extra = '';
    if (t.type === 'shop') {
      extra = `<g transform="translate(0 -46)">
        <rect x="-30" y="-6" width="60" height="34" rx="5" fill="#fff4e0" stroke="${INK}" stroke-width="3"/>
        <rect x="-12" y="8" width="24" height="20" rx="3" fill="#7a5cff" stroke="${INK}" stroke-width="2.5"/>
        <path d="M-36 -6h72l-6-16h-60z" fill="#ff5fae" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M-24 -22l-4 16M-8 -22l-2 16M8 -22l2 16M24 -22l4 16" stroke="#fff" stroke-width="5"/>
        <g transform="translate(0 -40) scale(1.25)"><path d="M0-11l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L0 5.5-6.5 8.9l1.3-7.2-5.3-5.1 7.3-1z" fill="#ffc531" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></g>
      </g>`;
    }
    if (t.type === 'start') {
      extra = `<g transform="translate(0 -40)"><path d="M-40 18v-28a40 26 0 0 1 80 0v28" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M-40 18v-28a40 26 0 0 1 80 0v28" fill="none" stroke="#ffc531" stroke-width="6" stroke-linecap="round"/><text y="-22" text-anchor="middle" class="board-label small">SALIDA</text></g>`;
    }
    return `<ellipse class="tile-halo" rx="${rx + 14}" ry="${ry + 11}" cy="2"/>
      <ellipse rx="${rx + 2}" ry="${ry + 2}" cy="11" fill="rgba(42,29,92,.28)"/>
      <ellipse rx="${rx}" ry="${ry}" cy="7" fill="${st.side}" stroke="${INK}" stroke-width="3.5"/>
      <ellipse rx="${rx}" ry="${ry}" fill="${st.top}" stroke="${INK}" stroke-width="3.5"/>
      <ellipse rx="${rx - 8}" ry="${ry - 9}" cy="-5" fill="#fff" opacity=".22"/>
      <g transform="scale(${big ? 1.2 : 1})">${tileGlyph(t.type)}</g>
      ${extra}`;
  }

  // ---- estado dinámico -------------------------------------------------------

  setState(state) {
    this.state = state;
    if (!state.board) {
      this.svg.style.visibility = 'hidden';
      return;
    }
    this.svg.style.visibility = '';
    const key = `${state.createdAt}|${state.board.order.join(',')}`;
    if (key !== this.boardKey) {
      this.boardKey = key;
      this.build(state.board);
      this.firstState = true;
    }
    // fichas
    for (const id of state.order) {
      if (!this.tokens.has(id)) {
        const p = state.players[id];
        const g = el('g', { class: 'token', 'data-player': id });
        g.innerHTML = `<g class="token-bob"><g class="token-marker"><path d="M-12 -14h24l-12 14z" fill="${p.color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g><g transform="translate(-28 -66) scale(.56)">${beanInner(p.color, p.hat)}</g></g><g class="token-steps"></g>`;
        this.tokenLayer.appendChild(g);
        this.tokens.set(id, { g, tileId: p.tileId, anim: null, x: 0, y: 0 });
      }
    }
    // animación nueva
    if (state.anim && state.anim.id !== this.lastAnimId) {
      const a = state.anim;
      this.lastAnimId = a.id;
      const tok = this.tokens.get(a.playerId);
      if (tok && !this.firstState && a.path.length) {
        tok.anim = { ...a, start: performance.now(), from: tok.tileId };
      }
    }
    // sin animación: sincroniza posiciones
    for (const [id, tok] of this.tokens) {
      const p = state.players[id];
      if (!p) continue;
      if (!tok.anim) tok.tileId = p.tileId;
      tok.g.classList.toggle('is-current', id === state.currentPlayerId && !['LOBBY', 'MINIGAME_INTRO', 'MINIGAME_PLAYING', 'MINIGAME_RESULTS'].includes(state.phase));
    }
    // resaltados de ruta
    for (const g of Object.values(this.tileEls)) g.classList.remove('is-option', 'is-here');
    this.uiLayer.innerHTML = '';
    if (state.phase === 'ROUTE_CHOICE' && state.pending) {
      state.pending.options.forEach((o, i) => {
        this.tileEls[o.to]?.classList.add('is-option');
        const t = state.board.tiles[o.to];
        this.uiLayer.insertAdjacentHTML('beforeend', `<g class="route-badge" transform="translate(${t.x} ${t.y - 48})"><circle r="22" fill="${i ? '#3d8bff' : '#ff5fae'}" stroke="${INK}" stroke-width="4"/><text y="9" text-anchor="middle" class="board-badge">${'AB'[i]}</text></g>`);
      });
    }
    const cur = state.players[state.currentPlayerId];
    if (cur && this.tileEls[cur.tileId] && !['LOBBY', 'MINIGAME_INTRO', 'MINIGAME_PLAYING', 'MINIGAME_RESULTS'].includes(state.phase)) {
      this.tileEls[cur.tileId].classList.add('is-here');
    }
    // textos flotantes por cambios de moneda
    if (this.firstState) this.seenEvents = state.eventSeq;
    for (const ev of state.events) {
      if (ev.id <= this.seenEvents) continue;
      this.seenEvents = Math.max(this.seenEvents, ev.id);
      if (ev.type === 'currency') this.floatText(ev.playerId, `${ev.delta > 0 ? '+' : ''}${ev.delta}`, ev.currency);
      if (ev.type === 'shield') this.floatText(ev.playerId, 'ESCUDO', 'shield');
    }
    this.firstState = false;
  }

  floatText(playerId, text, kind) {
    const tok = this.tokens.get(playerId);
    if (!tok) return;
    const color = kind === 'perritas' ? '#ffc531' : kind === 'shield' ? '#8fd8ff' : text.startsWith('-') ? '#ff4d5e' : '#ffd23f';
    const icon = kind === 'perritas'
      ? `<path d="M0-11l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L0 5.5-6.5 8.9l1.3-7.2-5.3-5.1 7.3-1z" fill="#ffc531" stroke="${INK}" stroke-width="2" stroke-linejoin="round" transform="translate(-30 -6) scale(1.3)"/>`
      : kind === 'shield' ? '' : `<circle cx="-30" cy="-7" r="12" fill="#ffc94a" stroke="${INK}" stroke-width="3"/>`;
    const g = el('g', { transform: `translate(${tok.x} ${tok.y - 86})` });
    g.innerHTML = `<g class="float-up">${icon}<text x="${kind === 'shield' ? 0 : -12}" y="8" text-anchor="${kind === 'shield' ? 'middle' : 'start'}" class="float-text" fill="${color}">${esc(text)}</text></g>`;
    this.fxLayer.appendChild(g);
    setTimeout(() => g.remove(), 1700);
  }

  // ---- cámara y animación por cuadro -------------------------------------------

  tilePos(id) {
    const t = this.board?.tiles[id];
    return t ? [t.x, t.y] : [0, 0];
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    const s = this.state;
    if (!s?.board || !this.board) return;
    const groups = {};
    for (const [id, tok] of this.tokens) {
      let x;
      let y;
      let lift = 0;
      let scale = 1;
      const a = tok.anim;
      if (a) {
        const stepMs = this.reduced ? Math.min(a.stepMs, 120) : a.stepMs;
        const t = now - a.start - a.delay;
        const n = a.path.length;
        if (t < 0) {
          [x, y] = this.tilePos(a.from);
        } else if (a.warp) {
          const f = Math.min(1, t / stepMs);
          const [x0, y0] = this.tilePos(a.from);
          const [x1, y1] = this.tilePos(a.path[0]);
          x = x0 + (x1 - x0) * ease(f);
          y = y0 + (y1 - y0) * ease(f);
          lift = Math.sin(Math.PI * f) * 260;
          scale = 1 + Math.sin(Math.PI * f) * 0.4;
          if (f >= 1) { tok.anim = null; tok.tileId = a.path[0]; }
        } else {
          const i = Math.floor(t / stepMs);
          if (i >= n) {
            tok.anim = null;
            tok.tileId = a.path[n - 1];
            [x, y] = this.tilePos(tok.tileId);
          } else {
            const [x0, y0] = this.tilePos(i === 0 ? a.from : a.path[i - 1]);
            const [x1, y1] = this.tilePos(a.path[i]);
            const f = (t - i * stepMs) / stepMs;
            const e = ease(f);
            x = x0 + (x1 - x0) * e;
            y = y0 + (y1 - y0) * e;
            lift = Math.sin(Math.PI * f) * 34;
          }
          tok.stepsDone = Math.max(0, Math.min(n, Math.floor(Math.max(0, t) / stepMs)));
        }
      }
      if (!tok.anim && x === undefined) {
        [x, y] = this.tilePos(tok.tileId);
        (groups[tok.tileId] ||= []).push(id);
      }
      tok.x = x;
      tok.y = y;
      tok.lift = lift;
      tok.scale = scale;
    }
    // separa fichas que comparten casilla
    for (const ids of Object.values(groups)) {
      if (ids.length < 2) continue;
      ids.forEach((id, i) => {
        const tok = this.tokens.get(id);
        const ang = (i / ids.length) * Math.PI * 2 - Math.PI / 2;
        tok.x += Math.cos(ang) * 22;
        tok.y += Math.sin(ang) * 12 + 4;
      });
    }
    // orden por profundidad y transformaciones
    const sorted = [...this.tokens.entries()].sort((a, b) => a[1].y - b[1].y);
    for (const [id, tok] of sorted) {
      const cur = id === s.currentPlayerId;
      tok.g.setAttribute('transform', `translate(${tok.x.toFixed(1)} ${(tok.y - tok.lift).toFixed(1)}) scale(${((cur ? 1.12 : 0.95) * tok.scale).toFixed(3)})`);
      this.tokenLayer.appendChild(tok.g);
      // contador de pasos restantes
      const stepsEl = tok.g.querySelector('.token-steps');
      let label = '';
      if (cur && s.move && ['MOVEMENT', 'ROUTE_CHOICE', 'SHOP'].includes(s.phase) && !(tok.anim && tok.anim.warp)) {
        const n = tok.anim ? tok.anim.path.length : 0;
        const left = s.move.stepsLeft + (tok.anim ? n - (tok.stepsDone || 0) : 0);
        if (left > 0 && !(tok.anim && now - tok.anim.start < tok.anim.delay)) label = String(left);
      }
      if (stepsEl.dataset.v !== label) {
        stepsEl.dataset.v = label;
        stepsEl.innerHTML = label ? `<g transform="translate(0 -104)"><circle r="24" fill="#fff" stroke="${INK}" stroke-width="4.5"/><text y="11" text-anchor="middle" class="board-steps">${label}</text></g>` : '';
      }
    }
    this.updateCamera(now);
  }

  focusTarget() {
    const s = this.state;
    const overview = ['LOBBY', 'BOARD_INTRO', 'MINIGAME_INTRO', 'MINIGAME_PLAYING', 'MINIGAME_RESULTS', 'BOARD_END', 'FINAL_BONUSES', 'FINAL_LEADERBOARD', 'WINNER_REVEAL'];
    if (!s.currentPlayerId || overview.includes(s.phase)) return null;
    const tok = this.tokens.get(s.currentPlayerId);
    if (!tok) return null;
    return { x: tok.x, y: tok.y - 40, w: s.phase === 'ROUTE_CHOICE' ? 1400 : 1180 };
  }

  updateCamera() {
    const rect = this.root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // zona útil: descuenta el HUD (derecha en TV, abajo en pantallas angostas)
    const ins = this.getInsets ? this.getInsets() : { right: 0, bottom: 0 };
    const uw = Math.max(200, rect.width - ins.right);
    const uh = Math.max(200, rect.height - ins.bottom);
    const aspect = uw / uh;
    const f = this.focusTarget();
    const bw = this.board.width + 160;
    const bh = this.board.height + 160;
    let w;
    let h;
    let cx;
    let cy;
    if (!f) {
      if (bw / bh > aspect) { w = bw; h = bw / aspect; } else { h = bh; w = bh * aspect; }
      cx = this.board.width / 2;
      cy = this.board.height / 2 + 10;
    } else {
      w = Math.min(f.w, bw);
      h = w / aspect;
      if (h > bh) { h = bh; w = h * aspect; }
      cx = Math.max(w / 2 - 80, Math.min(this.board.width + 80 - w / 2, f.x));
      cy = Math.max(h / 2 - 80, Math.min(this.board.height + 80 - h / 2, f.y));
    }
    // expande a todo el lienzo manteniendo el centro dentro de la zona útil
    const kx = rect.width / uw;
    const ky = rect.height / uh;
    const fullW = w * kx;
    const fullH = h * ky;
    cx += (fullW - w) / 2;
    cy += (fullH - h) / 2;
    w = fullW;
    h = fullH;
    const T = { x: cx - w / 2, y: cy - h / 2, w, h };
    const k = this.reduced ? 1 : 0.07;
    const c = this.cam;
    if (!this.camInit) { Object.assign(c, T); this.camInit = true; }
    c.x += (T.x - c.x) * k;
    c.y += (T.y - c.y) * k;
    c.w += (T.w - c.w) * k;
    c.h += (T.h - c.h) * k;
    this.svg.setAttribute('viewBox', `${c.x.toFixed(1)} ${c.y.toFixed(1)} ${c.w.toFixed(1)} ${c.h.toFixed(1)}`);
  }
}
