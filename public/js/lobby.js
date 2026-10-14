// Piezas del lobby compartidas por la TV y el modo local.
import { beanSvg, perritaSvg, pemolarSvg, esc } from './assets.js';

export function lobbyPlayersHtml(state, { removable = false, max = 8 } = {}) {
  const ids = state.order;
  const cards = ids.map((id) => {
    const p = state.players[id];
    return `<div class="lp">${removable ? `<button class="x" data-remove="${esc(id)}" aria-label="Quitar a ${esc(p.name)}">✕</button>` : ''}${beanSvg(p.color, p.hat, 64)}<span>${esc(p.name)}</span>${p.isBot ? '<span class="tag">BOT</span>' : ''}</div>`;
  });
  for (let i = ids.length; i < Math.max(4, Math.min(max, ids.length + 1)); i++) cards.push('<div class="lp empty">Lugar libre</div>');
  return cards.join('');
}

export function howToHtml(price) {
  return `<div class="how">
    <div><b><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#fff" stroke="#2a1d5c" stroke-width="2.5"/><circle cx="8" cy="8" r="2" fill="#2a1d5c"/><circle cx="16" cy="16" r="2" fill="#2a1d5c"/><circle cx="12" cy="12" r="2" fill="#2a1d5c"/></svg> Tira</b>Avanza casilla por casilla y elige ruta en los cruces.</div>
    <div><b>${pemolarSvg(22)} Junta</b>Gana Pemolares en casillas azules y minijuegos.</div>
    <div><b>${perritaSvg(24)} Compra</b>Cambia ${price} Pemolares por una Perrita en las tiendas.</div>
    <div><b>${perritaSvg(24)}${perritaSvg(24)} Gana</b>Quien tenga más Perritas al final se lleva la isla.</div>
  </div>`;
}
