// Arte original en SVG: Perrita (estrella), Pemolar (moneda con huella),
// personajes "gomita" con sombreros, e íconos de casillas.
// Sin <defs>/ids para que se puedan repetir sin colisiones.

import { CHAR_SRC, PEMOL_LOGO } from './images.js';

const INK = '#1b2440';
export { CHAR_SRC, PEMOL_LOGO };

// Perrita: moneda dorada con un perrito esponjoso de perfil y cola enroscada.
export const DOG_PATH = 'M17 45c0-5 2-8 4-10l-1-7c-2-1-4-3-4-6 0-2 1-4 3-5l2-6 4 5 3-6 3 7c3 1 5 4 5 7 3 0 7 1 11 1 3 0 5-2 6-5 2-3 5-4 7-2 2 2 1 6-2 8-1 3-1 6 0 9l-1 9h-4l-1-6c-3 1-7 1-11 1l-1 6h-4l-1-7c-2 0-3 0-5-1l-1 7h-4z';
export function perritaSvg(size = 28) {
  return `<svg class="ico ico-perrita" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="34" r="29" fill="#c98200" stroke="${INK}" stroke-width="3"/>
    <circle cx="32" cy="31" r="29" fill="#ffb400" stroke="${INK}" stroke-width="3"/>
    <circle cx="32" cy="31" r="22.5" fill="#ffd84a" stroke="#e39b00" stroke-width="2.5"/>
    <path d="M14 22 L40 50 L48 46 L20 16z" fill="#fff6b8" opacity=".55"/>
    <g transform="translate(5.5 6) scale(.83)"><path d="${DOG_PATH}" fill="#f29a00" stroke="#c97000" stroke-width="1.6" stroke-linejoin="round"/></g>
  </svg>`;
}

// Pemolar: billete verde estilo dólar con el logo de Pemol al centro.
export function pemolarSvg(size = 26) {
  const w = Math.round(size * 1.7);
  return `<svg class="ico ico-pemolar" width="${w}" height="${size}" viewBox="0 0 100 58" aria-hidden="true">
    <rect x="3" y="6" width="94" height="49" rx="5" fill="#1d6b3a" opacity=".55"/>
    <rect x="2" y="2" width="94" height="50" rx="5" fill="#7fc98f" stroke="${INK}" stroke-width="3"/>
    <rect x="8" y="7.5" width="82" height="39" rx="3" fill="#a9ddb2" stroke="#2c7a46" stroke-width="1.8"/>
    <path d="M8 13h82M8 41h82" stroke="#2c7a46" stroke-width="1" stroke-dasharray="2 2"/>
    <ellipse cx="49" cy="27" rx="22" ry="16" fill="#1f6a3b" stroke="#134a28" stroke-width="2"/>
    <image href="${PEMOL_LOGO}" x="31" y="15" width="36" height="24" preserveAspectRatio="xMidYMid meet"/>
    <text x="14" y="21" font-size="10" font-weight="900" fill="#134a28" font-family="Fredoka, sans-serif">P$</text>
    <text x="84" y="44" font-size="10" font-weight="900" fill="#134a28" text-anchor="end" font-family="Fredoka, sans-serif">P$</text>
  </svg>`;
}

// Caballito de tequila (shot)
export function shotSvg(size = 24) {
  return `<svg class="ico ico-shot" width="${Math.round(size * 0.8)}" height="${size}" viewBox="0 0 40 50" aria-hidden="true">
    <path d="M4 4h32l-4 42H8z" fill="#e8f4ff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M7 16h26l-2.8 27H9.8z" fill="#ffb400"/>
    <path d="M10 8l2 32" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
  </svg>`;
}

