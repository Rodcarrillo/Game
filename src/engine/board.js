// Tablero como datos estructurados: cada casilla tiene id, coordenadas, tipo,
// vecinos (`next`) y región. El renderizador sólo lee estos datos; las reglas
// viven en tileEffects.js / turnManager.js.
//
// Coordenadas lógicas en un lienzo de 1600 x 1000.

export const BOARD_WIDTH = 1600;
export const BOARD_HEIGHT = 1000;

// Patrón de casillas por segmento:
//  S salida · + Pemolar positivo · - Pemolar negativo · M minijuego · C caos
//  P Perrita · $ tienda de Perritas · ? casilla de elección (bifurcación)
const TYPE_BY_CHAR = {
  S: 'start',
  '+': 'pemolar_plus',
  '-': 'pemolar_minus',
  M: 'minigame',
  C: 'chaos',
  P: 'perrita',
  $: 'shop',
  '?': 'choice',
};

export const REGIONS = {
  plaza: { name: 'Plaza Confeti' },
  bosque: { name: 'Bosque Gomita' },
  pantano: { name: 'Pantano Burbuja' },
  cumbre: { name: 'Cumbre Algodón' },
  volcan: { name: 'Volcán Malvavisco' },
  isla: { name: 'Isla Pemolar' },
  muelle: { name: 'Muelle Chicle' },
};

const SEGMENTS = [
  {
    id: 'A', region: 'plaza',
    pts: [[250, 860], [560, 905], [880, 890], [1150, 830]],
    pattern: 'S+M++-C+M?',
    next: ['R1', 'R2'],
  },
  {
    id: 'R1', region: 'bosque', label: 'Ruta del Bosque', risk: 'Segura · más larga · tienda',
    pts: [[1290, 870], [1440, 770], [1490, 570], [1440, 390], [1330, 280]],
    pattern: '+-+C$++M+',
    next: ['T'],
  },
  {
    id: 'R2', region: 'pantano', label: 'Atajo del Pantano', risk: 'Arriesgada · corta · Perrita',
    branch: true,
    pts: [[1110, 700], [1090, 545], [1150, 410], [1235, 310]],
    pattern: '-C-P-M',
    next: ['T'],
  },
  {
    id: 'T', region: 'cumbre',
    pts: [[1195, 205], [1000, 165], [800, 180], [665, 215]],
    pattern: '+M+-C+?',
    next: ['U1', 'U2'],
  },
  {
    id: 'U1', region: 'volcan', label: 'Volcán Malvavisco', risk: 'Tienda de Perritas · caos',
    pts: [[560, 135], [430, 95], [300, 125], [205, 205]],
    pattern: '-+$-C+',
    next: ['L'],
  },
  {
    id: 'U2', region: 'isla', label: 'Isla Pemolar', risk: 'Pemolares · minijuego · Perrita',
    branch: true,
    pts: [[625, 340], [570, 455], [440, 490], [305, 410]],
    pattern: '+M+P-+',
    next: ['L'],
  },
  {
    id: 'L', region: 'muelle',
    pts: [[165, 320], [135, 480], [145, 640], [185, 775]],
    pattern: '+C$-M',
    next: ['A'],
  },
];

function adjustPattern(pattern, length) {
  if (length === 'normal') return pattern;
  const chars = pattern.split('');
  if (length === 'corto') {
    // Quita uno de cada dos '+' (nunca la salida ni la bifurcación).
    let plusSeen = 0;
    const out = chars.filter((ch) => {
      if (ch !== '+') return true;
      plusSeen += 1;
      return plusSeen % 2 === 1;
    });
    return out.length >= 3 ? out.join('') : pattern;
  }
  // largo: agrega un '+' cada 3 casillas, sin tocar el último carácter
  const out = [];
  chars.forEach((ch, i) => {
    out.push(ch);
    if (i < chars.length - 1 && i % 3 === 2) out.push(i % 2 ? '-' : '+');
  });
  return out.join('');
}

// Catmull-Rom → polilínea densa → muestreo por longitud de arco
function samplePath(pts, count) {
  const dense = [];
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    for (let t = 0; t < 1; t += 0.05) {
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(pts[pts.length - 1]);
  const acc = [0];
  for (let i = 1; i < dense.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  }
  const total = acc[acc.length - 1];
  const out = [];
  for (let k = 0; k < count; k++) {
    const target = count === 1 ? total / 2 : (k / (count - 1)) * total;
    let j = 1;
    while (j < acc.length - 1 && acc[j] < target) j++;
    const seg = acc[j] - acc[j - 1] || 1;
    const u = (target - acc[j - 1]) / seg;
    out.push([
      Math.round(dense[j - 1][0] + (dense[j][0] - dense[j - 1][0]) * u),
      Math.round(dense[j - 1][1] + (dense[j][1] - dense[j - 1][1]) * u),
    ]);
  }
  return out;
}

/**
 * Construye el tablero según la configuración.
 * @returns {{ width:number, height:number, startId:string, tiles:Record<string, Tile>, order:string[], regions:object }}
 */
export function buildBoard({ boardLength = 'normal', boardBranches = true } = {}) {
  const segs = SEGMENTS.filter((s) => boardBranches || !s.branch).map((s) => ({
    ...s,
    next: s.next.filter((n) => boardBranches || !SEGMENTS.find((x) => x.id === n).branch),
  }));
  const tiles = {};
  const order = [];
  const firstOf = {};
  const lastOf = {};

  for (const s of segs) {
    let pattern = adjustPattern(s.pattern, boardLength);
    if (s.next.length < 2) pattern = pattern.replace(/\?$/, '+');
    const pos = samplePath(s.pts, pattern.length);
    pattern.split('').forEach((ch, i) => {
      const id = `${s.id}${i + 1}`;
      tiles[id] = {
        id,
        x: pos[i][0],
        y: pos[i][1],
        type: TYPE_BY_CHAR[ch],
        region: s.region,
        segment: s.id,
        next: [],
      };
      order.push(id);
      if (i > 0) tiles[`${s.id}${i}`].next.push(id);
    });
    firstOf[s.id] = `${s.id}1`;
    lastOf[s.id] = `${s.id}${pattern.length}`;
  }
  for (const s of segs) {
    const last = tiles[lastOf[s.id]];
    last.next = s.next.map((n) => firstOf[n]);
    if (last.next.length > 1) {
      last.routes = s.next.map((n) => {
        const seg = segs.find((x) => x.id === n);
        return { to: firstOf[n], label: seg.label || REGIONS[seg.region].name, risk: seg.risk || '' };
      });
    }
  }
  return {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    startId: 'A1',
    tiles,
    order,
    regions: REGIONS,
    // trazos para dibujar caminos entre casillas
    edges: order.flatMap((id) => tiles[id].next.map((to) => [id, to])),
  };
}

/** Valida integridad del grafo: todas las casillas alcanzables y con salida. */
export function validateBoard(board) {
  const errors = [];
  for (const t of Object.values(board.tiles)) {
    if (!t.next.length) errors.push(`${t.id} sin salida`);
    for (const n of t.next) if (!board.tiles[n]) errors.push(`${t.id} → ${n} inexistente`);
  }
  const seen = new Set([board.startId]);
  const stack = [board.startId];
  while (stack.length) {
    const id = stack.pop();
    for (const n of board.tiles[id].next) if (!seen.has(n)) { seen.add(n); stack.push(n); }
  }
  for (const id of board.order) if (!seen.has(id)) errors.push(`${id} inalcanzable`);
  return errors;
}
