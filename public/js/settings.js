// Panel de configuración del host. Envía UPDATE_CONFIG; el servidor valida.

import { esc } from './assets.js';

const num = (id, label, v, min, max, hint = '') => `<label class="field" for="cfg-${id}"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span>
  <input id="cfg-${id}" name="${id}" type="number" inputmode="numeric" min="${min}" max="${max}" value="${v}"></label>`;
const sel = (id, label, v, opts) => `<label class="field" for="cfg-${id}"><span>${label}</span><select id="cfg-${id}" name="${id}">${opts.map(([val, txt]) => `<option value="${val}" ${String(val) === String(v) ? 'selected' : ''}>${txt}</option>`).join('')}</select></label>`;
const chk = (id, label, v) => `<label class="check" for="cfg-${id}"><input id="cfg-${id}" name="${id}" type="checkbox" ${v ? 'checked' : ''}><span>${label}</span></label>`;

export function settingsHtml(c, meta) {
  const games = meta?.minigames || [];
  return `<form class="settings" id="settings-form" autocomplete="off">
    <fieldset><legend>Partida</legend>
      ${num('totalRounds', 'Rondas', c.totalRounds, 1, 50)}
      ${sel('dice', 'Dado', `${c.diceMin}-${c.diceMax}`, [['1-6', '1 a 6'], ['1-8', '1 a 8'], ['1-10', '1 a 10']])}
      ${sel('boardLength', 'Largo del tablero', c.boardLength, [['corto', 'Corto'], ['normal', 'Normal'], ['largo', 'Largo']])}
      ${chk('boardBranches', 'Atajos y bifurcaciones', c.boardBranches)}
      ${num('turnTimeoutSec', 'Tiempo por decisión', c.turnTimeoutSec, 0, 300, 'segundos · 0 = sin límite')}
    </fieldset>
    <fieldset><legend>Economía</legend>
      ${num('startingPemolares', 'Pemolares iniciales', c.startingPemolares, 0, 200)}
      ${num('perritaPrice', 'Precio de la Perrita', c.perritaPrice, 1, 200, 'en Pemolares')}
      ${num('pemolarPlusMin', 'Casilla azul mín.', c.pemolarPlusMin, 0, 50)}
      ${num('pemolarPlusMax', 'Casilla azul máx.', c.pemolarPlusMax, 0, 60)}
      ${num('pemolarMinusMin', 'Casilla roja mín.', c.pemolarMinusMin, 0, 50)}
      ${num('pemolarMinusMax', 'Casilla roja máx.', c.pemolarMinusMax, 0, 60)}
      ${num('passStartBonus', 'Bono por pasar la salida', c.passStartBonus, 0, 50)}
      ${chk('allowNegativePemolares', 'Permitir saldos negativos', c.allowNegativePemolares)}
    </fieldset>
    <fieldset><legend>Minijuegos</legend>
      ${num('rw-first', 'Premio 1er lugar', c.minigameRewards.first, 0, 100)}
      ${num('rw-second', 'Premio 2º lugar', c.minigameRewards.second, 0, 100)}
      ${num('rw-participation', 'Premio por participar', c.minigameRewards.participation, 0, 100)}
      ${sel('minigameEveryNRounds', 'Minijuego de ronda', c.minigameEveryNRounds, [[0, 'Nunca'], [1, 'Cada ronda'], [2, 'Cada 2 rondas'], [3, 'Cada 3 rondas']])}
      ${sel('tileMinigameParticipants', 'Casilla de minijuego', c.tileMinigameParticipants, [['duel', 'Duelo contra un rival'], ['all', 'Todos juegan']])}
      <div class="games">${games.map((g) => `<label class="check ${g.implemented ? '' : 'soon'}" for="cfg-mg-${g.id}"><input id="cfg-mg-${g.id}" name="mg-${g.id}" type="checkbox" ${g.implemented ? '' : 'disabled'} ${c.enabledMinigames.includes(g.id) ? 'checked' : ''}><span>${esc(g.name)}${g.implemented ? '' : ' <small>próximamente</small>'}</span></label>`).join('')}</div>
    </fieldset>
    <fieldset><legend>Caos y final</legend>
      ${sel('chaosFrequency', 'Eventos de caos', c.chaosFrequency, [[0, 'Apagados'], [0.5, 'Suaves'], [1, 'Normales'], [2, 'Caóticos']])}
      ${chk('eb-minigameKing', 'Bono: Rey del Minijuego (+1 Perrita)', c.endBonuses.minigameKing)}
      ${chk('eb-richest', 'Bono: Bolsillo de Oro (+1 Perrita)', c.endBonuses.richest)}
      ${chk('eb-chaosMagnet', 'Bono: Imán del Caos (+1 Perrita)', c.endBonuses.chaosMagnet)}
      ${chk('pemolaresTiebreak', 'Desempatar con Pemolares', c.pemolaresTiebreak)}
    </fieldset>
  </form>`;
}

export function readSettings(form, meta) {
  const f = new FormData(form);
  const n = (k) => Number(f.get(k));
  const [dmin, dmax] = String(f.get('dice')).split('-').map(Number);
  return {
    totalRounds: n('totalRounds'),
    diceMin: dmin,
    diceMax: dmax,
    boardLength: f.get('boardLength'),
    boardBranches: f.get('boardBranches') === 'on',
    turnTimeoutSec: n('turnTimeoutSec'),
    startingPemolares: n('startingPemolares'),
    perritaPrice: n('perritaPrice'),
    pemolarPlusMin: n('pemolarPlusMin'),
    pemolarPlusMax: n('pemolarPlusMax'),
    pemolarMinusMin: n('pemolarMinusMin'),
    pemolarMinusMax: n('pemolarMinusMax'),
    passStartBonus: n('passStartBonus'),
    allowNegativePemolares: f.get('allowNegativePemolares') === 'on',
    minigameRewards: { first: n('rw-first'), second: n('rw-second'), participation: n('rw-participation') },
    minigameEveryNRounds: n('minigameEveryNRounds'),
    tileMinigameParticipants: f.get('tileMinigameParticipants'),
    enabledMinigames: (meta?.minigames || []).filter((g) => f.get(`mg-${g.id}`) === 'on').map((g) => g.id),
    chaosFrequency: n('chaosFrequency'),
    endBonuses: {
      minigameKing: f.get('eb-minigameKing') === 'on',
      richest: f.get('eb-richest') === 'on',
      chaosMagnet: f.get('eb-chaosMagnet') === 'on',
    },
    pemolaresTiebreak: f.get('pemolaresTiebreak') === 'on',
  };
}

export function bindSettings(root, meta, onChange) {
  let t = null;
  root.addEventListener('change', (e) => {
    const form = e.target.closest('form.settings');
    if (!form) return;
    clearTimeout(t);
    t = setTimeout(() => onChange(readSettings(form, meta)), 150);
  });
}
