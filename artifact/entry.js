// Modo local (una sola pantalla): mismo motor autoritativo, corriendo en el
// navegador. Los jugadores humanos se turnan en el mismo dispositivo y los
// minijuegos usan botones en pantalla o teclas.

import {
  createGame, createRunner, publicState, privateView, listMinigames, DEFAULT_CONFIG, PLAYER_COLORS, CHARACTERS, characterName,
} from '../src/engine/index.js';
import { GameScreen } from '../public/js/screen.js';
import { controlsHtml, walletHtml } from '../public/js/controls.js';
import { settingsHtml, readSettings } from '../public/js/settings.js';
import { howToHtml, bgFxHtml } from '../public/js/lobby.js';
import { MG_VIEWS } from '../public/js/minigame-views.js';
import { avatarHtml, esc } from '../public/js/assets.js';

const META = { minigames: listMinigames(), defaults: DEFAULT_CONFIG };
const SAVE_KEY = 'ma-local-v2';
const KEYS = [['q', 'w'], ['o', 'p'], ['z', 'x'], ['n', 'm']];

const store = {
  get() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; } },
  set(v) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch { /* nada */ } },
};

function boot(hotData = {}) {
  const app = document.getElementById('app');
  app.innerHTML = '<div id="screen"></div><div id="dock" class="dock" hidden></div><div id="lobby" class="lobby"></div><div id="modal" class="modal" hidden></div>';
  const lobbyEl = app.querySelector('#lobby');
  const dock = app.querySelector('#dock');
  const modal = app.querySelector('#modal');

  let runner = null;
  let config = { ...DEFAULT_CONFIG, ...(hotData.config || {}) };
  let roster = hotData.roster || [
    { name: '', color: PLAYER_COLORS[0], char: 'c1', isBot: false },
    { name: '', color: PLAYER_COLORS[1], char: 'c2', isBot: false },
    { name: '', color: PLAYER_COLORS[2], char: 'c3', isBot: true },
    { name: '', color: PLAYER_COLORS[3], char: 'c4', isBot: true },
  ];

  roster = roster.map((p, i) => ({ ...p, char: CHARACTERS.includes(p.char) ? p.char : CHARACTERS[i % CHARACTERS.length] }));
  try {
    const savedNames = JSON.parse(localStorage.getItem('ma-char-names') || 'null');
    if (Array.isArray(savedNames) && !config.characterNames?.some(Boolean)) config.characterNames = savedNames;
  } catch { /* nada */ }

  const screen = new GameScreen(app.querySelector('#screen'), {
    isHost: true,
    local: true,
    extraTop: '<button class="btn small ghost" data-exit>Salir</button>',
    onHostAction: (a) => {
      if (!runner) return;
      if (a.type === 'RESET') return backToLobby();
      runner.dispatch(a);
    },
  });

  // ---------- lobby ----------
  function renderLobby() {
    lobbyEl.hidden = false;
    dock.hidden = true;
    const saved = store.get();
    const canResume = saved?.state && saved.state.phase !== 'LOBBY' && saved.state.phase !== 'WINNER_REVEAL';
    lobbyEl.innerHTML = `${bgFxHtml()}<div class="lobby-inner">
      <h1 class="title-big">MICHELSON'S <span>ARCADE</span></h1>
      <p class="subtitle">El juego de mesa para la peda · Isla Pemol · todos en esta pantalla · +18</p>
      ${canResume ? `<div class="panel resume-panel"><div><b>Hay una partida guardada</b><span>Ronda ${saved.state.round} de ${saved.state.config.totalRounds} · ${saved.state.order.map((id) => esc(saved.state.players[id].name)).join(', ')}</span></div><button class="btn mint" data-l="resume">Continuar</button></div>` : ''}
      <section class="panel players-panel">
        <h2>Jugadores <small class="muted">${roster.length}/8 · humanos se turnan, bots juegan solos</small></h2>
        <div class="local-roster">${roster.map((p, i) => `
          <div class="lr" style="--pc:${p.color}">
            <div class="lr-av">${avatarHtml(p, 96)}</div>
            <label class="sr" for="lr-name-${i}">Nombre del jugador ${i + 1}</label>
            <input id="lr-name-${i}" class="lr-name" data-i="${i}" maxlength="16" value="${esc(p.name)}" placeholder="${esc(characterName(config, p.char))}">
            <div class="lr-colors">${PLAYER_COLORS.map((c) => `<button type="button" class="swatch sm" style="background:${c}" data-color="${c}" data-i="${i}" aria-label="Color" aria-pressed="${c === p.color}"></button>`).join('')}</div>
            <div class="lr-row">
              <label class="lr-hat" for="lr-char-${i}"><span class="sr">Personaje</span><select id="lr-char-${i}" data-char-i="${i}">${CHARACTERS.map((c) => `<option value="${c}" ${c === p.char ? 'selected' : ''}>${esc(characterName(config, c))}</option>`).join('')}</select></label>
              <button type="button" class="btn small ${p.isBot ? 'ghost' : 'blue'}" data-bot="${i}">${p.isBot ? 'Bot' : 'Humano'}</button>
              <button type="button" class="btn small ghost" data-del="${i}" aria-label="Quitar" ${roster.length <= 2 ? 'disabled' : ''}>✕</button>
            </div>
            ${!p.isBot ? `<small class="lr-keys">Teclas de minijuego: ${humanKeys(i)}</small>` : '<small class="lr-keys">Juega solo</small>'}
          </div>`).join('')}
          ${roster.length < 8 ? '<button type="button" class="lr add" data-l="add">+ Agregar jugador</button>' : ''}
        </div>
        <div class="lobby-actions" style="margin-top:16px">
          <button class="btn blue" data-l="settings">Configuración</button>
          <button class="btn alt start" data-l="start">¡A jugar!</button>
        </div>
        <p class="muted" style="text-align:center">${config.totalRounds} rondas · dado ${config.diceMin}–${config.diceMax} · Perrita a ${config.perritaPrice} Pemolares</p>
      </section>
      ${howToHtml(config.perritaPrice)}
      <p class="muted" style="text-align:center">Para jugar con un celular por persona, usa la versión con servidor del repositorio.</p>
    </div>`;
  }

  function humanKeys(i) {
    const humans = roster.map((p, k) => ({ p, k })).filter((x) => !x.p.isBot);
    const idx = humans.findIndex((x) => x.k === i);
    const k = KEYS[idx];
    return k ? `${k[0].toUpperCase()} / ${k[1].toUpperCase()}` : 'botones en pantalla';
  }

  lobbyEl.addEventListener('input', (e) => {
    const n = e.target.closest('.lr-name');
    if (n) roster[Number(n.dataset.i)].name = n.value;
  });
  lobbyEl.addEventListener('change', (e) => {
    const h = e.target.closest('[data-char-i]');
    if (h) {
      const i = Number(h.dataset.charI);
      const other = roster.findIndex((p, k) => k !== i && p.char === h.value);
      if (other >= 0) roster[other].char = roster[i].char; // intercambia
      roster[i].char = h.value;
      renderLobby();
    }
  });
  lobbyEl.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.color) {
      const i = Number(t.dataset.i);
      const other = roster.findIndex((p, k) => k !== i && p.color === t.dataset.color);
      if (other >= 0) roster[other].color = roster[i].color; // intercambia
      roster[i].color = t.dataset.color;
      return renderLobby();
    }
    if (t.dataset.bot) { const p = roster[Number(t.dataset.bot)]; p.isBot = !p.isBot; return renderLobby(); }
    if (t.dataset.del) { roster.splice(Number(t.dataset.del), 1); return renderLobby(); }
    const l = t.dataset.l;
    if (l === 'add') {
      const used = new Set(roster.map((p) => p.color));
      roster.push({
        name: '',
        color: PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[0],
        char: CHARACTERS.find((c) => !roster.some((p) => p.char === c)) || 'c1',
        isBot: true,
      });
      return renderLobby();
    }
    if (l === 'settings') return openSettings();
    if (l === 'start') return start();
    if (l === 'resume') return resume(store.get().state);
    return undefined;
  });

  function openSettings() {
    modal.hidden = false;
    modal.innerHTML = `<div class="panel settings-panel" role="dialog" aria-label="Configuración"><h2>Configuración <button class="btn small" data-close>Listo</button></h2>${settingsHtml(config, META)}</div>`;
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) { modal.hidden = true; modal.innerHTML = ''; renderLobby(); }
  });
  modal.addEventListener('change', () => {
    const form = modal.querySelector('form.settings');
    if (form) {
      config = { ...config, ...readSettings(form, META) };
      try { localStorage.setItem('ma-char-names', JSON.stringify(config.characterNames)); } catch { /* nada */ }
    }
  });

  // ---------- partida ----------
  function attach(state) {
    runner?.stop();
    runner = createRunner({
      state,
      onChange: (s) => {
        store.set({ state: s });
        draw(s);
      },
    });
    lobbyEl.hidden = true;
    runner.resume();
  }

  function start() {
    let s = createGame({ config, seed: `${Date.now()}-${Math.random()}` });
    const tmp = createRunner({ state: s });
    roster.forEach((p, i) => tmp.dispatch({ type: 'ADD_PLAYER', player: { id: `p${i + 1}`, name: p.name.trim(), color: p.color, char: p.char, isBot: p.isBot } }));
    tmp.dispatch({ type: 'START' });
    s = tmp.getState();
    tmp.stop();
    attach(s);
  }

  function resume(state) {
    // retoma con los temporizadores reiniciados desde ahora
    if (state.timer) state.timer.at = Date.now() + 1500;
    attach(state);
  }

  function backToLobby() {
    runner?.stop();
    runner = null;
    store.clear();
    renderLobby();
  }

  function humanIndex(state, pid) {
    return state.order.filter((id) => !state.players[id].isBot).indexOf(pid);
  }

  function dockHtml(state) {
    const pub = publicState(state);
    if (state.phase === 'WINNER_REVEAL') return '';
    if (state.phase === 'MINIGAME_PLAYING' || state.phase === 'MINIGAME_INTRO') {
      const mg = state.minigame;
      const humans = mg.participants.filter((id) => !state.players[id].isBot);
      if (!humans.length || state.phase === 'MINIGAME_INTRO') return humans.length ? `<div class="pads-note">Prepárense: ${humans.map((id) => `<b>${esc(state.players[id].name)}</b> (${keyLabel(state, id, mg.gameId)})`).join(' · ')}</div>` : '';
      return humans.map((id) => {
        const you = privateView(state, id);
        const view = MG_VIEWS[mg.gameId];
        const body = view && pub.minigame.view ? view.phone(pub, pub.minigame.view, { ...(you.minigame || {}), playerId: id }) : '';
        return `<div class="pad" data-pid="${id}">${walletHtml(pub, id)}<div class="pad-body">${body}</div><small class="pad-keys">${keyLabel(state, id, mg.gameId)}</small></div>`;
      }).join('');
    }
    if (state.phase === 'SHOT_GIFT' && state.pending && !state.players[state.pending.playerId].isBot) {
      const g = state.pending.playerId;
      return `<div class="pad solo" data-pid="${g}">${walletHtml(pub, g)}<div class="pad-body">${controlsHtml(pub, privateView(state, g), { local: true })}</div></div>`;
    }
    const cur = state.order[state.turnIndex];
    const p = state.players[cur];
    if (!p || p.isBot || ['LOBBY', 'BOARD_INTRO', 'MINIGAME_RESULTS', 'SHOT_GIFT', 'BOARD_END', 'FINAL_BONUSES', 'FINAL_LEADERBOARD'].includes(state.phase)) return '';
    return `<div class="pad solo" data-pid="${cur}">${walletHtml(pub, cur)}<div class="pad-body">${controlsHtml(pub, privateView(state, cur), { local: true })}</div></div>`;
  }

  function keyLabel(state, pid, gameId) {
    const k = KEYS[humanIndex(state, pid)];
    if (!k) return 'Usa los botones';
    if (gameId === 'skill-issue') return `Tecla ${k[0].toUpperCase()} = ¡ALTO!`;
    return `${k[0].toUpperCase()} = CAP · ${k[1].toUpperCase()} = FACT`;
  }

  function draw(state) {
    const pub = publicState(state);
    screen.render(pub);
    const html = dockHtml(state);
    dock.hidden = !html;
    dock.classList.toggle('pads', state.phase.startsWith('MINIGAME'));
    app.classList.toggle('has-dock', !!html);
    app.classList.toggle('has-pads', !!html && state.phase.startsWith('MINIGAME'));
    if (dock.dataset.v !== html) {
      dock.dataset.v = html;
      dock.innerHTML = html;
    }
  }

  let exitArmed = null;
  app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-exit]');
    if (!b) return;
    if (exitArmed) { clearTimeout(exitArmed); exitArmed = null; b.textContent = 'Salir'; backToLobby(); return; }
    b.textContent = '¿Salir? Toca otra vez';
    exitArmed = setTimeout(() => { exitArmed = null; b.textContent = 'Salir'; }, 3000);
  });

  dock.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled || !runner) return;
    const pid = b.closest('[data-pid]')?.dataset.pid;
    if (!pid) return;
    try { runner.dispatch({ ...JSON.parse(b.dataset.action), playerId: pid }); } catch { /* nada */ }
  });

  window.addEventListener('keydown', (e) => {
    if (!runner || e.target.closest('input, select, textarea')) return;
    const s = runner.getState();
    const key = e.key.toLowerCase();
    if (s.phase === 'MINIGAME_PLAYING') {
      const humans = s.minigame.participants.filter((id) => !s.players[id].isBot);
      for (const id of humans) {
        const k = KEYS[humanIndex(s, id)];
        if (!k) continue;
        if (s.minigame.gameId === 'skill-issue' && key === k[0]) runner.dispatch({ type: 'MG_INPUT', playerId: id, payload: { action: 'stop' } });
        if (s.minigame.gameId === 'cap-or-fact' && (key === k[0] || key === k[1])) runner.dispatch({ type: 'MG_INPUT', playerId: id, payload: { answer: key === k[0] ? 'cap' : 'fact' } });
      }
      return;
    }
    if (key === ' ' || key === 'enter') {
      const b = dock.querySelector('.pad.solo [data-action]:not([disabled])');
      if (b) { e.preventDefault(); b.click(); }
    }
  });

  window.claude?.hot?.snapshot?.(() => ({ roster, config, state: runner?.getState() || null }));

  if (hotData.state && hotData.state.phase !== 'LOBBY') resume(hotData.state);
  else renderLobby();
}

const hot = typeof window !== 'undefined' ? window.claude?.hot : null;
if (hot?.ready) hot.ready(boot);
else boot(hot?.data ?? {});