/** Íconos de objetos de la tienda. */
export function itemIconSvg(id, size = 34) {
  const die = (label) => `<rect x="6" y="6" width="36" height="36" rx="9" fill="#0d0f17" stroke="#7fb2ff" stroke-width="2.5"/><text x="24" y="31" text-anchor="middle" font-family="Titan One, sans-serif" font-size="${label.length > 2 ? 12 : 16}" fill="#fff">${label}</text>`;
  const art = {
    double: die('×2'),
    triple: die('×3'),
    choice: die('?'),
    slow: die('1-3'),
    shield: `<path d="M24 5l16 6v12c0 10-7 17-16 21C15 40 8 33 8 23V11z" fill="#3d8bff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M24 12v24" stroke="#fff" stroke-width="3" opacity=".7"/>`,
    bell: `<path d="M24 6c-8 0-12 6-12 14v9l-4 6h32l-4-6v-9c0-8-4-14-12-14z" fill="#ffb400" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="39" r="4" fill="#ffb400" stroke="${INK}" stroke-width="2.5"/>`,
    steal: `<path d="M12 40V20c0-3 4-3 4 0v-6c0-3 4-3 4 0v-2c0-3 4-3 4 0v2c0-3 4-3 4 0v12l3-4c2-2 5 0 4 2l-6 10c-2 4-5 6-9 6h-1c-5 0-8-3-8-6z" fill="#3a3a48" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
    pass: `<path d="M8 8h18l-3 32H11z" fill="#e8f4ff" stroke="${INK}" stroke-width="2.5"/><path d="M10 18h14l-2 20h-10z" fill="#ffb400"/><path d="M30 24h12m-5-5 5 5-5 5" fill="none" stroke="#ff7a1a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    water: `<path d="M12 8h24l-3 32H15z" fill="#e8f4ff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M14 20h20l-2 18H16z" fill="#6cc6ff"/>`,
  }[id] || '';
  return `<svg class="ico item-ico" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${art}</svg>`;
}

/** Cara de dado con puntos (1–6) o número (7+). */
const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
export function dieFaceSvg(v) {
  if (PIPS[v]) return `<svg viewBox="0 0 100 100" aria-hidden="true">${PIPS[v].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" class="pip"/>`).join('')}<path d="M80 12l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" class="spark"/></svg>`;
  return `<span class="die-num">${v}</span>`;
}

/** Personaje (imagen recortada) con su aro de color y acompañante opcional. */
export function avatarHtml(p, size = 48, { crown = false } = {}) {
  if (!p) return '';
  const src = CHAR_SRC[p.char] || CHAR_SRC.c1;
  return `<span class="av${crown ? ' crowned' : ''}" style="--pc:${p.color};--h:${size}px"><img src="${src}" alt="" draggable="false">${p.companion ? `<span class="av-comp">${companionSvg(p.companion, Math.round(size * 0.8))}</span>` : ''}</span>`;
}

// Acompañantes del Safari (arte original).
const COMP = {
  f1: { hair: '#3a2416', dress: '#e0464f', skin: '#f2c19b' },
  f2: { hair: '#e8b04a', dress: '#2f6fe0', skin: '#f6d2b4' },
  f3: { hair: '#1c1c22', dress: '#14a37f', skin: '#c98d62' },
};
export function companionInner(id) {
  const c = COMP[id] || COMP.f1;
  return `<ellipse cx="30" cy="96" rx="16" ry="4" fill="rgba(0,0,0,.25)"/>
    <path d="M18 30c-6 10-6 30-2 38h28c4-8 4-28-2-38z" fill="${c.hair}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M16 92l4-38c2-6 18-6 20 0l4 38z" fill="${c.dress}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M20 58c-6 6-8 14-6 20M40 58c6 6 8 14 6 20" fill="none" stroke="${c.skin}" stroke-width="5" stroke-linecap="round"/>
    <rect x="26" y="46" width="8" height="8" fill="${c.skin}"/>
    <ellipse cx="30" cy="36" rx="12" ry="13" fill="${c.skin}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M17 34c2-12 22-14 26 0-6-4-14-6-26 0z" fill="${c.hair}" stroke="${INK}" stroke-width="2"/>
    <circle cx="25.5" cy="38" r="1.8" fill="${INK}"/><circle cx="34.5" cy="38" r="1.8" fill="${INK}"/>
    <path d="M26 44q4 3 8 0" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M22 92v4M38 92v4" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
}
export function companionSvg(id, size = 40) {
  return `<svg class="comp" width="${Math.round(size * 0.6)}" height="${size}" viewBox="0 0 60 100" aria-hidden="true">${companionInner(id)}</svg>`;
}

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = c((n >> 16) & 255);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

