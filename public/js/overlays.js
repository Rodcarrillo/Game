// Capas de la TV por fase: intro, turno, dado (DiceRoller), ruta, tienda
// (PerritaShop), resultado de casilla, minijuegos (MiniGameBridge en pantalla)
// y resultados finales (FinalResults) con tarjeta para compartir.

import { avatarHtml, perritaSvg, pemolarSvg, shotSvg, dieFaceSvg, companionSvg, itemIconSvg, TILE_STYLE, esc } from './assets.js';
import { MG_VIEWS, tickLiveClocks } from './minigame-views.js';
import { DOG_PATH } from './assets.js';
import { rankPlayers } from './hud.js';

export const clock = {
  offset: 0,
  now() { return Date.now() + this.offset; },
};

const name = (s, id) => esc(s.players[id]?.name ?? '');
const avatar = (s, id, size = 64, mood) => {
  const p = s.players[id];
  return p ? avatarHtml(p, Math.round(size * 1.25), { crown: mood === 'crown' }) : '';
};

function dieFaces(value, max) {
  const others = [];
  for (let i = 1; others.length < 5; i++) {
    const v = ((value + i * 3) % max) + 1;
    others.push(v === value ? ((v % max) + 1) : v);
  }
  return `<div class="die-face f1">${dieFaceSvg(value)}</div>${others.map((v, i) => `<div class="die-face f${i + 2}">${dieFaceSvg(v)}</div>`).join('')}`;
}

/** Dado negro con anillos de luz. */
function dieBlock(cls, value, max, i = 0) {
  return `<div class="die-wrap" style="--i:${i}"><i class="orbit"></i><i class="orbit o2"></i><div class="die ${cls}">${dieFaces(value, max)}</div></div>`;
}

export const itemIcon = (id) => itemIconSvg(id, 38);

