// Arte original en SVG: Perrita (estrella), Pemolar (moneda con huella),
// personajes "gomita" con sombreros, e íconos de casillas.
// Sin <defs>/ids para que se puedan repetir sin colisiones.

const INK = '#2a1d5c';

export function perritaSvg(size = 28) {
  return `<svg class="ico ico-perrita" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M32 5c3 0 4.5 2.4 6.3 7.6l3 8.4 8.9.3c5.6.2 8.3.9 9.2 3.7.9 2.8-1 4.8-5.5 8.2l-7 5.4 2.5 8.5c1.6 5.3 2 8.1-.4 9.8-2.4 1.7-4.9.5-9.5-2.7L32 49l-7.4 5.2c-4.6 3.2-7.1 4.4-9.5 2.7-2.4-1.7-2-4.5-.4-9.8l2.5-8.5-7-5.4c-4.5-3.4-6.4-5.4-5.5-8.2.9-2.8 3.6-3.5 9.2-3.7l8.9-.3 3-8.4C27.5 7.4 29 5 32 5z" fill="#ffc531" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M32 12c1.6 0 2.5 1.6 3.6 4.7l2.3 6.4 6.7.2c3.4.1 5 .5 5.5 2.1" fill="none" stroke="#fff6c9" stroke-width="3" stroke-linecap="round" opacity=".9"/>
    <path d="M21 48l2.3-7.6-6-4.7" fill="none" stroke="#e09a00" stroke-width="3" stroke-linecap="round" opacity=".55"/>
  </svg>`;
}

export function pemolarSvg(size = 26) {
  return `<svg class="ico ico-pemolar" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <ellipse cx="33" cy="35" rx="27" ry="27" fill="#d98a00" stroke="${INK}" stroke-width="3.2"/>
    <circle cx="31" cy="31" r="26" fill="#ffc94a" stroke="${INK}" stroke-width="3.2"/>
    <circle cx="31" cy="31" r="19" fill="#ffd977" stroke="#e8a51c" stroke-width="2.6"/>
    <ellipse cx="31" cy="37" rx="8" ry="6.5" fill="#e8a51c"/>
    <ellipse cx="22.5" cy="28" rx="3.4" ry="4.4" fill="#e8a51c"/>
    <ellipse cx="28" cy="22.5" rx="3.4" ry="4.6" fill="#e8a51c"/>
    <ellipse cx="34.5" cy="22.5" rx="3.4" ry="4.6" fill="#e8a51c"/>
    <ellipse cx="40" cy="28" rx="3.4" ry="4.4" fill="#e8a51c"/>
    <path d="M14 22a19 19 0 0 1 12-10" fill="none" stroke="#fff5cf" stroke-width="3.2" stroke-linecap="round"/>
  </svg>`;
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
    <ellipse cx="50" cy="114" rx="26" ry="6" fill="rgba(42,29,92,.25)"/>
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
  shop: { top: '#ff5fae', side: '#c9307e', label: 'Tienda' },
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
      return `<path d="M0-11l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L0 5.5-6.5 8.9l1.3-7.2-5.3-5.1 7.3-1z" fill="#fff" stroke="#d99400" stroke-width="1.5" stroke-linejoin="round"/>`;
    case 'choice':
      return `<path d="M-9 6l9-12 9 12" fill="none" stroke="#22a6b8" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M0 -6v14" stroke="#22a6b8" stroke-width="4.5" stroke-linecap="round"/>`;
    case 'shop':
      return `<path d="M0-10l3 6.2 6.8.9-5 4.7 1.2 6.7L0 5.3-6 8.5l1.2-6.7-5-4.7 6.8-.9z" fill="#ffc531" stroke="#2a1d5c" stroke-width="1.8" stroke-linejoin="round"/>`;
    case 'start':
      return `<g><rect x="-11" y="-8" width="22" height="16" rx="2" fill="#2a1d5c"/><g fill="#fff"><rect x="-11" y="-8" width="5.5" height="4"/><rect x="0" y="-8" width="5.5" height="4"/><rect x="-5.5" y="-4" width="5.5" height="4"/><rect x="5.5" y="-4" width="5.5" height="4"/><rect x="-11" y="0" width="5.5" height="4"/><rect x="0" y="0" width="5.5" height="4"/><rect x="-5.5" y="4" width="5.5" height="4"/><rect x="5.5" y="4" width="5.5" height="4"/></g></g>`;
    default:
      return '';
  }
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
