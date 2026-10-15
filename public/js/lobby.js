// Piezas del lobby compartidas por la TV y el modo local.
import { avatarHtml, perritaSvg, pemolarSvg, esc } from './assets.js';

export function lobbyPlayersHtml(state, { removable = false, max = 8 } = {}) {
  const ids = state.order;
  const cards = ids.map((id) => {
    const p = state.players[id];
    return `<div class="lp">${removable ? `<button class="x" data-remove="${esc(id)}" aria-label="Quitar a ${esc(p.name)}">✕</button>` : ''}${avatarHtml(p, 90)}<span>${esc(p.name)}</span>${p.isBot ? '<span class="tag">BOT</span>' : ''}</div>`;
  });
  for (let i = ids.length; i < Math.max(4, Math.min(max, ids.length + 1)); i++) cards.push('<div class="lp empty">Lugar libre</div>');
  return cards.join('');
}

/** Fondo animado: rayos girando y dados, monedas y billetes que suben. */
export function bgFxHtml() {
  const kinds = ['d', 'c', 'b', 'd', 'c', 'd', 'b', 'c', 'd', 'b', 'c', 'd'];
  return `<div class="rays" aria-hidden="true"></div><div class="floaters" aria-hidden="true">${kinds.map((k, i) => `<i class="${k}" style="left:${(i * 8.3 + 3) % 100}%;animation-duration:${14 + (i % 5) * 3}s;animation-delay:-${(i * 2.3).toFixed(1)}s"></i>`).join('')}</div>`;
}

export function howToHtml(price) {
  return `<div class="how">
    <div><b><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#fff" stroke="#1b2440" stroke-width="2.5"/><circle cx="8" cy="8" r="2" fill="#1b2440"/><circle cx="16" cy="16" r="2" fill="#1b2440"/><circle cx="12" cy="12" r="2" fill="#1b2440"/></svg> Tira</b>Avanza casilla por casilla y elige ruta en los cruces.</div>
    <div><b>${pemolarSvg(22)} Junta</b>Gana Pemolares en casillas azules y minijuegos.</div>
    <div><b>${perritaSvg(24)} Compra</b>Cambia ${price} Pemolares por una Perrita en las tiendas.</div>
    <div><b>${perritaSvg(24)}${perritaSvg(24)} Gana</b>Quien tenga más Perritas al final se lleva la isla. Quien pierde: CASTIGO.</div>
  </div>`;
}
