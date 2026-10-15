// GameBoard · BoardTile · PlayerToken · BoardCameraController
// Dibuja el tablero (isla industrial "Isla Pemol") a partir de los datos del
// servidor. No contiene reglas.

import { TILE_STYLE, tileGlyph, esc, CHAR_SRC, companionInner, DOG_PATH } from './assets.js';

const NS = 'http://www.w3.org/2000/svg';
const INK = '#1b2440';

// Tintes del suelo por región (tonos industriales)
const REGION_TINT = {
  muelle: '#9aa3a8',
  bodegas: '#a89a7c',
  safari: '#9fae5a',
  terminal: '#8c97a3',
  faro: '#b9ab8a',
  escuela: '#b5c48a',
  disco: '#6d6582',
};
const REGION_DECOR = {
  muelle: ['containers', 'crates', 'barrels'],
  bodegas: ['crates', 'containers', 'barrels', 'bush'],
  safari: ['acacia', 'acacia', 'bush', 'rock'],
  terminal: ['antenna', 'crates', 'rock'],
  faro: ['rock', 'rock', 'bush'],
  escuela: ['tree', 'tree', 'bush'],
  disco: ['palm', 'barrels', 'bush'],
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

// Caja isométrica: base centrada en (0,0), ancho w, fondo d, alto h.
function iso(w, d, h, { top = '#cfd4da', left = '#9aa3ad', right = '#7d8691', stroke = INK, roof = '' } = {}) {
  const hw = w / 2;
  const hd = d / 2;
  const T = [[0, -hd - h], [hw, -h], [0, hd - h], [-hw, -h]];
  const pts = (arr) => arr.map((q) => q.join(',')).join(' ');
  return `<polygon points="${pts([[-hw, -h], [0, hd - h], [0, hd], [-hw, 0]])}" fill="${left}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="${pts([[hw, -h], [0, hd - h], [0, hd], [hw, 0]])}" fill="${right}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="${pts(T)}" fill="${top}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>${roof}`;
}
const windows = (n, x0, y0, dx, dy, c = '#ffe08a') => Array.from({ length: n }, (_, i) => `<rect x="${x0 + i * dx}" y="${y0 + i * dy}" width="6" height="8" fill="${c}" transform="skewY(${dy > 0 ? 26 : -26})"/>`).join('');

function decorSvg(kind, region, r) {
  switch (kind) {
    case 'containers': {
      const cs = ['#d9532b', '#2f6fe0', '#2e9c62', '#e0a12b'];
      const c1 = cs[Math.floor(r * 4)];
      const c2 = cs[Math.floor(r * 7) % 4];
      return `<g transform="translate(-10 4)">${iso(34, 16, 14, { top: c1, left: c1, right: c1 })}</g><g transform="translate(14 -4)">${iso(34, 16, 14, { top: c2, left: c2, right: c2 })}</g>
        <path d="M-24 -2l6 3M-18 -4l6 3" stroke="rgba(0,0,0,.35)" stroke-width="2"/>`;
    }
    case 'crates':
      return `<g transform="translate(-8 4)">${iso(18, 12, 12, { top: '#d8a868', left: '#b9853f', right: '#9a6b2e' })}</g><g transform="translate(10 2)">${iso(16, 11, 10, { top: '#d8a868', left: '#b9853f', right: '#9a6b2e' })}</g>`;
    case 'barrels':
      return `<g fill="#3a5f8f" stroke="${INK}" stroke-width="2.5"><rect x="-16" y="-14" width="13" height="18" rx="4"/><rect x="0" y="-12" width="13" height="18" rx="4"/></g><path d="M-16 -6h13M0 -4h13" stroke="${INK}" stroke-width="2"/>`;
    case 'bush':
      return `<ellipse cx="-8" cy="0" rx="12" ry="9" fill="#5f8a3c" stroke="${INK}" stroke-width="2.5"/><ellipse cx="8" cy="-2" rx="13" ry="10" fill="#6f9a45" stroke="${INK}" stroke-width="2.5"/>`;
    case 'rock':
      return `<path d="M-20 10l6-18 14-6 16 8 6 16z" fill="#8a8f96" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-8 -8l9-4" stroke="#c4c9cf" stroke-width="3" stroke-linecap="round"/>`;
    case 'tree':
      return `<rect x="-4" y="-6" width="8" height="24" rx="3" fill="#7a5233" stroke="${INK}" stroke-width="2.5"/><circle cx="0" cy="-20" r="20" fill="#4f8a3a" stroke="${INK}" stroke-width="3"/><circle cx="-7" cy="-27" r="6" fill="#fff" opacity=".18"/>`;
    case 'acacia':
      return `<path d="M0 22V-4l-10-10M0-4l12-8" fill="none" stroke="#6b4a2b" stroke-width="5" stroke-linecap="round"/><ellipse cx="0" cy="-16" rx="30" ry="9" fill="#7c9a3a" stroke="${INK}" stroke-width="2.5"/>`;
    case 'palm':
      return `<path d="M0 20c2-14 0-26-4-38" fill="none" stroke="#7a5233" stroke-width="6" stroke-linecap="round"/><path d="M-4 -18c-14-6-22 0-26 6 10-6 18-4 26-6zM-4 -18c4-14 16-16 24-12-10 0-18 4-24 12zM-4 -18c14-2 22 6 24 14-8-8-16-10-24-14z" fill="#4f8a3a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
    case 'antenna':
      return `<path d="M0 18V-30M-10 18l10-30 10 30M-6 0h12" fill="none" stroke="#5d6670" stroke-width="3"/><circle cy="-32" r="4" fill="#ff4d5e" class="blink"/>`;
    default:
      return '';
  }
}

// Lugares emblemáticos (arte original)
function landmarks() {
  const prison = `<g transform="translate(830 600)">
      <path d="M-215 40L0 -70 215 40 0 150z" fill="#7d858c" stroke="${INK}" stroke-width="4"/>
      <path d="M-200 40L0 -62 200 40 0 142z" fill="none" stroke="#c9ced3" stroke-width="2" stroke-dasharray="6 6"/>
      <g transform="translate(-60 30)">${iso(170, 80, 46, { top: '#5e6770', left: '#bfc5ca', right: '#9aa2a9' })}${windows(7, -80, -26, 11, 5, '#2a3a52')}</g>
      <g transform="translate(-60 -22)"><path d="M-40 -52l40 -20 40 20 -40 20z" fill="#a9d4ff" stroke="${INK}" stroke-width="2.5"/><path d="M-30 -52l30-15M-15 -45l30-15M0 -38l30-15" stroke="#fff" stroke-width="2" opacity=".7"/></g>
      <g transform="translate(90 -10)">${iso(110, 70, 34, { top: '#69727b', left: '#c3c8cc', right: '#a0a7ad' })}</g>
      <g transform="translate(150 70)"><rect x="-6" y="-70" width="12" height="70" fill="#9aa3ad" stroke="${INK}" stroke-width="2.5"/>${iso(34, 22, 18, { top: '#5e6770', left: '#bfc5ca', right: '#9aa2a9' }).replace(/translate/g, 'translate')}</g>
      <g transform="translate(150 0)"><path d="M-20 -70h40v-16h-40z" fill="#5e6770" stroke="${INK}" stroke-width="2.5"/><path d="M-24 -86l24-10 24 10z" fill="#3b434b" stroke="${INK}" stroke-width="2.5"/><circle cx="0" cy="-78" r="3.5" fill="#ffe08a" class="blink"/></g>
      <g transform="translate(-170 -10)"><rect x="-5" y="-60" width="10" height="60" fill="#9aa3ad" stroke="${INK}" stroke-width="2.5"/><path d="M-18 -60h36v-14h-36z" fill="#5e6770" stroke="${INK}" stroke-width="2.5"/></g>
    </g>`;
  const water = `<g transform="translate(1025 430)">
      <path d="M-26 40l8-50M26 40l-8-50M-22 20h44M-24 30l48-20" fill="none" stroke="#6b737b" stroke-width="4"/>
      <rect x="-30" y="-46" width="60" height="38" rx="6" fill="#c84a2c" stroke="${INK}" stroke-width="3"/>
      <path d="M-34 -46l34-20 34 20z" fill="#9e3820" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <text y="-21" text-anchor="middle" class="board-mini">AGUA</text>
    </g>`;
  const terminal = `<g transform="translate(905 300)">
      ${iso(130, 70, 36, { top: '#47515c', left: '#a8b1b9', right: '#86909a' })}
      ${windows(6, -60, -24, 10, 5, '#5ad1ff')}
      <path d="M30 -60l14-26M44 -86a14 14 0 1 0 0.1 0" fill="none" stroke="#c9ced3" stroke-width="3"/>
      <circle cx="44" cy="-86" r="4" fill="#5ad1ff" class="blink"/>
    </g>`;
  const lighthouse = `<g transform="translate(70 230)">
      <path d="M-14 40l6-80h16l6 80z" fill="#fff" stroke="${INK}" stroke-width="3"/>
      <path d="M-12 14h24M-10 -12h20" stroke="#d9332b" stroke-width="10"/>
      <rect x="-12" y="-56" width="24" height="16" fill="#ffe08a" stroke="${INK}" stroke-width="3"/>
      <path d="M-14 -56l14-12 14 12z" fill="#d9332b" stroke="${INK}" stroke-width="3"/>
      <path d="M12 -48l140-40v60z" fill="#fff6b0" opacity=".25" class="beam"/>
    </g>`;
  const escuela = `<g transform="translate(430 262)">
      <path d="M-120 34L0 -26 120 34 0 94z" fill="#c9b98a" stroke="${INK}" stroke-width="3"/>
      <g transform="translate(-10 20)">${iso(170, 70, 50, { top: '#b84a3a', left: '#f1e6cf', right: '#d8cbae' })}${windows(6, -76, -30, 12, 6, '#7fb2ff')}</g>
      <circle cx="-10" cy="-52" r="12" fill="#fff" stroke="${INK}" stroke-width="3"/><path d="M-10 -52v-7M-10 -52l5 3" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
      <g transform="translate(-10 -78)"><rect x="-74" y="-16" width="148" height="28" rx="6" fill="#1f4fbf" stroke="${INK}" stroke-width="3"/><text y="5" text-anchor="middle" class="board-sign">ESCUELA PIAGET</text></g>
      <g transform="translate(100 10)"><path d="M0 30V-50" stroke="#8a8f96" stroke-width="4"/><path d="M0 -50h30v18H0z" fill="#2ecc8f" stroke="${INK}" stroke-width="2.5"/></g>
    </g>`;
  const disco = `<g transform="translate(300 640)">
      <path d="M-56 -30l-60-170M56 -30l70-160" stroke="url(#beam)" stroke-width="28" class="spot" opacity=".55"/>
      <g transform="translate(0 30)">${iso(150, 80, 52, { top: '#2a2438', left: '#3d3550', right: '#2f2942' })}</g>
      <g transform="translate(0 -40)"><rect x="-70" y="-20" width="140" height="34" rx="8" fill="#140f22" stroke="#ff4fd8" stroke-width="3"/><text y="7" text-anchor="middle" class="board-neon">LA PÉREZ</text></g>
      <g fill="#6ff0ff" class="blink"><circle cx="-40" cy="20" r="3"/><circle cx="-20" cy="30" r="3"/><circle cx="30" cy="22" r="3"/></g>
      <g transform="translate(-30 74)" fill="${INK}">${[0, 1, 2, 3].map((i) => `<ellipse cx="${i * 14}" cy="${i * 4}" rx="5" ry="9"/>`).join('')}</g>
    </g>`;
  const safari = `<g transform="translate(1300 560)">
      <ellipse rx="110" ry="74" fill="#c8b46a" stroke="${INK}" stroke-width="3"/>
      <ellipse rx="110" ry="74" fill="none" stroke="#7a5233" stroke-width="6" stroke-dasharray="3 10"/>
      <g transform="translate(-30 10)"><rect x="-26" y="-14" width="52" height="22" rx="5" fill="#d9a441" stroke="${INK}" stroke-width="2.5"/><rect x="-14" y="-26" width="26" height="14" rx="3" fill="#a9d4ff" stroke="${INK}" stroke-width="2.5"/><circle cx="-14" cy="10" r="7" fill="#333" stroke="${INK}" stroke-width="2"/><circle cx="14" cy="10" r="7" fill="#333" stroke="${INK}" stroke-width="2"/></g>
      <g transform="translate(45 -15)"><path d="M0 26V-10l-12-12M0 -10l14-8" fill="none" stroke="#6b4a2b" stroke-width="5" stroke-linecap="round"/><ellipse cx="0" cy="-22" rx="30" ry="9" fill="#7c9a3a" stroke="${INK}" stroke-width="2.5"/></g>
      <g transform="translate(0 -88)"><rect x="-52" y="-16" width="104" height="28" rx="4" fill="#5a3a1c" stroke="${INK}" stroke-width="3"/><text y="5" text-anchor="middle" class="board-sign">SAFARI</text></g>
    </g>`;
  const dock = `<g transform="translate(640 980)">
      <rect x="-180" y="-30" width="360" height="26" fill="#8a6a46" stroke="${INK}" stroke-width="3"/>
      <path d="M-170 -4v20M-110 -4v20M-50 -4v20M10 -4v20M70 -4v20M130 -4v20" stroke="#5a4028" stroke-width="5"/>
      <g transform="translate(-40 60)"><path d="M-170 0h320l-30 40h-270z" fill="#b8352b" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><rect x="60" y="-40" width="60" height="40" fill="#e8e8e8" stroke="${INK}" stroke-width="3"/>
        ${[0, 1, 2, 3].map((i) => `<rect x="${-150 + i * 46}" y="-22" width="40" height="22" fill="${['#2f6fe0', '#2e9c62', '#e0a12b', '#d9532b'][i]}" stroke="${INK}" stroke-width="2"/>`).join('')}</g>
      <g transform="translate(170 -40)"><path d="M0 0v-120M0 -120h-90M-90 -120v40" fill="none" stroke="#e0a12b" stroke-width="7"/><path d="M0 -120l-30 30" stroke="#e0a12b" stroke-width="4"/></g>
    </g>`;
  return prison + water + terminal + lighthouse + escuela + disco + safari + dock;
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
    this.state = null;
    this.seenEvents = 0;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ---- construcción estática ------------------------------------------------

  build(board) {
    this.svg.innerHTML = `<defs>
      <radialGradient id="sun" cx="0.12" cy="0.05" r="0.7"><stop offset="0" stop-color="#fff8d8" stop-opacity=".95"/><stop offset=".25" stop-color="#bfe3ff" stop-opacity=".35"/><stop offset="1" stop-color="#0b2a4a" stop-opacity="0"/></radialGradient>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b6a8f"/><stop offset="1" stop-color="#0b2f4f"/></linearGradient>
      <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff4fd8" stop-opacity=".9"/><stop offset="1" stop-color="#6ff0ff" stop-opacity="0"/></linearGradient>
    </defs>`;
    this.board = board;
    const tiles = Object.values(board.tiles);
    const pts = tiles.map((t) => [t.x, t.y]).concat([[830, 760], [640, 1010], [70, 230], [300, 720], [1300, 640]]);
    const H = hull(pts);
    const hullPath = `M${H.map((p) => p.join(',')).join('L')}Z`;
    this.hullPoly = H;

    // Mar oscuro con reflejo de sol
    const bg = el('g', { class: 'layer-bg' });
    bg.appendChild(el('rect', { x: -900, y: -700, width: 3400, height: 2400, fill: 'url(#sea)' }));
    const rnd = lcg(7);
    let waves = '';
    for (let i = 0; i < 90; i++) {
      const x = -800 + rnd() * 3200;
      const y = -600 + rnd() * 2200;
      waves += `<path d="M${x.toFixed(0)} ${y.toFixed(0)}q14 -6 28 0t28 0" fill="none" stroke="#9fd6ff" stroke-width="3" stroke-linecap="round" opacity=".3" class="wave" style="animation-delay:${(rnd() * 4).toFixed(2)}s"/>`;
    }
    bg.insertAdjacentHTML('beforeend', waves);
    this.svg.appendChild(bg);

    // Isla: espuma, acantilado rocoso, suelo
    const land = el('g', { class: 'layer-land' });
    land.appendChild(el('path', { d: hullPath, transform: 'translate(0 44)', fill: 'none', stroke: '#d6f0ff', 'stroke-width': 268, 'stroke-linejoin': 'round', opacity: 0.55 }));
    land.appendChild(el('path', { d: hullPath, transform: 'translate(0 36)', fill: '#5d6168', stroke: '#5d6168', 'stroke-width': 236, 'stroke-linejoin': 'round' }));
    land.appendChild(el('path', { d: hullPath, transform: 'translate(0 18)', fill: '#7b7f86', stroke: '#7b7f86', 'stroke-width': 228, 'stroke-linejoin': 'round' }));
    land.appendChild(el('path', { d: hullPath, fill: '#a3a98f', stroke: '#a3a98f', 'stroke-width': 220, 'stroke-linejoin': 'round' }));
    const bySeg = {};
    for (const id of board.order) (bySeg[board.tiles[id].segment] ||= []).push(board.tiles[id]);
    for (const seg of Object.values(bySeg)) {
      const d = `M${seg.map((t) => `${t.x},${t.y}`).join('L')}`;
      land.appendChild(el('path', { d, fill: 'none', stroke: REGION_TINT[seg[0].region] || '#a3a98f', 'stroke-width': 150, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.6 }));
    }
    this.svg.appendChild(land);

    const marks = el('g', { class: 'layer-marks' });
    marks.innerHTML = landmarks();

    // Decoraciones procedurales (deterministas)
    const decor = el('g', { class: 'layer-decor' });
    const rd = lcg(board.order.length * 97 + 13);
    const avoid = [[830, 600, 240], [1025, 430, 60], [905, 300, 90], [70, 230, 60], [430, 262, 140], [300, 640, 110], [1300, 560, 130], [640, 980, 200]];
    const placed = [];
    let html = '';
    const minX = Math.min(...H.map((p) => p[0])) - 90;
    const maxX = Math.max(...H.map((p) => p[0])) + 90;
    const minY = Math.min(...H.map((p) => p[1])) - 90;
    const maxY = Math.max(...H.map((p) => p[1])) + 90;
    const nearEdge = (p, A, B, lim) => {
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
      const u = Math.max(0, Math.min(1, ((p[0] - A[0]) * (B[0] - A[0]) + (p[1] - A[1]) * (B[1] - A[1])) / (L * L)));
      return Math.hypot(p[0] - (A[0] + u * (B[0] - A[0])), p[1] - (A[1] + u * (B[1] - A[1]))) < lim;
    };
    for (let i = 0; i < 900 && placed.length < 70; i++) {
      const p = [minX + rd() * (maxX - minX), minY + rd() * (maxY - minY)];
      const ok = inPoly(p, H) || H.some((h, k) => nearEdge(p, h, H[(k + 1) % H.length], 80));
      if (!ok) continue;
      let near = null;
      let nd = Infinity;
      for (const t of tiles) {
        const dd = Math.hypot(t.x - p[0], t.y - p[1]);
        if (dd < nd) { nd = dd; near = t; }
      }
      if (nd < 62) continue;
      if (avoid.some(([ax, ay, ar]) => Math.hypot(ax - p[0], (ay - p[1]) * 1.4) < ar)) continue;
      if (placed.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 58)) continue;
      if (board.edges.some(([a, b]) => nearEdge(p, [board.tiles[a].x, board.tiles[a].y], [board.tiles[b].x, board.tiles[b].y], 46))) continue;
      placed.push(p);
      const kinds = REGION_DECOR[near.region] || ['rock'];
      const kind = kinds[Math.floor(rd() * kinds.length)];
      html += `<g transform="translate(${p[0].toFixed(0)} ${p[1].toFixed(0)}) scale(${(0.85 + rd() * 0.35).toFixed(2)})">${decorSvg(kind, near.region, rd())}</g>`;
    }
    decor.innerHTML = html;

    // Caminos de tierra
    const road = el('g', { class: 'layer-road' });
    let edges = '';
    for (const [a, b] of board.edges) {
      const A = board.tiles[a];
      const B = board.tiles[b];
      edges += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/>`;
    }
    road.innerHTML = `<g stroke="#5f554a" stroke-width="44" stroke-linecap="round">${edges}</g>
      <g stroke="#c9b48e" stroke-width="32" stroke-linecap="round">${edges}</g>`;
    let arrows = '';
    for (const [a, b] of board.edges) {
      const A = board.tiles[a];
      const B = board.tiles[b];
      const ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
      arrows += `<path d="M-5 -6l7 6-7 6" transform="translate(${(A.x + B.x) / 2} ${(A.y + B.y) / 2}) rotate(${ang})" fill="none" stroke="#8d7a5c" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    road.insertAdjacentHTML('beforeend', arrows);
    this.svg.appendChild(road);
    this.svg.appendChild(decor);
    this.svg.appendChild(marks);

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

    // Letreros tipo señalización, con línea al lugar
    const labels = el('g', { class: 'layer-labels' });
    let lab = '';
    for (const seg of Object.values(bySeg)) {
      const mid = seg[Math.floor(seg.length / 2)];
      const nm = board.regions[mid.region]?.name;
      // la escuela, la disco y el safari ya tienen su propio letrero
      if (!nm || ['escuela', 'disco', 'safari'].includes(mid.region)) continue;
      const dx = mid.x > 800 ? 1 : -1;
      const dy = mid.y > 500 ? 1 : -1;
      const lx = mid.x + dx * 40;
      const ly = mid.y + dy * 86;
      const w = nm.length * 12 + 34;
      lab += `<path d="M${mid.x} ${mid.y + dy * 22}L${lx} ${ly - dy * 16}" stroke="#ff5a1f" stroke-width="3"/>
        <g transform="translate(${lx} ${ly})"><rect x="${-w / 2}" y="-17" width="${w}" height="32" rx="4" fill="#111827" stroke="#ff5a1f" stroke-width="3"/><text y="6" text-anchor="middle" class="board-label">${esc(nm.toUpperCase())}</text></g>`;
    }
    labels.innerHTML = lab;
    this.svg.appendChild(labels);

    this.fxLayer = el('g', { class: 'layer-fx' });
    this.tokenLayer = el('g', { class: 'layer-tokens' });
    this.uiLayer = el('g', { class: 'layer-ui' });
    this.svg.appendChild(this.fxLayer);
    this.svg.appendChild(this.tokenLayer);
    this.svg.appendChild(this.uiLayer);
    // reflejo de sol encima de todo
    this.svg.appendChild(el('rect', { x: -900, y: -700, width: 3400, height: 2400, fill: 'url(#sun)', 'pointer-events': 'none', class: 'sun' }));
    this.tokens.clear();
  }

  tileMarkup(t) {
    const st = TILE_STYLE[t.type] || TILE_STYLE.pemolar_plus;
    const big = ['shop', 'start', 'itemshop', 'safari'].includes(t.type);
    const rx = big ? 34 : 27;
    const ry = big ? 25 : 20;
    let extra = '';
    if (t.type === 'shop') {
      // búnker de Perritas
      extra = `<g transform="translate(0 -40)">${iso(64, 34, 26, { top: '#5e6770', left: '#8a939b', right: '#6d767e' })}
        <rect x="-38" y="-46" width="76" height="18" rx="3" fill="#111827" stroke="#ffb400" stroke-width="2.5"/>
        <text y="-33" text-anchor="middle" class="board-mini gold">PERRITAS</text>
        <g transform="translate(0 -62)"><circle r="12" fill="#ffb400" stroke="${INK}" stroke-width="2.5"/><g transform="translate(-10 -10) scale(.32)"><path d="${DOG_PATH}" fill="#c97000"/></g></g></g>`;
    }
    if (t.type === 'itemshop') {
      // puesto de contrabando con toldo
      extra = `<g transform="translate(0 -38)" class="stall">
        <rect x="-28" y="-22" width="56" height="26" rx="3" fill="#2f3a48" stroke="${INK}" stroke-width="2.5"/>
        <path d="M-34 -22h68l-6-14h-56z" fill="#16b8a6" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M-24 -36l-3 14M-8 -36l-1 14M8 -36l1 14M24 -36l3 14" stroke="#fff" stroke-width="4"/>
        <rect x="-20" y="-14" width="12" height="12" rx="3" fill="#0d0f17" stroke="#7fb2ff" stroke-width="1.5"/><rect x="-4" y="-14" width="10" height="12" fill="#3d8bff"/><path d="M10 -14h10l-1 12h-8z" fill="#e8f4ff"/>
        <text y="-42" text-anchor="middle" class="board-mini">OBJETOS</text></g>`;
    }
    if (t.type === 'start') {
      extra = `<g transform="translate(0 -40)"><path d="M-40 18v-28a40 26 0 0 1 80 0v28" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M-40 18v-28a40 26 0 0 1 80 0v28" fill="none" stroke="#ff5a1f" stroke-width="6" stroke-linecap="round"/><text y="-22" text-anchor="middle" class="board-label small">SALIDA</text></g>`;
    }
    return `<ellipse class="tile-halo" rx="${rx + 14}" ry="${ry + 11}" cy="2"/>
      <ellipse rx="${rx + 2}" ry="${ry + 2}" cy="11" fill="rgba(0,0,0,.35)"/>
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
        this.tokenLayer.appendChild(g);
        this.tokens.set(id, { g, tileId: p.tileId, anim: null, x: 0, y: 0, look: null });
      }
      const tok = this.tokens.get(id);
      const p = state.players[id];
      const look = `${p.char}|${p.companion || ''}|${p.color}`;
      if (tok.look !== look) {
        tok.look = look;
        tok.g.innerHTML = `<ellipse class="token-ring" rx="24" ry="9" cy="-2" fill="none" stroke="${p.color}" stroke-width="5"/>
          <g class="token-bob"><g class="token-marker"><path d="M-12 -14h24l-12 14z" fill="${p.color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g>
          ${p.companion ? `<g transform="translate(14 -58) scale(.6)">${companionInner(p.companion)}</g>` : ''}
          <image href="${CHAR_SRC[p.char] || CHAR_SRC.c1}" x="-44" y="-86" width="88" height="88" preserveAspectRatio="xMidYMax meet"/></g>
          <g class="token-steps"></g>`;
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
        this.uiLayer.insertAdjacentHTML('beforeend', `<g class="route-badge" transform="translate(${t.x} ${t.y - 48})"> <circle r="22" fill="${i ? '#3d8bff' : '#ff5a1f'}" stroke="${INK}" stroke-width="4"/><text y="9" text-anchor="middle" class="board-badge">${'AB'[i]}</text></g>`);
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
      if (ev.type === 'shot') this.floatText(ev.playerId, `¡${(state.config.shotWord || 'shot').toUpperCase()}${ev.n > 1 ? ` ×${ev.n}` : ''}!`, 'shot');
    }
    this.firstState = false;
  }

  floatText(playerId, text, kind) {
    const tok = this.tokens.get(playerId);
    if (!tok) return;
    const color = kind === 'perritas' ? '#ffb400' : kind === 'shield' || kind === 'shot' ? '#8fd8ff' : text.startsWith('-') ? '#ff4d5e' : '#7fe08f';
    const icon = kind === 'perritas'
      ? `<circle cx="-30" cy="-7" r="13" fill="#ffb400" stroke="${INK}" stroke-width="3"/><g transform="translate(-40 -17) scale(.32)"><path d="${DOG_PATH}" fill="#c97000"/></g>`
      : kind === 'shield' || kind === 'shot' ? '' : `<rect x="-46" y="-17" width="32" height="20" rx="3" fill="#7fc98f" stroke="${INK}" stroke-width="3"/>`;
    const g = el('g', { transform: `translate(${tok.x} ${tok.y - 100})` });
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
        stepsEl.innerHTML = label ? `<g transform="translate(0 -118)"><circle r="24" fill="#fff" stroke="${INK}" stroke-width="4.5"/><text y="11" text-anchor="middle" class="board-steps">${label}</text></g>` : '';
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
