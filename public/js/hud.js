// BoardHUD + PlayerLeaderboard: tarjetas persistentes con Perritas y Pemolares
// de cada jugador; animan los saldos cuando cambian.

import { avatarHtml, perritaSvg, pemolarSvg, shotSvg, itemIconSvg, esc } from './assets.js';

export function rankPlayers(state) {
  const tb = state.config?.pemolaresTiebreak !== false;
  return state.order.slice().sort((a, b) => {
    const A = state.players[a];
    const B = state.players[b];
    return B.perritas - A.perritas || (tb ? B.pemolares - A.pemolares : 0);
  });
}

export class PlayerLeaderboard {
  constructor(root) {
    this.root = root;
    this.shown = {}; // playerId → { perritas, pemolares }
    this.cards = new Map();
    this.seenEvents = null;
  }

  render(state) {
    const ids = rankPlayers(state);
    const playing = state.phase !== 'LOBBY';
    this.root.hidden = !playing;
    if (!playing) return;
    // crea tarjetas faltantes
    for (const id of state.order) {
      if (this.cards.has(id)) continue;
      const p = state.players[id];
      const card = document.createElement('div');
      card.className = 'pcard';
      card.style.setProperty('--pc', p.color);
      card.innerHTML = `
        <div class="pcard-rank"></div>
        <div class="pcard-avatar">${avatarHtml(p, 50)}</div>
        <div class="pcard-main">
          <div class="pcard-name">${esc(p.name)}<span class="pcard-tags"></span></div>
          <div class="pcard-money">
            <span class="money perritas">${perritaSvg(24)}<b data-k="perritas">0</b></span>
            <span class="money pemolares">${pemolarSvg(20)}<b data-k="pemolares">0</b></span>
            <span class="money shots" ${state.config.shotsEnabled ? '' : 'hidden'}>${shotSvg(20)}<b data-k="shots">0</b></span>
          </div>
        </div>
        <div class="pcard-pop"></div>`;
      this.root.appendChild(card);
      this.cards.set(id, card);
      this.shown[id] = { perritas: p.perritas, pemolares: p.pemolares, shots: p.shots || 0 };
    }
    for (const [id, card] of this.cards) {
      if (!state.players[id]) { card.remove(); this.cards.delete(id); }
    }
    // orden + estado
    let rank = 0;
    let prev = null;
    ids.forEach((id, i) => {
      const p = state.players[id];
      const card = this.cards.get(id);
      const key = `${p.perritas}|${p.pemolares}`;
      if (key !== prev) rank = i + 1;
      prev = key;
      card.style.order = String(i);
      const look = `${p.char}|${p.companion || ''}`;
      if (card.dataset.look !== look) { card.dataset.look = look; card.querySelector('.pcard-avatar').innerHTML = avatarHtml(p, 50); }
      card.querySelector('.pcard-rank').textContent = rank;
      card.querySelector('.pcard-rank').dataset.rank = rank;
      card.classList.toggle('is-turn', id === state.currentPlayerId && !state.phase.startsWith('MINIGAME') && !state.final);
      card.classList.toggle('is-off', !p.connected);
      const tags = [];
      if (p.shield) tags.push('<span class="tag tag-shield" title="Escudo activo">ESCUDO</span>');
      if (p.isBot) tags.push('<span class="tag">BOT</span>');
      for (const it of p.items || []) tags.push(`<span class="tag-item">${itemIconSvg(it, 18)}</span>`);
      if (!p.connected) tags.push('<span class="tag tag-off">SIN CONEXIÓN</span>');
      const tagHtml = tags.join('');
      const tagEl = card.querySelector('.pcard-tags');
      if (tagEl.innerHTML !== tagHtml) tagEl.innerHTML = tagHtml;
      for (const k of ['perritas', 'pemolares', 'shots']) {
        if (this.shown[id][k] !== p[k]) this.tween(card, id, k, this.shown[id][k], p[k]);
        else card.querySelector(`[data-k="${k}"]`).textContent = p[k];
      }
    });
    // ventanita "+5" junto a la tarjeta
    if (this.seenEvents === null) this.seenEvents = state.eventSeq;
    for (const ev of state.events) {
      if (ev.id <= this.seenEvents) continue;
      this.seenEvents = ev.id;
      if (ev.type !== 'currency') continue;
      const card = this.cards.get(ev.playerId);
      if (!card) continue;
      const pop = document.createElement('div');
      pop.className = `pop ${ev.delta > 0 ? 'up' : 'down'}`;
      pop.innerHTML = `${ev.currency === 'perritas' ? perritaSvg(20) : pemolarSvg(18)}${ev.delta > 0 ? '+' : ''}${ev.delta}`;
      card.querySelector('.pcard-pop').appendChild(pop);
      setTimeout(() => pop.remove(), 1800);
    }
  }

  tween(card, id, k, from, to) {
    this.shown[id][k] = to;
    const elx = card.querySelector(`[data-k="${k}"]`);
    const money = elx.parentElement;
    money.classList.remove('bump');
    void money.offsetWidth;
    money.classList.add('bump');
    const t0 = performance.now();
    const dur = 700;
    const step = (t) => {
      const f = Math.min(1, (t - t0) / dur);
      elx.textContent = Math.round(from + (to - from) * f);
      if (f < 1 && this.shown[id][k] === to) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
