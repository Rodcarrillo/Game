// Pantalla principal (TV): tablero + HUD + capas + barra superior + ticker.
// La usan la TV conectada al servidor y el modo local del artefacto.

import { GameBoard } from './board-view.js';
import { PlayerLeaderboard } from './hud.js';
import { Overlays, clock } from './overlays.js';
import { esc } from './assets.js';

export class GameScreen {
  constructor(root, { isHost = false, local = false, onHostAction = () => {}, extraTop = '' } = {}) {
    this.root = root;
    this.isHost = isHost;
    this.local = local;
    this.onHostAction = onHostAction;
    root.classList.add('stage');
    root.innerHTML = `
      <div class="board-host"></div>
      <div class="topbar">
        <span class="chip logo">MICHELSON'S ARCADE</span>
        <span class="chip round" hidden></span>
        <span class="chip code" hidden></span>
        <span class="host-btns"></span>
        ${extraTop}
      </div>
      <div class="hud" hidden></div>
      <div class="ticker" aria-live="polite"></div>
      <div class="overlay"></div>`;
    this.board = new GameBoard(root.querySelector('.board-host'));
    this.hud = new PlayerLeaderboard(root.querySelector('.hud'));
    const hudEl = root.querySelector('.hud');
    this.board.getInsets = () => {
      if (hudEl.hidden) return { right: 0, bottom: 0 };
      const narrow = root.clientWidth <= 900;
      return narrow ? { right: 0, bottom: hudEl.offsetHeight } : { right: hudEl.offsetWidth + 20, bottom: 0 };
    };
    this.overlays = new Overlays(root.querySelector('.overlay'), {
      isHost,
      local,
      onAction: (kind) => {
        if (kind === 'card' && this.state) this.overlays.showCard(this.state);
        else if (kind === 'share') this.share();
        else onHostAction({ type: kind === 'resume' ? 'RESUME' : kind === 'again' ? 'RESET' : kind });
      },
    });
    this.roundChip = root.querySelector('.round');
    this.codeChip = root.querySelector('.code');
    this.hostBtns = root.querySelector('.host-btns');
    this.ticker = root.querySelector('.ticker');
    this.hostBtns.addEventListener('click', (e) => {
      const b = e.target.closest('[data-host]');
      if (!b) return;
      if (b.dataset.host === 'fullscreen') {
        const p = document.documentElement.requestFullscreen?.();
        if (p && p.catch) p.catch(() => {});
        return;
      }
      onHostAction({ type: b.dataset.host });
    });
  }

  setCode(code) {
    this.codeChip.hidden = !code;
    this.codeChip.innerHTML = code ? `<small>Sala</small> ${esc(code)}` : '';
  }

  setServerNow(serverNow) {
    if (serverNow) clock.offset = serverNow - Date.now();
  }

  render(state) {
    this.state = state;
    this.board.setState(state);
    this.hud.render(state);
    this.overlays.render(state);
    const playing = state.phase !== 'LOBBY';
    this.roundChip.hidden = !playing || !state.round;
    if (playing) this.roundChip.innerHTML = `Ronda <b>${Math.min(state.round, state.config.totalRounds)}</b>/${state.config.totalRounds}`;
    let hb = '';
    if (this.isHost && playing && state.phase !== 'WINNER_REVEAL') {
      hb = state.paused
        ? '<button class="btn small mint" data-host="RESUME">Reanudar</button>'
        : '<button class="btn small ghost" data-host="PAUSE">Pausa</button>';
    }
    if (document.fullscreenEnabled && !this.local) hb += ' <button class="btn small ghost" data-host="fullscreen" aria-label="Pantalla completa">⛶</button>';
    if (this.hostBtns.dataset.v !== hb) {
      this.hostBtns.dataset.v = hb;
      this.hostBtns.innerHTML = hb;
    }
    const lines = playing ? state.log.slice(-3) : [];
    const th = lines.map((l) => `<div>${esc(l)}</div>`).join('');
    if (this.ticker.dataset.v !== th) {
      this.ticker.dataset.v = th;
      this.ticker.innerHTML = th;
    }
  }

  async share() {
    const c = this.overlays.cardCanvas;
    if (!c) return;
    try {
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const file = new File([blob], 'michelsons-arcade.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "MICHELSON'S ARCADE" });
    } catch { /* el usuario canceló o no hay soporte */ }
  }
}
