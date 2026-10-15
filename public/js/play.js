// Control del jugador en el celular.
import { Net } from './net.js';
import { controlsHtml, walletHtml, bindActions } from './controls.js';
import { esc, CHAR_SRC } from './assets.js';

const COLORS = ['#ff6b4a', '#3d8bff', '#ffc531', '#2ecc8f', '#b06bff', '#ff5fae', '#22c7d6', '#8a5a3c'];
const CHARS = Array.from({ length: 10 }, (_, i) => `c${i + 1}`);

const app = document.getElementById('app');
const socket = new Net();
const params = new URLSearchParams(location.search);
let code = (params.get('room') || '').toUpperCase();
let me = null;
let state = null;
let you = null;
let pick = { color: COLORS[Math.floor(Math.random() * COLORS.length)], char: null };
let peek = { names: [], taken: [] };
let lastTurnKey = '';
let lastShotSeen = null;

const tokenKey = (c) => `ma-player-${c}`;
const getToken = (c) => { try { return localStorage.getItem(tokenKey(c)); } catch { return null; } };
const setToken = (c, t) => { try { localStorage.setItem(tokenKey(c), t); } catch { /* nada */ } };
const charName = (names, id) => (names?.[CHARS.indexOf(id)] || '').trim() || `Personaje ${CHARS.indexOf(id) + 1}`;

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

function charGrid(names, taken, selected, actionFor) {
  return `<div class="chars-grid">${CHARS.map((c) => {
    const busy = taken.includes(c) && c !== selected;
    const attr = actionFor ? `data-action='${JSON.stringify(actionFor(c))}'` : `data-char="${c}"`;
    return `<button type="button" class="char-opt" ${attr} aria-pressed="${c === selected}" ${busy ? 'disabled' : ''}><img src="${CHAR_SRC[c]}" alt=""><span>${esc(charName(names, c))}</span></button>`;
  }).join('')}</div>`;
}

function doPeek() {
  if (code.length !== 4) return;
  socket.emit('room:peek', { code }, (res) => {
    if (!res?.ok || me) return;
    peek = { names: res.names || [], taken: res.taken || [] };
    if (!pick.char || peek.taken.includes(pick.char)) pick.char = CHARS.find((c) => !peek.taken.includes(c)) || null;
    const box = app.querySelector('#char-box');
    if (box) box.innerHTML = charGrid(peek.names, peek.taken, pick.char);
    const name = app.querySelector('#name-input');
    if (name && !name.dataset.touched && pick.char) name.value = charName(peek.names, pick.char);
  });
}

function joinForm(error = '') {
  me = null;
  app.innerHTML = `
    <h1 class="title-big" style="font-size:52px">MICHELSON'S <span>ARCADE</span></h1>
    <form class="panel join-form" id="join" style="padding:18px">
      <label for="code-input">Código de sala<input id="code-input" maxlength="4" required value="${esc(code)}" autocapitalize="characters" autocomplete="off"></label>
      <span class="ph-title" style="font-size:22px;text-align:left">Elige tu personaje</span>
      <div id="char-box">${code.length === 4 ? '<p class="ph-note">Cargando personajes…</p>' : '<p class="ph-note">Escribe el código para ver los personajes.</p>'}</div>
      <label for="name-input">Tu nombre<input id="name-input" maxlength="16" required autocomplete="nickname"></label>
      <div class="swatches">${COLORS.map((c) => `<button type="button" class="swatch" style="background:${c}" data-color="${c}" aria-label="Color ${c}" aria-pressed="${c === pick.color}"></button>`).join('')}</div>
      <p class="err" role="alert">${esc(error)}</p>
      <button class="btn alt" type="submit" style="font-size:28px">Entrar</button>
    </form>
    <p class="ph-foot" style="color:#fff">Juego para mayores de 18. El tablero se ve en la tele; este celular es tu control.</p>`;
  const form = app.querySelector('#join');
  form.querySelector('#code-input').addEventListener('input', (e) => {
    code = e.target.value.trim().toUpperCase();
    doPeek();
  });
  form.querySelector('#name-input').addEventListener('input', (e) => { e.target.dataset.touched = '1'; });
  form.addEventListener('click', (e) => {
    const c = e.target.closest('[data-color]');
    const ch = e.target.closest('[data-char]');
    if (c) {
      pick.color = c.dataset.color;
      form.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.color === pick.color));
    }
    if (ch && !ch.disabled) {
      pick.char = ch.dataset.char;
      form.querySelectorAll('[data-char]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.char === pick.char));
      const name = form.querySelector('#name-input');
      if (!name.dataset.touched) name.value = charName(peek.names, pick.char);
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    code = form.querySelector('#code-input').value.trim().toUpperCase();
    const name = form.querySelector('#name-input').value.trim();
    socket.emit('player:join', { code, name, color: pick.color, char: pick.char }, (res) => {
      if (!res.ok) return joinForm(res.error);
      me = res.playerId;
      setToken(res.code, res.token);
      history.replaceState(null, '', `/play?room=${res.code}`);
      render();
    });
  });
  doPeek();
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
  // vibra cuando te toca un shot
  if (lastShotSeen == null) lastShotSeen = state.eventSeq;
  for (const ev of state.events) {
    if (ev.id <= lastShotSeen) continue;
    lastShotSeen = ev.id;
    if (ev.type === 'shot' && ev.playerId === me) navigator.vibrate?.([200, 80, 200]);
  }
  const taken = state.order.filter((id) => id !== me).map((id) => state.players[id].char);
  const lobbyEdit = state.phase === 'LOBBY'
    ? `<div class="panel" style="padding:12px"><p class="ph-note" style="margin-bottom:8px">Cambia tu personaje o color</p>
       ${charGrid(state.config.characterNames, taken, p.char, (c) => ({ type: 'UPDATE_PLAYER', char: c }))}
       <div class="swatches" style="margin-top:10px">${COLORS.map((c) => `<button type="button" class="swatch" style="background:${c}" data-action='${JSON.stringify({ type: 'UPDATE_PLAYER', color: c })}' aria-label="Color ${c}" aria-pressed="${c === p.color}"></button>`).join('')}</div></div>`
    : '';
  const html = `${walletHtml(state, me)}<section class="ph-main" aria-live="polite">${controlsHtml(state, you || { playerId: me })}</section>${lobbyEdit}<p class="err" role="alert"></p><p class="ph-foot" style="color:#fff">Sala ${esc(code)} · ${state.phase === 'LOBBY' ? 'en espera' : `ronda ${state.round}/${state.config.totalRounds}`}</p>`;
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
