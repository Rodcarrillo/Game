// Vistas de minijuegos para la TV (pública) y para el control (privada).
// Cada vista devuelve HTML; los botones llevan data-action con la acción a enviar.

import { avatarHtml, esc } from './assets.js';

const mgAction = (payload) => esc(JSON.stringify({ type: 'MG_INPUT', payload }));

function avatarRow(state, ids, mark) {
  return `<div class="mg-row">${ids.map((id) => {
    const p = state.players[id];
    const m = mark(id);
    return `<div class="mg-chip ${m.cls || ''}">${avatarHtml(p, 58)}<span>${esc(p.name)}</span>${m.badge ? `<em>${m.badge}</em>` : ''}</div>`;
  }).join('')}</div>`;
}

export const MG_VIEWS = {
  'cap-or-fact': {
    tv(state, v, ctx) {
      const mg = state.minigame;
      if (v.step === 'ask') {
        return `<div class="mg-head">Pregunta ${v.qIndex + 1} de ${v.total}</div>
          <div class="cof-card"><p>${esc(v.statement)}</p></div>
          ${ctx.countdown()}
          <div class="cof-legend"><span class="cap">CAP = mentira</span><span class="fact">FACT = dato real</span></div>
          ${avatarRow(state, mg.participants, (id) => (v.answered.includes(id) ? { cls: 'done', badge: '✓' } : { cls: 'wait' }))}`;
      }
      const r = v.reveal;
      return `<div class="mg-head">Pregunta ${v.qIndex + 1} de ${v.total}</div>
        <div class="cof-card revealed"><p>${esc(v.statement)}</p><div class="stamp ${r.correct}">${r.correct === 'fact' ? 'FACT' : 'CAP'}</div></div>
        ${avatarRow(state, mg.participants, (id) => {
          const x = r.result[id];
          if (!x.a) return { cls: 'miss', badge: 'sin respuesta', mood: 'sad' };
          return x.ok ? { cls: 'ok', badge: `+${x.pts}`, mood: 'wow' } : { cls: 'bad', badge: x.a.toUpperCase(), mood: 'sad' };
        })}`;
    },
    phone(state, v, priv) {
      if (v.step === 'ask') {
        const mine = priv?.myAnswer;
        return `<div class="ph-mg">
          <div class="ph-q">${esc(v.statement)}</div>
          <div class="ph-two">
            <button class="btn big cap" data-action="${mgAction({ answer: 'cap' })}" ${mine ? 'disabled' : ''}>CAP<small>mentira</small></button>
            <button class="btn big fact" data-action="${mgAction({ answer: 'fact' })}" ${mine ? 'disabled' : ''}>FACT<small>dato real</small></button>
          </div>
          ${mine ? `<p class="ph-note">Respondiste <b>${mine.toUpperCase()}</b>. Espera a los demás…</p>` : '<p class="ph-note">¡Rápido! Acertar primero da puntos extra.</p>'}
        </div>`;
      }
      const me = v.reveal.result[priv?.playerId];
      return `<div class="ph-mg"><div class="ph-big ${me?.ok ? 'good' : 'bad'}">${me?.ok ? `¡Correcto! +${me.pts}` : 'Fallaste'}</div><p class="ph-note">Era <b>${v.reveal.correct.toUpperCase()}</b></p></div>`;
    },
  },

  'skill-issue': {
    tv(state, v, ctx) {
      const mg = state.minigame;
      if (v.step === 'ready') {
        return `<div class="si-target"><small>Objetivo</small><b>${v.target.toFixed(1)}<i>s</i></b></div>
          <p class="mg-sub">Prepárense… el reloj se esconde al segundo y medio.</p>
          ${avatarRow(state, mg.participants, () => ({ cls: 'wait' }))}`;
      }
      if (v.step === 'run') {
        return `<div class="si-target small"><small>Objetivo</small><b>${v.target.toFixed(1)}<i>s</i></b></div>
          <div class="live-clock" data-t0="${ctx.t0('run')}" data-visible="${v.visibleMs}">0.00</div>
          ${avatarRow(state, mg.participants, (id) => (v.stopped.includes(id) ? { cls: 'done', badge: '✋' } : { cls: 'wait' }))}`;
      }
      const target = v.target * 1000;
      const rows = mg.participants
        .map((id) => ({ id, ...v.results[id] }))
        .sort((a, b) => (a.diff ?? 1e9) - (b.diff ?? 1e9));
      return `<div class="si-target small"><small>Objetivo</small><b>${v.target.toFixed(1)}<i>s</i></b></div>
        <div class="si-results">${rows.map((r, i) => {
          const p = state.players[r.id];
          const pct = r.t == null ? 0 : Math.min(100, (r.t / (target + 3000)) * 100);
          const tpct = (target / (target + 3000)) * 100;
          return `<div class="si-row ${i === 0 ? 'win' : ''}">
            <div class="si-who">${avatarHtml(p, 40)}<span>${esc(p.name)}</span></div>
            <div class="si-bar"><i style="width:${pct}%;background:${p.color}"></i><u style="left:${tpct}%"></u></div>
            <div class="si-val">${r.t == null ? '—' : `${(r.t / 1000).toFixed(2)} s`}<small>${r.t == null ? 'no se detuvo' : `${r.t >= target ? '+' : '−'}${(Math.abs(r.t - target) / 1000).toFixed(2)}`}</small></div>
          </div>`;
        }).join('')}</div>`;
    },
    phone(state, v, priv) {
      if (v.step === 'ready') return `<div class="ph-mg"><div class="ph-big">${v.target.toFixed(1)} s</div><p class="ph-note">Detén el reloj en ese tiempo. ¡Prepárate!</p></div>`;
      if (v.step === 'run') {
        return `<div class="ph-mg"><p class="ph-note">Objetivo <b>${v.target.toFixed(1)} s</b></p>
          <button class="btn huge stop" data-action="${mgAction({ action: 'stop' })}" ${priv?.stopped ? 'disabled' : ''}>${priv?.stopped ? 'DETENIDO' : '¡ALTO!'}</button></div>`;
      }
      const r = v.results?.[priv?.playerId];
      return `<div class="ph-mg"><div class="ph-big">${r?.t == null ? 'No te detuviste' : `${(r.t / 1000).toFixed(2)} s`}</div><p class="ph-note">Objetivo ${v.target.toFixed(1)} s</p></div>`;
    },
  },
};

/** Actualiza relojes en vivo (SKILL ISSUE) en cualquier contenedor. */
export function tickLiveClocks(root) {
  const now = performance.now();
  for (const c of root.querySelectorAll('.live-clock')) {
    const t0 = Number(c.dataset.t0);
    const vis = Number(c.dataset.visible);
    const e = now - t0;
    if (e > vis) {
      if (!c.classList.contains('hidden-time')) {
        c.classList.add('hidden-time');
        c.textContent = '¿?.¿?';
      }
    } else c.textContent = (e / 1000).toFixed(2);
  }
}
