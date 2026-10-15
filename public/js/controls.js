// Controles privados del jugador. Se usan en el celular y en el modo local.
// Los botones llevan data-action con JSON; bindActions() los envía.

import { perritaSvg, pemolarSvg, avatarHtml, shotSvg, itemIconSvg, esc } from './assets.js';

const ITEM_NAMES = { double: 'Dado doble', triple: 'Dado triple', choice: 'Dado a elección', slow: 'Dado lento', shield: 'Escudo', bell: 'Campana', steal: 'Robo', pass: 'Pasa el shot', water: 'Vaso de agua' };
const PASSIVE = new Set(['pass', 'water']);
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
        const dm = pend.dice;
        const label = dm ? { double: 'Dado doble activo', triple: 'Dado triple activo', choice: `Vas a sacar ${dm.value}`, slow: 'Dado lento activo (1–3)' }[dm.item] : `Dado de ${state.config.diceMin} a ${state.config.diceMax}`;
        const usable = p.items.filter((it) => !PASSIVE.has(it));
        let inv = '';
        if (usable.length) {
          const btns = usable.map((it, i) => {
            if (it === 'choice') return '';
            const isDice = ['double', 'triple', 'slow'].includes(it);
            return `<button class="btn ghost" data-action="${act({ type: 'USE_ITEM', item: it })}" ${isDice && dm ? 'disabled' : ''} data-k="${i}">${itemIconSvg(it, 24)}${ITEM_NAMES[it]}</button>`;
          }).join('');
          const choice = usable.includes('choice') && !dm
            ? `<p class="ph-note">Dado a elección: toca el número</p><div class="choice-nums">${Array.from({ length: state.config.diceMax - state.config.diceMin + 1 }, (_, i) => state.config.diceMin + i).map((v) => `<button class="btn ghost" data-action="${act({ type: 'USE_ITEM', item: 'choice', value: v })}">${v}</button>`).join('')}</div>` : '';
          inv = `<p class="ph-note">Usa un objeto antes de tirar</p><div class="inv">${btns}</div>${choice}`;
        }
        return `<button class="btn huge roll" data-action="${act({ type: 'ROLL' })}"><span class="mini-die">?</span>TIRAR DADO</button>
          <p class="ph-note">${label}${local ? ' · barra espaciadora' : ''}</p>${inv}`;
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
    case 'SHOT_CONFIRM': {
      const word = (state.config.shotWord || 'shot').toUpperCase();
      if (pend?.playerId === me) {
        return `<div class="ph-wait mine">${shotSvg(90)}<b>¡TOMA ${word}${pend.n > 1 ? ` ×${pend.n}` : ''}!</b><p>${esc(pend.reason || '')}</p></div>
          <button class="btn huge" data-action="${act({ type: 'SHOT_OK', token: pend.token })}">Continuar</button>`;
      }
      return `<div class="ph-wait"><b>${esc(state.players[pend?.playerId]?.name || '')} toma ${state.config.shotWord}</b><p>Esperando a que pulse Continuar…</p></div>`;
    }
    case 'PLACE':
      if (pend?.kind === 'place' && pend.playerId === me) {
        return `<p class="ph-title">${esc(pend.name)}</p><p class="ph-note">${esc(pend.what)}</p>
          <div class="ph-two"><button class="btn big mint" data-action="${act({ type: 'PLACE_ENTER', enter: true })}">ENTRAR</button><button class="btn big ghost" data-action="${act({ type: 'PLACE_ENTER', enter: false })}">Seguir</button></div>`;
      }
      return `<div class="ph-wait"><b>${esc(state.players[pend?.playerId]?.name || '')} está en la entrada de ${esc(pend?.name || '')}</b></div>`;
    case 'ITEM_SHOP':
      if (isMe && pend?.kind === 'items' && !pend.done) {
        const full = p.items.length >= pend.maxItems;
        return `<p class="ph-title">Tienda de objetos</p>
          <p class="ph-note">Tienes ${pemolarSvg(16)} <b>${p.pemolares}</b> · objetos ${p.items.length}/${pend.maxItems}</p>
          <div class="item-btns">${pend.catalog.map((it) => `<button class="btn item-b" data-action="${act({ type: 'ITEM_BUY', item: it.id })}" ${full || p.pemolares < it.price ? 'disabled' : ''} title="${esc(it.desc)}">${itemIconSvg(it.id, 30)}<b>${esc(it.name)}</b><small>${pemolarSvg(14)} ${it.price}</small></button>`).join('')}</div>
          <button class="btn ${pend.bought.length ? 'mint' : 'ghost'}" data-action="${act({ type: 'ITEM_DONE' })}">${pend.bought.length ? 'Listo' : 'No quiero nada'}</button>`;
      }
      return `<div class="ph-wait"><b>${esc(state.players[pend?.playerId]?.name || '')} está en la tienda de objetos</b></div>`;
    case 'SAFARI':
      if (pend?.kind === 'safari' && pend.playerId === me) {
        if (pend.result) {
          const r = pend.result;
          return `<div class="ph-wait mine"><b>${r.win ? `¡Ganaste ${r.bet}!` : `Perdiste ${r.bet}`}</b><p>Tu dado ${r.you} contra ${r.house} de la casa${r.companion ? ' · ¡te llevas acompañante!' : ''}</p></div>`;
        }
        return `<p class="ph-title">Safari</p><p class="ph-note">¿Cuánto apuestas? Si tu dado sale más alto que el de la casa, ganas lo mismo${pend.hasCompanion ? '' : ' y te llevas una acompañante'}. Si no, lo pierdes.</p>
          <div class="ph-buy">${pend.bets.map((b) => `<button class="btn buy" data-action="${act({ type: 'SAFARI_BET', bet: b })}">${pemolarSvg(22)} ${b}</button>`).join('')}</div>`;
      }
      return `<div class="ph-wait"><b>${esc(state.players[pend?.playerId]?.name || '')} entró al Safari</b></div>`;
    case 'EXAM':
      if (pend?.kind === 'exam' && pend.playerId === me) {
        if (pend.result) return `<div class="ph-wait ${pend.result.ok ? 'mine' : ''}"><b>${pend.result.ok ? '¡Aprobado!' : 'Reprobado'}</b><p>Era ${pend.result.correct === 'fact' ? 'FACT' : 'CAP'}</p></div>`;
        return `<p class="ph-title">Examen Piaget</p><div class="ph-q">${esc(pend.statement)}</div>
          <div class="ph-two"><button class="btn big cap" data-action="${act({ type: 'EXAM_ANSWER', answer: 'cap' })}">CAP<small>mentira</small></button><button class="btn big fact" data-action="${act({ type: 'EXAM_ANSWER', answer: 'fact' })}">FACT<small>dato real</small></button></div>`;
      }
      return `<div class="ph-wait"><b>${esc(state.players[pend?.playerId]?.name || '')} presenta examen</b></div>`;
    case 'SHOT_GIFT':
      if (pend?.kind === 'gift' && pend.playerId === me && pend.remaining > 0) {
        return `<p class="ph-title">Reparte ${pend.remaining} ${state.config.shotWord}${pend.remaining > 1 ? 's' : ''}</p><p class="ph-note">${esc(pend.reason || '')}</p>
          <div class="ph-routes">${pend.options.map((id) => `<button class="btn ghost" data-action="${act({ type: 'GIFT_SHOT', to: id })}">${avatarHtml(state.players[id], 40)}${esc(state.players[id].name)}</button>`).join('')}</div>`;
      }
      return `<div class="ph-wait"><b>${esc(state.players[pend?.playerId]?.name || '')} reparte ${state.config.shotWord}s</b>${pend?.given?.includes(me) ? `<p>¡Te tocó uno!</p>` : ''}</div>`;
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
      return `<div class="ph-wait mine"><small>${esc(state.minigame.name)}</small><b>${r.place}º lugar</b><p>${pemolarSvg(20)} +${r.reward} Pemolares${r.shots ? ` · ${shotSvg(20)} ×${r.shots}` : ''}</p></div>`;
    }
    case 'BOARD_END':
    case 'FINAL_BONUSES':
      return '<div class="ph-wait"><b>Contando Perritas…</b><p>Mira la tele.</p></div>';
    case 'FINAL_LEADERBOARD':
    case 'WINNER_REVEAL': {
      const r = state.final?.ranking?.find((x) => x.playerId === me);
      const won = state.final?.winners?.includes(me);
      return `<div class="ph-wait ${won ? 'mine' : ''}">${avatarHtml(p, 110, { crown: won })}<b>${won ? '¡GANASTE!' : r ? `${r.rank}º lugar` : ''}</b><p>${perritaSvg(22)} ${p.perritas} · ${pemolarSvg(20)} ${p.pemolares}${state.config.shotsEnabled ? ` · ${shotSvg(20)} ${p.shots}` : ''}</p></div>`;
    }
    default:
      return '';
  }
}

/** Encabezado del jugador con sus saldos. */
export function walletHtml(state, playerId) {
  const p = state.players[playerId];
  if (!p) return '';
  return `<div class="ph-me" style="--pc:${p.color}">${avatarHtml(p, 52)}<b>${esc(p.name)}</b>
    <span class="money perritas">${perritaSvg(26)}<em>${p.perritas}</em></span>
    <span class="money pemolares">${pemolarSvg(24)}<em>${p.pemolares}</em></span>${state.config.shotsEnabled ? `<span class="ph-shots">${shotSvg(22)}${p.shots}</span>` : ''}${p.shield ? '<span class="tag tag-shield">ESCUDO</span>' : ''}
    ${p.items.length ? `<span class="inv">${p.items.map((it) => `<span title="${ITEM_NAMES[it]}">${itemIconSvg(it, 22)}</span>`).join('')}</span>` : ''}</div>`;
}
