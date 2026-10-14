// Controles privados del jugador. Se usan en el celular y en el modo local.
// Los botones llevan data-action con JSON; bindActions() los envía.

import { perritaSvg, pemolarSvg, beanSvg, esc } from './assets.js';
import { MG_VIEWS } from './minigame-views.js';

const act = (a) => esc(JSON.stringify(a));

export function bindActions(root, send) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    try {
      send(JSON.parse(b.dataset.action));
    } catch { /* nada */ }
    if (navigator.vibrate) navigator.vibrate(15);
  });
}

/**
 * HTML de las acciones disponibles para `playerId`.
 * @param {object} state  estado público
 * @param {object} you    vista privada ({ playerId, minigame })
 */
export function controlsHtml(state, you, { local = false } = {}) {
  const me = you.playerId;
  const p = state.players[me];
  if (!p) return '<p class="ph-note">No estás en esta partida.</p>';
  const isMe = state.currentPlayerId === me;
  const pend = state.pending;
  const curName = esc(state.players[state.currentPlayerId]?.name || '');
  if (state.paused) return '<div class="ph-wait"><b>Pausa</b><p>El host pausó la partida.</p></div>';

  switch (state.phase) {
    case 'LOBBY':
      return `<div class="ph-wait"><b>¡Ya estás dentro!</b><p>Esperando a que el host empiece la partida.</p></div>`;
    case 'BOARD_INTRO':
      return `<div class="ph-wait"><b>¡Arrancamos!</b><p>Mira la tele.</p></div>`;
    case 'TURN_START':
      return isMe ? '<div class="ph-wait mine"><b>¡Es tu turno!</b><p>Prepárate para tirar.</p></div>' : `<div class="ph-wait"><b>Turno de ${curName}</b></div>`;
    case 'DICE_ROLL':
      if (isMe && pend?.kind === 'roll') {
        return `<button class="btn huge roll" data-action="${act({ type: 'ROLL' })}"><span class="mini-die">?</span>TIRAR DADO</button>
          <p class="ph-note">Dado de ${state.config.diceMin} a ${state.config.diceMax}${local ? ' · barra espaciadora' : ''}</p>`;
      }
      return `<div class="ph-wait"><b>${curName} va a tirar</b></div>`;
    case 'MOVEMENT':
      if (state.lastRoll?.playerId === me && isMe) return `<div class="ph-wait mine"><b>¡Sacaste ${state.lastRoll.value}!</b><p>Avanzando…</p></div>`;
      return `<div class="ph-wait"><b>${curName} avanza</b></div>`;
    case 'ROUTE_CHOICE':
      if (isMe && pend?.kind === 'route') {
        return `<p class="ph-title">¿Por dónde vas?</p><div class="ph-routes">${pend.options.map((o, i) => `
          <button class="btn route-btn ${'ab'[i]}" data-action="${act({ type: 'CHOOSE_ROUTE', to: o.to })}"><b>${'AB'[i]}</b><span>${esc(o.label)}<small>${esc(o.risk)}</small></span></button>`).join('')}</div>
          <p class="ph-note">Te quedan ${pend.stepsLeft} pasos</p>`;
      }
      return `<div class="ph-wait"><b>${curName} elige camino</b></div>`;
    case 'SHOP':
      if (isMe && pend?.kind === 'shop' && !pend.done) {
        const btns = [];
        for (let q = 1; q <= Math.max(1, pend.maxQty); q++) {
          const can = p.pemolares >= q * pend.price;
          btns.push(`<button class="btn buy" data-action="${act({ type: 'SHOP_BUY', token: pend.token, qty: q })}" ${can ? '' : 'disabled'}>${perritaSvg(26)}×${q}<small>${pemolarSvg(16)} ${q * pend.price}</small></button>`);
        }
        return `<p class="ph-title">Tienda de Perritas</p>
          <p class="ph-note">Precio ${pend.price} Pemolares · tienes <b>${p.pemolares}</b></p>
          <div class="ph-buy">${btns.join('')}</div>
          ${pend.canBuy ? '' : '<p class="ph-note warn">No te alcanzan los Pemolares.</p>'}
          <button class="btn ghost" data-action="${act({ type: 'SHOP_SKIP', token: pend.token })}">Seguir de largo</button>`;
      }
      if (pend?.done === 'bought' && isMe) return `<div class="ph-wait mine"><b>¡+${pend.bought} Perrita${pend.bought > 1 ? 's' : ''}!</b></div>`;
      return `<div class="ph-wait"><b>${curName} está en la tienda</b></div>`;
    case 'TILE_RESOLUTION': {
      const t = state.lastTile;
      if (t?.playerId === me) return `<div class="ph-wait mine tone-${t.tone}"><b>${esc(t.title)}</b><p>${esc(t.text)}</p></div>`;
      return `<div class="ph-wait"><b>${curName}: ${esc(t?.title || '')}</b></div>`;
    }
    case 'MINIGAME_INTRO': {
      const mg = state.minigame;
      const inIt = mg.participants.includes(me);
      return `<div class="ph-wait ${inIt ? 'mine' : ''}"><small>Minijuego</small><b>${esc(mg.name)}</b><p>${inIt ? esc(mg.instructions) : 'Esta vez te toca mirar.'}</p></div>`;
    }
    case 'MINIGAME_PLAYING': {
      const mg = state.minigame;
      if (!mg.participants.includes(me)) return `<div class="ph-wait"><b>${esc(mg.name)}</b><p>Mira la tele y echa porras.</p></div>`;
      const view = MG_VIEWS[mg.gameId];
      return view && mg.view ? view.phone(state, mg.view, { ...(you.minigame || {}), playerId: me }) : '';
    }
    case 'MINIGAME_RESULTS': {
      const r = state.minigame.results.find((x) => x.playerId === me);
      if (!r) return `<div class="ph-wait"><b>Resultados en la tele</b></div>`;
      return `<div class="ph-wait mine"><small>${esc(state.minigame.name)}</small><b>${r.place}º lugar</b><p>${pemolarSvg(20)} +${r.reward} Pemolares</p></div>`;
    }
    case 'BOARD_END':
    case 'FINAL_BONUSES':
      return '<div class="ph-wait"><b>Contando Perritas…</b><p>Mira la tele.</p></div>';
    case 'FINAL_LEADERBOARD':
    case 'WINNER_REVEAL': {
      const r = state.final?.ranking?.find((x) => x.playerId === me);
      const won = state.final?.winners?.includes(me);
      return `<div class="ph-wait ${won ? 'mine' : ''}">${beanSvg(p.color, p.hat, 80, { mood: won ? 'wow' : 'happy' })}<b>${won ? '¡GANASTE!' : r ? `${r.rank}º lugar` : ''}</b><p>${perritaSvg(22)} ${p.perritas} · ${pemolarSvg(20)} ${p.pemolares}</p></div>`;
    }
    default:
      return '';
  }
}

/** Encabezado del jugador con sus saldos. */
export function walletHtml(state, playerId) {
  const p = state.players[playerId];
  if (!p) return '';
  return `<div class="ph-me" style="--pc:${p.color}">${beanSvg(p.color, p.hat, 46)}<b>${esc(p.name)}</b>
    <span class="money perritas">${perritaSvg(26)}<em>${p.perritas}</em></span>
    <span class="money pemolares">${pemolarSvg(24)}<em>${p.pemolares}</em></span>${p.shield ? '<span class="tag tag-shield">ESCUDO</span>' : ''}</div>`;
}