const HAT_ART = {
  corona: `<path d="M30 24l4-16 9 10 7-14 7 14 9-10 4 16z" fill="#ffc531" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="17" r="3" fill="#ff5fae"/>`,
  gorra: (c) => `<path d="M26 26c2-14 12-20 24-20s22 6 24 20z" fill="${shade(c, -0.18)}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M60 24c8 0 16 1 22 4-6 3-14 3-22 1z" fill="${shade(c, -0.3)}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="8" r="3" fill="#fff" stroke="${INK}" stroke-width="2"/>`,
  moño: `<path d="M50 18l-16-9c-4 0-5 16 0 17zM50 18l16-9c4 0 5 16 0 17z" fill="#ff5fae" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="18" r="5" fill="#ff8cc6" stroke="${INK}" stroke-width="3"/>`,
  antena: `<path d="M50 24V6" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="6" r="6" fill="#22e3a0" stroke="${INK}" stroke-width="3"/>`,
  cuernos: `<path d="M34 26c-6-6-6-14-2-20 2 7 7 11 10 16zM66 26c6-6 6-14 2-20-2 7-7 11-10 16z" fill="#fff4e0" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  flor: `<g transform="translate(64 18)"><circle r="6" cx="0" cy="-7" fill="#fff"/><circle r="6" cx="7" cy="0" fill="#fff"/><circle r="6" cx="0" cy="7" fill="#fff"/><circle r="6" cx="-7" cy="0" fill="#fff"/><circle r="5" fill="#ffc531" stroke="${INK}" stroke-width="2.5"/></g>`,
  chef: `<path d="M34 26V16c-8-2-8-14 2-13 2-6 12-6 14-1 4-5 14-3 14 3 8-1 10 10 2 11v10z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  casco: `<path d="M24 30c0-16 12-26 26-26s26 10 26 26z" fill="#ff6b4a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M50 4v26" stroke="#fff" stroke-width="5"/>`,
};

