// TV / pantalla del host conectada al servidor.
/* global QRCode */
import { Net } from './net.js';
import { GameScreen } from './screen.js';
import { lobbyPlayersHtml, howToHtml } from './lobby.js';
import { settingsHtml, readSettings } from './settings.js';
import { esc } from './assets.js';

const socket = new Net();
const params = new URLSearchParams(location.search);
const watchCode = params.get('watch');
const STORE = 'ma-host';

let meta = null;
let code = null;
let isHost = false;
let state = null;
let joinBase = location.origin;

const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; } };
const save = (v) => { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

const screen = new GameScreen(document.getElementById('screen'), {
  isHost: !watchCode,
  onHostAction: (a) => hostAction(a),
});
const lobbyEl = document.getElementById('lobby');
const modal = document.getElementById('modal');

function hostAction(action) {
  if (!isHost) return;
  socket.emit('host:action', action, (res) => {
    if (!res?.ok && res?.error) toast(res.error);
  });
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'chip';
  t.style.cssText = 'position:fixed;left:50%;bottom:24px;translate:-50% 0;z-index:50;background:#ffd6da';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

fetch('/api/info').then((r) => r.json()).then((info) => {
  if (['localhost', '127.0.0.1'].includes(location.hostname) && info.lan?.length) joinBase = info.lan[0];
  if (state) renderLobby();
}).catch(() => {});

function connect() {
  if (watchCode) {
    socket.emit('tv:watch', { code: watchCode }, (res) => {
      if (!res.ok) toast(res.error);
      code = res.code;
    });
    return;
  }
  const saved = load();
  const create = () => socket.emit('host:create', {}, (res) => {
    code = res.code;
    isHost = true;
    save({ code: res.code, hostToken: res.hostToken });
  });
  if (saved?.code && !params.has('new')) {
    socket.emit('host:attach', saved, (res) => {
      if (res.ok) { code = res.code; isHost = true; } else create();
    });
  } else create();
}

socket.on('connect', connect);
socket.on('meta', (m) => { meta = m; code = m.code; screen.setCode(m.code); });
socket.on('state', (msg) => {
  state = msg.state;
  if (msg.host) isHost = true;
  screen.setServerNow(msg.serverNow);
  screen.render(state);
  renderLobby();
});

let lobbyKey = '';
function renderLobby() {
  const show = state && state.phase === 'LOBBY';
  lobbyEl.hidden = !show;
  if (!show) return;
  const url = `${joinBase}/play?room=${code}`;
  const key = JSON.stringify([state.order.map((id) => [id, state.players[id].name, state.players[id].color, state.players[id].hat]), url, isHost, state.config.perritaPrice]);
  if (key === lobbyKey) return;
  lobbyKey = key;
  lobbyEl.innerHTML = `<div class="lobby-inner">
    <h1 class="title-big">MICHELSON'S <span>ARCADE</span></h1>
    <p class="subtitle">Fiesta de tablero en Isla Gomita</p>
    <div class="lobby-grid">
      <section class="panel join-panel">
        <p>Entra desde tu celular con el código</p>
        <div class="code">${esc(code)}</div>
        <div class="qr" aria-hidden="true"></div>
        <div class="join-url">${esc(url)}</div>
        <p class="muted">Todos deben estar en la misma red Wi-Fi que esta pantalla.</p>
      </section>
      <section class="panel players-panel">
        <h2>Jugadores <small class="muted">${state.order.length}/${meta?.maxPlayers || 8}</small></h2>
        <div class="lobby-players">${lobbyPlayersHtml(state, { removable: isHost, max: meta?.maxPlayers || 8 })}</div>
        ${isHost ? `<div class="lobby-actions" style="margin-top:16px">
          <button class="btn ghost" data-l="bot">+ Bot</button>
          <button class="btn blue" data-l="settings">Configuración</button>
          <button class="btn alt start" data-l="start" ${state.order.length < 2 ? 'disabled' : ''}>¡A jugar!</button>
        </div>
        <p class="muted" style="text-align:center">${state.order.length < 2 ? 'Se necesitan al menos 2 jugadores (puedes agregar bots).' : `${state.config.totalRounds} rondas · dado ${state.config.diceMin}–${state.config.diceMax} · Perrita a ${state.config.perritaPrice} Pemolares`}</p>` : ''}
      </section>
    </div>
    ${howToHtml(state.config.perritaPrice)}
    ${isHost ? '<p style="text-align:center"><a class="btn small ghost" href="/tv?new=1">Crear sala nueva</a></p>' : ''}
  </div>`;
  const qr = lobbyEl.querySelector('.qr');
  if (qr && typeof QRCode !== 'undefined') {
    qr.style.cssText = 'display:flex;justify-content:center;margin:8px 0';
    // eslint-disable-next-line no-new
    new QRCode(qr, { text: url, width: 180, height: 180, colorDark: '#2a1d5c', colorLight: '#ffffff' });
  }
}

lobbyEl.addEventListener('click', (e) => {
  const r = e.target.closest('[data-remove]');
  if (r) return hostAction({ type: 'REMOVE_PLAYER', playerId: r.dataset.remove });
  const b = e.target.closest('[data-l]');
  if (!b) return;
  if (b.dataset.l === 'bot') hostAction({ type: 'ADD_BOT' });
  if (b.dataset.l === 'start') hostAction({ type: 'START' });
  if (b.dataset.l === 'settings') openSettings();
});

function openSettings() {
  modal.hidden = false;
  modal.innerHTML = `<div class="panel settings-panel" role="dialog" aria-label="Configuración"><h2>Configuración <button class="btn small" data-close>Listo</button></h2>${settingsHtml(state.config, meta)}</div>`;
}
modal.addEventListener('click', (e) => {
  if (e.target === modal || e.target.closest('[data-close]')) { modal.hidden = true; modal.innerHTML = ''; }
});
let cfgTimer = null;
modal.addEventListener('change', () => {
  clearTimeout(cfgTimer);
  cfgTimer = setTimeout(() => {
    const form = modal.querySelector('form.settings');
    if (form) hostAction({ type: 'UPDATE_CONFIG', config: readSettings(form, meta) });
  }, 150);
});