export class Overlays {
  constructor(root, { isHost = false, local = false, onAction = () => {} } = {}) {
    this.root = root;
    this.isHost = isHost;
    this.local = local;
    this.onAction = onAction;
    this.last = '';
    this.remainingCache = new Map();
    this.t0s = new Map();
    this.cardUrl = null;
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ov]');
      if (b) this.onAction(b.dataset.ov, b);
    });
    const loop = () => {
      tickLiveClocks(this.root);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  remaining(state) {
    if (!state.timer) return 0;
    const key = state.timer.seq;
    if (!this.remainingCache.has(key)) {
      this.remainingCache.set(key, Math.max(0, state.timer.at - clock.now()));
      if (this.remainingCache.size > 50) this.remainingCache.delete(this.remainingCache.keys().next().value);
    }
    return this.remainingCache.get(key);
  }

  countdown(state) {
    if (!state.timer || state.paused) return '';
    const ms = this.remaining(state);
    return `<div class="countdown"><i style="animation-duration:${ms}ms"></i></div>`;
  }

  render(state) {
    const html = state.paused ? this.pausedHtml(state) : this.html(state);
    if (html !== this.last) {
      this.last = html;
      this.root.innerHTML = html;
      if (state.phase === 'WINNER_REVEAL') this.afterWinner(state);
    }
    this.shotEvents(state);
  }

  /** Avisos de "¡SHOT!" que no dependen de la fase. */
  shotEvents(state) {
    if (!this.fx) {
      this.fx = document.createElement('div');
      this.fx.className = 'shot-fx';
      this.root.parentElement.appendChild(this.fx);
    }
    if (this.seenShots == null) { this.seenShots = state.eventSeq; return; }
    const word = state.config.shotWord === 'trago' ? 'TRAGO' : 'SHOT';
    let delay = 0;
    for (const ev of state.events) {
      if (ev.id <= this.seenShots) continue;
      this.seenShots = ev.id;
      if (!['shot-saved', 'shot-pass', 'companion'].includes(ev.type)) continue;
      const p = state.players[ev.playerId];
      if (!p) continue;
      let html;
      if (ev.type === 'shot') html = `${shotSvg(64)}<div><b>¡${word}${ev.n > 1 ? ` ×${ev.n}` : ''}!</b><span>${esc(p.name)}</span><small>${esc(ev.reason || '')}</small></div>`;
      else if (ev.type === 'shot-saved') html = `<div><b>¡Salvado!</b><span>${esc(p.name)}</span><small>${esc(ev.reason)}</small></div>`;
      else if (ev.type === 'shot-pass') html = `<div><b>¡Pásalo!</b><span>${esc(p.name)} → ${esc(state.players[ev.to]?.name || '')}</span></div>`;
      else html = `${companionSvg(ev.companion, 70)}<div><b>¡Llegó acompañado!</b><span>${esc(p.name)}</span><small>Ganó en el Safari</small></div>`;
      const el = document.createElement('div');
      el.className = `shot-pop ${ev.type}`;
      el.style.setProperty('--pc', p.color);
      el.style.animationDelay = `${delay}ms`;
      el.innerHTML = `<span class="sp-av">${avatarHtml(p, 70)}</span>${html}`;
      this.fx.appendChild(el);
      setTimeout(() => el.remove(), 2600 + delay);
      delay += 450;
      if (navigator.vibrate && ev.type === 'shot') { /* sólo celulares */ }
    }
  }

  pausedHtml(state) {
    return `<div class="ov-center"><div class="banner paused"><h2>Pausa</h2><p>${this.isHost ? 'Pulsa Reanudar para seguir' : 'El host pausó la partida'}</p>
      ${this.isHost ? '<button class="btn" data-ov="resume">Reanudar</button>' : ''}</div></div>`;
  }

  html(s) {
    switch (s.phase) {
      case 'LOBBY':
        return '';
      case 'BOARD_INTRO':
        return `<div class="ov-center"><div class="banner intro"><small>Bienvenidos a</small><h1>Isla Pemol</h1>
          <p>${s.config.totalRounds} rondas · compra Perritas con tus Pemolares · gana quien tenga más Perritas</p>
          ${s.config.shotsEnabled ? `<p class="adult">Juego para mayores de 18 · aquí se pierde y se toma. Hidrátense entre rondas.</p>` : ''}
          <div class="intro-money"><span>${perritaSvg(44)} Perritas</span><span>${pemolarSvg(40)} Pemolares</span></div></div></div>`;
      case 'TURN_START': {
        const id = s.currentPlayerId;
        const last = s.round === s.config.totalRounds;
        return `<div class="ov-turn" style="--pc:${s.players[id].color}"><div class="turn-ribbon">${avatar(s, id, 70)}<div><small>Ronda ${s.round} de ${s.config.totalRounds}${last ? ' · ¡última!' : ''}</small><b>Turno de ${name(s, id)}</b></div></div></div>`;
      }
      case 'DICE_ROLL': {
        const id = s.currentPlayerId;
        const p = s.players[id];
        const hint = p.isBot ? 'Pensando…' : this.local ? 'Pulsa TIRAR o la barra espaciadora' : '¡Tira desde tu celular!';
        const dm = s.pending?.dice;
        const n = dm?.item === 'double' ? 2 : dm?.item === 'triple' ? 3 : 1;
        const label = dm ? { double: 'Dado doble', triple: 'Dado triple', choice: `Dado a elección: ${dm.value}`, slow: 'Dado lento (1–3)' }[dm.item] : `${s.config.diceMin}–${s.config.diceMax}`;
        const dice = Array.from({ length: n }, (_, i) => dieBlock('idle', ((i * 2) % 6) + 1, 6, i)).join('');
        const tappable = this.local && !p.isBot;
        return `<div class="ov-dice zoom">${tappable ? `<button class="die-tap" data-ov="roll" aria-label="Tirar el dado"><div class="dice-row">${dice}</div></button><div class="tap-hint">¡Toca el dado!</div>` : `<div class="dice-row">${dice}</div>`}
          <div class="dice-hint"><b>${name(s, id)}</b>, tira el dado · ${label}<small>${tappable ? 'O pulsa la barra espaciadora' : hint}</small></div>${this.countdown(s)}</div>`;
      }
      case 'MOVEMENT': {
        if (!s.anim || !s.anim.delay || !s.lastRoll) return '';
        const dice = (s.lastRoll.dice || [s.lastRoll.value]).map((v, i) => dieBlock('roll', v, s.config.diceMax, i)).join('');
        return `<div class="ov-dice"><div class="dice-row">${dice}</div>
          <div class="dice-result" style="animation-delay:${s.anim.delay - 150}ms">¡${s.lastRoll.value}!</div></div>`;
      }
      case 'ROUTE_CHOICE': {
        const pend = s.pending;
        return `<div class="ov-low"><div class="card route-card"><h3>${name(s, pend.playerId)} elige camino</h3>
          <div class="routes">${pend.options.map((o, i) => `<div class="route ${'ab'[i]}"><b>${'AB'[i]}</b><div><strong>${esc(o.label)}</strong><small>${esc(o.risk)}</small></div></div>`).join('')}</div>
          <p class="muted">Le quedan ${pend.stepsLeft} paso${pend.stepsLeft === 1 ? '' : 's'}</p>${this.countdown(s)}</div></div>`;
      }
      case 'SHOP': {
        const pend = s.pending;
        const p = s.players[pend.playerId];
        let body;
        if (pend.done === 'bought') {
          body = `<div class="shop-done">${perritaSvg(70)}<b>¡${name(s, p.id)} compró ${pend.bought} Perrita${pend.bought > 1 ? 's' : ''}!</b></div>`;
        } else if (pend.done === 'skipped') {
          body = `<div class="shop-done"><b>${name(s, p.id)} siguió de largo</b></div>`;
        } else {
          body = `<div class="shop-row"><div class="shop-price">${perritaSvg(54)}<span>=</span>${pemolarSvg(40)}<b>${pend.price}</b></div>
            <div class="shop-bal">Tiene ${pemolarSvg(22)} <b>${p.pemolares}</b></div></div>
            <p class="muted">${pend.canBuy ? `Puede comprar hasta ${pend.maxQty}` : 'No le alcanza. ¡Junta más Pemolares!'}${pend.passing ? ' · va de paso' : ''}</p>${this.countdown(s)}`;
        }
        return `<div class="ov-low"><div class="card shop-card"><div class="shop-awning"></div><h3>Tienda de Perritas</h3>${body}</div></div>`;
      }
      case 'SHOT_CONFIRM': {
        const pend = s.pending;
        const word = (s.config.shotWord || 'shot').toUpperCase();
        const p = s.players[pend.playerId];
        const canPress = this.isHost || this.local;
        return `<div class="ov-shot"><div class="shot-card"><div class="who">${avatar(s, pend.playerId, 120)}${shotSvg(110)}</div>
          <h2>${name(s, pend.playerId)} TOMA ${word}${pend.n > 1 ? ` ×${pend.n}` : ''}<small>${esc(pend.reason || '')}</small></h2>
          ${canPress ? `<button class="btn" data-ov="shotok">Continuar</button>` : ''}
          <p>${p?.isBot ? 'El bot se lo toma…' : this.local ? 'Pulsa Continuar (o la barra espaciadora) cuando se lo tome' : `${name(s, pend.playerId)} pulsa Continuar en su celular`}</p></div></div>`;
      }
      case 'PLACE': {
        const pend = s.pending;
        return `<div class="ov-low"><div class="card place-card"><span class="tile-kind" style="--tc:#ff5a1f">Entrada</span><h3>${esc(pend.name)}</h3>
          <p class="what">${esc(pend.what)}</p><p class="muted">${name(s, pend.playerId)} decide si entra</p>${this.countdown(s)}</div></div>`;
      }
      case 'ITEM_SHOP': {
        const pend = s.pending;
        const p = s.players[pend.playerId];
        const done = pend.done;
        return `<div class="ov-low"><div class="card item-shop ${done ? 'closed' : ''}"><div class="stall-roof"></div><h3>Tienda de objetos</h3>
          <div class="item-grid">${pend.catalog.map((it, i) => `<div class="item ${pend.bought.includes(it.id) ? 'sold' : ''} ${it.price > p.pemolares ? 'pricey' : ''}" style="--d:${i * 70}ms"><span class="ii">${itemIcon(it.id)}</span><b>${esc(it.name)}</b><span class="ip">${pemolarSvg(16)} ${it.price}</span></div>`).join('')}</div>
          <p class="muted">${done ? (pend.bought.length ? `${name(s, p.id)} se llevó: ${pend.bought.map((b) => esc(pend.catalog.find((c) => c.id === b)?.name)).join(', ')}` : `${name(s, p.id)} no compró nada`) : `${name(s, p.id)} tiene ${p.pemolares} Pemolares · objetos ${p.items.length}/${pend.maxItems}`}</p>
          ${done ? '' : this.countdown(s)}</div></div>`;
      }
      case 'SAFARI': {
        const pend = s.pending;
        const r = pend.result;
        const body = !r
          ? `<p>${name(s, pend.playerId)} apuesta Pemolares contra la casa: si su dado sale más alto, gana el doble${pend.hasCompanion ? '' : ' y se lleva una acompañante'}.</p>
             <div class="bets">${pend.bets.map((b) => `<span>${pemolarSvg(18)} ${b}</span>`).join('')}</div>${this.countdown(s)}`
          : `<div class="safari-roll"><div><small>${name(s, pend.playerId)}</small>${dieBlock('roll', r.you, 6)}</div><b>VS</b><div><small>La casa</small>${dieBlock('roll', r.house, 6, 1)}</div></div>
             <h3 class="${r.win ? 'win' : 'lose'}">${r.win ? `¡Ganó ${r.bet} Pemolares!` : `Perdió ${r.bet} Pemolares`}</h3>
             ${r.companion ? `<div class="comp-reveal">${companionSvg(r.companion, 110)}<p>¡Y se va acompañado el resto de la partida!</p></div>` : ''}`;
        return `<div class="ov-low"><div class="card safari-card"><span class="tile-kind" style="--tc:#8aa53a">Safari</span><h3>Zona Safari</h3>${body}</div></div>`;
      }
      case 'EXAM': {
        const pend = s.pending;
        const r = pend.result;
        return `<div class="ov-low"><div class="card exam-card"><span class="tile-kind" style="--tc:#2f6fe0">Escuela Piaget · Examen</span>
          <p class="exam-q">${esc(pend.statement)}</p>
          ${r ? `<h3 class="${r.ok ? 'win' : 'lose'}">${r.ok ? '¡Aprobado! +5 Pemolares' : `Reprobado${s.config.shotsEnabled ? ` · ¡${s.config.shotWord}!` : ' · −3 Pemolares'}`}</h3><p class="muted">Era ${r.correct === 'fact' ? 'FACT (dato real)' : 'CAP (mentira)'}</p>`
            : `<p class="muted">${name(s, pend.playerId)} responde: ¿CAP o FACT?</p>${this.countdown(s)}`}</div></div>`;
      }
      case 'SHOT_GIFT': {
        const pend = s.pending;
        const word = s.config.shotWord;
        return `<div class="ov-low"><div class="card gift-card">${shotSvg(48)}<h3>${name(s, pend.playerId)} reparte ${pend.total} ${word}${pend.total > 1 ? 's' : ''}</h3>
          <p class="muted">${esc(pend.reason || '')}</p>
          <div class="gift-left">${Array.from({ length: pend.total }, (_, i) => `<span class="${i < pend.given.length ? 'used' : ''}">${i < pend.given.length ? name(s, pend.given[i]) : '?'}</span>`).join('')}</div>
          ${pend.remaining ? this.countdown(s) : ''}</div></div>`;
      }
      case 'TILE_RESOLUTION': {
        const t = s.lastTile;
        if (!t) return '';
        const st = TILE_STYLE[t.tileType] || TILE_STYLE.pemolar_plus;
        return `<div class="ov-low"><div class="card tile-card tone-${t.tone}" style="--tc:${st.top}">
          <span class="tile-kind">${esc(st.label)}</span><h3>${esc(t.title)}</h3><p>${esc(t.text)}</p></div></div>`;
      }
      case 'MINIGAME_INTRO': {
        const mg = s.minigame;
        const duel = mg.participants.length === 2;
        const who = duel
          ? `<div class="vs">${avatar(s, mg.participants[0], 96)}<b>VS</b>${avatar(s, mg.participants[1], 96)}</div><p class="mg-who">${name(s, mg.participants[0])} contra ${name(s, mg.participants[1])}</p>`
          : `<div class="mg-row">${mg.participants.map((id) => `<div class="mg-chip">${avatar(s, id, 52)}<span>${name(s, id)}</span></div>`).join('')}</div>`;
        return `<div class="ov-full mg-intro"><div class="mg-panel">
          <small class="mg-src">${mg.source === 'round' ? 'Minijuego de ronda' : duel ? 'Duelo' : 'Minijuego'}</small>
          <h1 class="mg-title">${esc(mg.name)}</h1><p class="mg-tag">${esc(mg.tagline)}</p>
          <div class="mg-howto">${esc(mg.instructions)}</div>${who}
          <div class="mg-rewards">1º ${pemolarSvg(22)} +${s.config.minigameRewards.first} · ${duel ? '' : `2º +${s.config.minigameRewards.second} · `}participar +${s.config.minigameRewards.participation}</div>
          ${this.countdown(s)}</div></div>`;
      }
      case 'MINIGAME_PLAYING': {
        const mg = s.minigame;
        const view = MG_VIEWS[mg.gameId];
        if (!view || !mg.view) return '';
        const ctx = {
          countdown: () => this.countdown(s),
          t0: (step) => {
            const k = `${mg.key}:${step}`;
            if (!this.t0s.has(k)) this.t0s.set(k, performance.now());
            return this.t0s.get(k);
          },
        };
        return `<div class="ov-full mg-play"><div class="mg-panel wide"><div class="mg-title small">${esc(mg.name)}</div>${view.tv(s, mg.view, ctx)}</div></div>`;
      }
      case 'MINIGAME_RESULTS': {
        const mg = s.minigame;
        return `<div class="ov-full mg-results"><div class="mg-panel"><div class="mg-title small">${esc(mg.name)} · Resultados</div>
          <ol class="podium">${mg.results.map((r) => `<li class="place-${r.place}"><span class="pl">${r.place}º</span>${avatar(s, r.playerId, 48, r.place === 1 ? 'wow' : undefined)}<span class="pn">${name(s, r.playerId)}</span><span class="ps">${esc(r.label)}</span><span class="pr">${pemolarSvg(22)}+${r.reward}</span>${r.shots ? `<span class="pshot">${shotSvg(24)}×${r.shots}</span>` : ''}</li>`).join('')}</ol>
          ${this.countdown(s)}</div></div>`;
      }
      case 'BOARD_END':
        return `<div class="ov-center"><div class="banner end"><h1>¡Se acabó el tablero!</h1><p>Contemos las Perritas…</p></div></div>`;
      case 'FINAL_BONUSES': {
        const b = s.final.bonuses;
        return `<div class="ov-full final"><div class="mg-panel"><div class="mg-title small">Bonos finales</div>
          ${b.length ? `<div class="bonuses">${b.map((x, i) => `<div class="bonus" style="animation-delay:${i * 2600 + 300}ms"><h3>${esc(x.title)}</h3><p>${esc(x.desc)} (${x.value})</p>
            <div class="bonus-win">${x.winners.map((id) => `${avatar(s, id, 54, 'wow')}<b>${name(s, id)}</b>`).join('')}<span>${perritaSvg(36)}+1</span></div></div>`).join('')}</div>` : '<p class="muted">Sin bonos esta vez.</p>'}
        </div></div>`;
      }
      case 'FINAL_LEADERBOARD':
        return `<div class="ov-full final"><div class="mg-panel"><div class="mg-title small">Clasificación final</div>${this.rankingTable(s)}</div></div>`;
      case 'WINNER_REVEAL':
        return this.winnerHtml(s);
      default:
        return '';
    }
  }

  rankingTable(s) {
    const r = s.final.ranking;
    return `<table class="rank-table"><thead><tr><th></th><th>Jugador</th><th>${perritaSvg(26)}<span class="sr">Perritas</span></th><th>${pemolarSvg(24)}<span class="sr">Pemolares</span></th><th>Minijuegos</th>${s.config.shotsEnabled ? `<th>${shotSvg(24)}<span class="sr">${s.config.shotWord}s</span></th>` : ''}</tr></thead><tbody>
      ${r.slice().reverse().map((x, i) => `<tr style="animation-delay:${i * 450}ms" class="${x.rank === 1 ? 'first' : ''}"><td class="rk">${x.rank}º</td><td class="who">${avatar(s, x.playerId, 38)}${name(s, x.playerId)}</td><td class="num">${x.perritas}</td><td class="num">${x.pemolares}</td><td class="num">${x.minigameWins}</td>${s.config.shotsEnabled ? `<td class="num">${s.players[x.playerId].shots}</td>` : ''}</tr>`).reverse().join('')}
    </tbody></table>`;
  }

  winnerHtml(s) {
    const win = s.final.winners;
    const tie = win.length > 1;
    return `<div class="ov-full winner"><canvas class="confetti"></canvas><div class="winner-wrap">
      <div class="winner-hero">
        <div class="winner-avatars">${win.map((id) => `<div class="w-av">${avatar(s, id, 170, 'crown')}</div>`).join('')}</div>
        <small>${tie ? 'Empate en la cima' : 'Ganador de Isla Pemol'}</small>
        <h1>${win.map((id) => name(s, id)).join(' y ')}</h1>
        <p>${perritaSvg(30)} ${s.players[win[0]].perritas} Perritas · ${pemolarSvg(26)} ${s.players[win[0]].pemolares} Pemolares</p>
      </div>
      <div class="winner-side">
        ${this.rankingTable(s)}
        ${s.final.awards?.length ? `<div class="awards">${s.final.awards.map((a) => `<div class="award"><b>${esc(a.title)}</b><span>${name(s, a.playerId)}</span><small>${esc(a.desc)}: ${a.value}</small></div>`).join('')}</div>` : ''}
        <div class="winner-actions">
          <button class="btn" data-ov="card">Tarjeta de resultados</button>
          ${this.isHost ? '<button class="btn alt" data-ov="again">Jugar otra vez</button>' : ''}
        </div>
        <div class="card-preview" hidden></div>
      </div></div></div>`;
  }

  afterWinner(state) {
    const c = this.root.querySelector('.confetti');
    if (c && !matchMedia('(prefers-reduced-motion: reduce)').matches) confetti(c);
    this.state = state;
  }

  showCard(state) {
    const box = this.root.querySelector('.card-preview');
    if (!box) return;
    const canvas = resultsCard(state);
    const url = canvas.toDataURL('image/png');
    box.hidden = false;
    box.innerHTML = `<img src="${url}" alt="Tarjeta de resultados"><div class="card-actions">${this.local ? '<small>Mantén presionada o clic derecho en la imagen para guardarla.</small>' : `<a class="btn small" download="michelsons-arcade-resultados.png" href="${url}">Descargar</a><button class="btn small alt" data-ov="share">Compartir</button>`}</div>`;
    this.cardCanvas = canvas;
  }
}