/** Contenido de un personaje gomita en un sistema de 100 × 120. */
export function beanInner(color, hat, { mood = 'happy' } = {}) {
  const dark = shade(color, -0.22);
  const light = shade(color, 0.25);
  const hatArt = typeof HAT_ART[hat] === 'function' ? HAT_ART[hat](color) : HAT_ART[hat] || '';
  const mouth = mood === 'sad'
    ? `<path d="M43 66q7-5 14 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`
    : mood === 'wow'
      ? `<ellipse cx="50" cy="66" rx="4.5" ry="5.5" fill="${INK}"/>`
      : `<path d="M42 62q8 8 16 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  return `
    <ellipse cx="50" cy="114" rx="26" ry="6" fill="rgba(27,36,64,.25)"/>
    <path d="M50 20c19 0 28 14 28 34v30c0 17-11 28-28 28S22 101 22 84V54c0-20 9-34 28-34z" fill="${color}" stroke="${INK}" stroke-width="3.5"/>
    <path d="M27 82c3 17 12 25 23 25s20-8 23-25c-3 9-11 16-23 16s-20-7-23-16z" fill="${dark}" opacity=".8"/>
    <path d="M34 34c4-6 9-8 14-8" fill="none" stroke="${light}" stroke-width="5" stroke-linecap="round"/>
    <path d="M22 70c-8 2-12 9-10 15 2 2 6 1 10-4M78 70c8 2 12 9 10 15-2 2-6 1-10-4" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="41" cy="50" rx="6" ry="8" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
    <ellipse cx="59" cy="50" rx="6" ry="8" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="42" cy="52" r="3.2" fill="${INK}"/>
    <circle cx="58" cy="52" r="3.2" fill="${INK}"/>
    <circle cx="43" cy="50.5" r="1.1" fill="#fff"/>
    <circle cx="59" cy="50.5" r="1.1" fill="#fff"/>
    <ellipse cx="32" cy="62" rx="5" ry="3" fill="#ff7fa8" opacity=".55"/>
    <ellipse cx="68" cy="62" rx="5" ry="3" fill="#ff7fa8" opacity=".55"/>
    ${mouth}
    ${hatArt}`;
}

export function beanSvg(color, hat, size = 48, opts) {
  const h = Math.round(size * 1.2);
  return `<svg class="bean" width="${size}" height="${h}" viewBox="0 0 100 120" aria-hidden="true">${beanInner(color, hat, opts)}</svg>`;
}

export const TILE_STYLE = {
  start: { top: '#ffffff', side: '#b8b0d8', label: 'Salida' },
  pemolar_plus: { top: '#3d8bff', side: '#1f5fc4', label: 'Pemolares +' },
  pemolar_minus: { top: '#ff4d5e', side: '#c42536', label: 'Pemolares −' },
  minigame: { top: '#2ecc8f', side: '#159465', label: 'Minijuego' },
  chaos: { top: '#9b5cff', side: '#6a2fd1', label: 'Caos' },
  perrita: { top: '#ffc531', side: '#d99400', label: 'Perrita' },
  choice: { top: '#ffffff', side: '#9fd8e0', label: 'Cruce' },
  shop: { top: '#ffb400', side: '#b97a00', label: 'Tienda de Perritas' },
  itemshop: { top: '#16b8a6', side: '#0b7d70', label: 'Tienda de objetos' },
  safari: { top: '#8aa53a', side: '#5a6e1f', label: 'Safari' },
  exam: { top: '#ffffff', side: '#9aa7c7', label: 'Examen' },
  ronda: { top: '#ff7a1a', side: '#b44f05', label: 'Ronda' },
  barra: { top: '#5b2a86', side: '#391657', label: 'Barra libre' },
};

/** Ícono dentro de una casilla, centrado en (0,0), ~28px. */
export function tileGlyph(type) {
  switch (type) {
    case 'pemolar_plus':
      return `<path d="M-8 0h16M0 -8v16" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/>`;
    case 'pemolar_minus':
      return `<path d="M-8 0h16" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/>`;
    case 'minigame':
      return `<g fill="#fff"><rect x="-13" y="-7" width="26" height="14" rx="7"/></g><g fill="#159465"><rect x="-9" y="-1.6" width="7" height="3.2" rx="1"/><rect x="-7.1" y="-3.5" width="3.2" height="7" rx="1"/><circle cx="6" cy="-2" r="2"/><circle cx="9" cy="2" r="2"/></g>`;
    case 'chaos':
      return `<path d="M-5 -4a5.5 5.5 0 1 1 7 5.2c-1.6.6-2 1.4-2 3.2" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/><circle cx="0" cy="10" r="2.6" fill="#fff"/>`;
    case 'perrita':
      return `<circle r="11" fill="#fff6c9" stroke="#d99400" stroke-width="2"/><g transform="translate(-10 -10) scale(.32)"><path d="${DOG_PATH}" fill="#f29a00"/></g>`;
    case 'choice':
      return `<path d="M-9 6l9-12 9 12" fill="none" stroke="#22a6b8" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M0 -6v14" stroke="#22a6b8" stroke-width="4.5" stroke-linecap="round"/>`;
    case 'shop':
      return `<circle r="10" fill="#ffd84a" stroke="${INK}" stroke-width="2"/><g transform="translate(-9.5 -9) scale(.3)"><path d="${DOG_PATH}" fill="#f29a00"/></g>`;
    case 'itemshop':
      return `<rect x="-9" y="-6" width="18" height="14" rx="2" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M-11 -6h22v-4h-22z" fill="#ffd84a" stroke="${INK}" stroke-width="2"/><path d="M0 -10v18" stroke="#ff7a1a" stroke-width="3"/><path d="M0 -10c-3-5-8-4-6 0M0 -10c3-5 8-4 6 0" fill="none" stroke="#ff7a1a" stroke-width="2"/>`;
    case 'safari':
      return `<circle cx="-5" cy="2" r="5" fill="none" stroke="#fff" stroke-width="3"/><circle cx="6" cy="2" r="5" fill="none" stroke="#fff" stroke-width="3"/><path d="M-1 0h3" stroke="#fff" stroke-width="3"/>`;
    case 'exam':
      return `<text y="7" text-anchor="middle" font-family="Titan One, sans-serif" font-size="19" fill="#2f6fe0">A+</text>`;
    case 'ronda':
      return `<path d="M-7 -9h14l-2 18h-10z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M-6 -3h12l-1.4 11h-9.2z" fill="#ffb400"/>`;
    case 'barra':
      return `<path d="M-3 -12h6v5c4 2 5 5 5 8v10h-16v-10c0-3 1-6 5-8z" fill="#2ecc8f" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><rect x="-6" y="0" width="12" height="5" fill="#fff"/>`;
    case 'start':
      return `<g><rect x="-11" y="-8" width="22" height="16" rx="2" fill="#1b2440"/><g fill="#fff"><rect x="-11" y="-8" width="5.5" height="4"/><rect x="0" y="-8" width="5.5" height="4"/><rect x="-5.5" y="-4" width="5.5" height="4"/><rect x="5.5" y="-4" width="5.5" height="4"/><rect x="-11" y="0" width="5.5" height="4"/><rect x="0" y="0" width="5.5" height="4"/><rect x="-5.5" y="4" width="5.5" height="4"/><rect x="5.5" y="4" width="5.5" height="4"/></g></g>`;
    default:
      return '';
  }
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
