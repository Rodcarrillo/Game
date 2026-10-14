// Control del jugador en el celular.
import { Net } from './net.js';
import { controlsHtml, walletHtml, bindActions } from './controls.js';
import { beanSvg, esc } from './assets.js';

const COLORS = ['#ff6b4a', '#3d8bff', '#ffc531', '#2ecc8f', '#b06bff', '#ff5fae', '#22c7d6', '#8a5a3c'];
const HATS = ['corona', 'gorra', 'moño', 'antena', 'cuernos', 'flor', 'chef', 'casco'];

const app = document.getElementById('app');
const socket = new Net();
const params = new URLSearchParams(location.search);
let code = (params.get('room') || '').toUpperCase();
let me = null;
let state = null;
let you = null;
let pick = { color: COLORS[Math.floor(Math.random() * COLORS.length)], hat: HATS[Math.floor(Math.random() * HATS.length)] };
let lastTurnKey = '';

const tokenKey = (c) => `ma-player-${c}`;
const getToken = (c) => { try { return localStorage.getItem(tokenKey(c)); } catch { return null; } };
const setToken = (c, t) => { try { localStorage.setItem(tokenKey(c), t); localStorage.setItem('ma-name', pick.name || ''); } catch { /* nada */ } };
const lastName = () => { try { return localStorage.getItem('ma-name') || ''; } catch { return ''; } };

function send(action) {
  socket.emit('player:action', action, (res) => {
    if (!res?.ok && res?.error) flash(res.error);
  });
}
bindActions(app, send);

function flash(msg) {
  const e = app.querySelector('.err');
  if (e) { e.textContent = msg; setTimeout(() => { if (e.textContent === msg) e.textContent = ''; }, 2500); }
}

function joinForm(error = '') {
  me = null;
  app.innerHTML = `
    <h1 class="title-big" style="font-size:52px">MICHELSON'S <span>ARCADE</span></h1>
    <form class="panel join-form" id="join" style="padding:18px">
      <label for="code-input">Código de sala<input id="code-input" maxlength="4" required value="${esc(code)}" autocapitalize="characters" autocomplete="off"></label>
      <label for="name-input">Tu nombre<input id="name-input" maxlength="16" required value="${esc(lastName())}" autocomplete="nickname"></label>
      <div class="preview-bean">${beanSvg(pick.color, pick.hat, 90)}</div>
      <div class="swatches">${COLORS.map((c) => `<button type="button" class="swatch" style="background:${c}" data-color="${c}" aria-label="Color ${c}" aria-pressed="${c === pick.color}"></button>`).join('')}</div>
      <div class="hats">${HATS.map((h) => `<button type="button" class="hat" data-hat="${h}" aria-pressed="${h === pick.hat}">${h}</button>`).join('')}</div>
      <p class="err" role="alert">${esc(error)}</p>
      <button class="btn alt" type="submit" style="font-size:28px">Entrar</button>
    </form>
    <p class="ph-foot">El tablero se ve en la tele. Este celular es tu control.</p>`;
  const form = app.querySelector('#join');
  form.addEventListener('click', (e) => {
    const c = e.target.closest('[data-color]');
    const h = e.target.closest('[data-hat]');
    if (!c && !h) return;
    if (c) pick.color = c.dataset.color;
    if (h) pick.hat = h.dataset.hat;
    form.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.color === pick.color));
    form.querySelectorAll('[data-hat]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.hat === pick.hat));
    form.querySelector('.preview-bean').innerHTML = beanSvg(pick.color, pick.hat, 90);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    code = form.querySelector('#code-input').value.trim().toUpperCase();
    pick.name = form.querySelector('#name-input').value.trim();
    socket.emit('player:join', { code, name: pick.name, color: pick.color, hat: pick.hat }, (res) => {
      if (!res.ok) return joinForm(res.error);
      me = res.playerId;
      setToken(res.code, res.token);
      history.replaceState(null, '', `/play?room=${res.code}`);
      render();
    });
  });
}

function render() {
  if (!state || !me) return;
  const p = state.players[me];
  if (!p) { joinForm('Ya no estás en esta sala.'); return; }
  const turnKey = `${state.phase}:${state.currentPlayerId}:${state.round}`;
  if (turnKey !== lastTurnKey) {
    lastTurnKey = turnKey;
    if (state.phase === 'DICE_ROLL' && state.currentPlayerId === me) navigator.vibrate?.([80, 60, 80]);
  }
  const lobbyEdit = state.phase === 'LOBBY'
    ? `<div class="panel" style="padding:12px"><div class="swatches">${COLORS.map((c) => `<button type="button" class="swatch" style="background:${c}" data-action='${JSON.stringify({ type: 'UPDATE_PLAYER', color: c })}' aria-label="Color ${c}" aria-pressed="${c === p.color}"></button>`).join('')}</div>
       <div class="hats" style="margin-top:10px">${HATS.map((h) => `<button type="button" class="hat" data-action='${JSON.stringify({ type: 'UPDATE_PLAYER', hat: h })}' aria-pressed="${h === p.hat}">${h}</button>`).join('')}</div></div>`
    : '';
  const html = `${walletHtml(state, me)}<section class="ph-main" aria-live="polite">${controlsHtml(state, you || { playerId: me })}</section>${lobbyEdit}<p class="err" role="alert"></p><p class="ph-foot">Sala ${esc(code)} · ${state.phase === 'LOBBY' ? 'en espera' : `ronda ${state.round}/${state.config.totalRounds}`}</p>`;
  if (app.dataset.v !== html) {
    app.dataset.v = html;
    app.innerHTML = html;
  }
}

socket.on('connect', () => {
  const t = code && getToken(code);
  if (t) {
    socket.emit('player:resume', { code, token: t }, (res) => {
      if (res.ok) { me = res.playerId; render(); } else joinForm();
    });
  } else if (!me) joinForm();
});
socket.on('state', (msg) => {
  state = msg.state;
  you = msg.you;
  render();
});
socket.on('disconnect', () => {
  const e = app.querySelector('.ph-foot');
  if (e) e.textContent = 'Reconectando…';
});