// --- confeti ---
function confetti(canvas) {
  const ctx = canvas.getContext('2d');
  const W = (canvas.width = canvas.offsetWidth || 1200);
  const H = (canvas.height = canvas.offsetHeight || 800);
  const colors = ['#ff5fae', '#ffc531', '#3d8bff', '#2ecc8f', '#b06bff', '#ff6b4a'];
  const parts = Array.from({ length: 160 }, () => ({
    x: Math.random() * W, y: -Math.random() * H, vy: 2 + Math.random() * 3, vx: -1 + Math.random() * 2,
    r: Math.random() * Math.PI, vr: -0.1 + Math.random() * 0.2, c: colors[Math.floor(Math.random() * colors.length)], s: 6 + Math.random() * 8,
  }));
  let frames = 0;
  const step = () => {
    if (!canvas.isConnected || frames++ > 900) return;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    requestAnimationFrame(step);
  };
  step();
}

// --- tarjeta de resultados compartible ---
function star(ctx, x, y, r) {
  // moneda Perrita: disco dorado con perrito
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffb400';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1b2440';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.76, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd84a';
  ctx.fill();
  const k = (r * 1.45) / 64;
  ctx.save();
  ctx.translate(x - 32 * k + 2, y - 32 * k + 2);
  ctx.scale(k, k);
  ctx.fillStyle = '#f29a00';
  ctx.fill(new Path2D(DOG_PATH));
  ctx.restore();
}

