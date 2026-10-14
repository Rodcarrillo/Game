// Capas de la TV por fase: intro, turno, dado (DiceRoller), ruta, tienda
// (PerritaShop), resultado de casilla, minijuegos (MiniGameBridge en pantalla)
// y resultados finales (FinalResults) con tarjeta para compartir.

import { beanSvg, perritaSvg, pemolarSvg, TILE_STYLE, esc } from './assets.js';
import { MG_VIEWS, tickLiveClocks } from './minigame-views.js';
import { rankPlayers } from './hud.js';

export const clock = {
  offset: 0,
  now() { return Date.now() + this.offset; },
};

const name = (s, id) => esc(s.players[id]?.name ?? '');
const avatar = (s, id, size = 64, mood) => {
  const p = s.players[id];
  return p ? beanSvg(p.color, p.hat, size, { mood }) : '';
};

function dieFaces(value, max) {
  const others = [];
  for (let i = 1; others.length < 5; i++) {
    const v = ((value + i * 3) % max) + 1;
    others.push(v === value ? ((v % max) + 1) : v);
  }
  return `<div class="die-face f1">${value}</div>${others.map((v, i) => `<div class="die-face f${i + 2}">${v}</div>`).join('')}`;
}

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
        return `<div class="ov-center"><div class="banner intro"><small>Bienvenidos a</small><h1>Isla Gomita</h1>
          <p>${s.config.totalRounds} rondas · compra Perritas con tus Pemolares · gana quien tenga más Perritas</p>
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
        return `<div class="ov-dice"><div class="die-wrap waiting"><div class="die idle">${'<div class="die-face f1">?</div><div class="die-face f2">?</div><div class="die-face f3">?</div><div class="die-face f4">?</div><div class="die-face f5">?</div><div class="die-face f6">?</div>'}</div></div>
          <div class="dice-hint"><b>${name(s, id)}</b>, tira el dado · ${s.config.diceMin}–${s.config.diceMax}<small>${hint}</small></div>${this.countdown(s)}</div>`;
      }
      case 'MOVEMENT': {
        if (!s.anim || !s.anim.delay || !s.lastRoll) return '';
        return `<div class="ov-dice"><div class="die-wrap"><div class="die roll">${dieFaces(s.lastRoll.value, s.config.diceMax)}</div></div>
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
          <ol class="podium">${mg.results.map((r) => `<li class="place-${r.place}"><span class="pl">${r.place}º</span>${avatar(s, r.playerId, 48, r.place === 1 ? 'wow' : undefined)}<span class="pn">${name(s, r.playerId)}</span><span class="ps">${esc(r.label)}</span><span class="pr">${pemolarSvg(24)}+${r.reward}</span></li>`).join('')}</ol>
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
    return `<table class="rank-table"><thead><tr><th></th><th>Jugador</th><th>${perritaSvg(26)}<span class="sr">Perritas</span></th><th>${pemolarSvg(24)}<span class="sr">Pemolares</span></th><th>Minijuegos</th></tr></thead><tbody>
      ${r.slice().reverse().map((x, i) => `<tr style="animation-delay:${i * 450}ms" class="${x.rank === 1 ? 'first' : ''}"><td class="rk">${x.rank}º</td><td class="who">${avatar(s, x.playerId, 38)}${name(s, x.playerId)}</td><td class="num">${x.perritas}</td><td class="num">${x.pemolares}</td><td class="num">${x.minigameWins}</td></tr>`).reverse().join('')}
    </tbody></table>`;
  }

  winnerHtml(s) {
    const win = s.final.winners;
    const tie = win.length > 1;
    return `<div class="ov-full winner"><canvas class="confetti"></canvas><div class="winner-wrap">
      <div class="winner-hero">
        <div class="winner-avatars">${win.map((id) => `<div class="w-av">${avatar(s, id, 170, 'wow')}</div>`).join('')}</div>
        <small>${tie ? 'Empate en la cima' : 'Ganador de Isla Gomita'}</small>
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
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.48 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffc531';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#2a1d5c';
  ctx.stroke();
}

export function resultsCard(s) {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 1350);
  g.addColorStop(0, '#8fd3ff');
  g.addColorStop(1, '#c7a8ff');
  x.fillStyle = g;
  x.fillRect(0, 0, 1080, 1350);
  const font = (w, px) => `${w} ${px}px "Lilita One", "Baloo 2", system-ui, sans-serif`;
  x.fillStyle = '#2a1d5c';
  x.textAlign = 'center';
  x.font = font(400, 54);
  x.fillText("MICHELSON'S ARCADE", 540, 110);
  x.font = font(700, 34);
  x.fillText(`Isla Gomita · ${s.config.totalRounds} rondas`, 540, 162);
  const win = s.final.winners;
  // panel ganador
  const rr = (X, Y, W, H, R, fill) => {
    x.beginPath();
    x.roundRect(X, Y, W, H, R);
    x.fillStyle = fill;
    x.fill();
    x.lineWidth = 8;
    x.strokeStyle = '#2a1d5c';
    x.stroke();
  };
  rr(80, 210, 920, 330, 46, '#fff');
  star(x, 540, 300, 62);
  x.fillStyle = '#2a1d5c';
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
    x.strokeStyle = '#2a1d5c';
    x.stroke();
    x.fillStyle = '#2a1d5c';
    x.textAlign = 'left';
    x.font = font(400, 44);
    x.fillText(`${r.rank}º`, 108, y + 62);
    x.fillText(p.name, 236, y + 62);
    x.textAlign = 'right';
    x.font = font(400, 42);
    x.fillText(String(r.perritas), 790, y + 62);
    star(x, 830, y + 47, 22);
    x.fillStyle = '#2a1d5c';
    x.fillText(String(r.pemolares), 940, y + 62);
    x.beginPath();
    x.arc(966, y + 47, 15, 0, Math.PI * 2);
    x.fillStyle = '#ffc94a';
    x.fill();
    x.lineWidth = 4;
    x.strokeStyle = '#2a1d5c';
    x.stroke();
    x.textAlign = 'center';
    y += 112;
    if (y > 1220) break;
  }
  x.fillStyle = '#2a1d5c';
  x.font = font(700, 28);
  x.fillText(new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }), 540, 1310);
  return c;
}

export { rankPlayers };