export function resultsCard(s) {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 1350);
  g.addColorStop(0, '#1e3fae');
  g.addColorStop(1, '#0b1f66');
  x.fillStyle = g;
  x.fillRect(0, 0, 1080, 1350);
  const font = (w, px) => `${w} ${px}px "Lilita One", "Baloo 2", system-ui, sans-serif`;
  x.fillStyle = '#ffffff';
  x.textAlign = 'center';
  x.font = font(400, 54);
  x.fillText("MICHELSON'S ARCADE", 540, 110);
  x.font = font(700, 34);
  x.fillText(`Isla Pemol · ${s.config.totalRounds} rondas`, 540, 162);
  const win = s.final.winners;
  // panel ganador
  const rr = (X, Y, W, H, R, fill) => {
    x.beginPath();
    x.roundRect(X, Y, W, H, R);
    x.fillStyle = fill;
    x.fill();
    x.lineWidth = 8;
    x.strokeStyle = '#1b2440';
    x.stroke();
  };
  rr(80, 210, 920, 330, 46, '#fff');
  star(x, 540, 300, 62);
  x.fillStyle = '#1b2440';
  x.font = font(400, 78);
  x.fillText(win.map((id) => s.players[id].name).join(' y '), 540, 440);
  x.font = font(700, 36);
  x.fillText(`${s.players[win[0]].perritas} Perritas · ${s.players[win[0]].pemolares} Pemolares`, 540, 500);
  // ranking
  let y = 600;
  for (const r of s.final.ranking) {
    const p = s.players[r.playerId];
    rr(80, y, 920, 92, 30, r.rank === 1 ? '#fff4c4' : '#ffffff');
    x.fillStyle = p.color;
    x.beginPath();
    x.ellipse(190, y + 46, 26, 32, 0, 0, Math.PI * 2);
    x.fill();
    x.lineWidth = 5;
    x.strokeStyle = '#1b2440';
    x.stroke();
    x.fillStyle = '#1b2440';
    x.textAlign = 'left';
    x.font = font(400, 44);
    x.fillText(`${r.rank}º`, 108, y + 62);
    x.fillText(p.name, 236, y + 62);
    x.textAlign = 'right';
    x.font = font(400, 42);
    x.fillText(String(r.perritas), 790, y + 62);
    star(x, 830, y + 47, 22);
    x.fillStyle = '#1b2440';
    x.fillText(String(r.pemolares), 940, y + 62);
    x.beginPath();
    x.arc(966, y + 47, 15, 0, Math.PI * 2);
    x.fillStyle = '#7fc98f';
    x.fill();
    x.lineWidth = 4;
    x.strokeStyle = '#1b2440';
    x.stroke();
    x.textAlign = 'center';
    y += 112;
    if (y > 1220) break;
  }
  x.fillStyle = '#ffffff';
  x.font = font(700, 28);
  x.fillText(new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }), 540, 1310);
  return c;
}

export { rankPlayers };
