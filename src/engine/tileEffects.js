// TileEventResolver: registro reutilizable de efectos de casilla.
// Para agregar un tipo nuevo: registerTileType('mi_tipo', { label, resolve }).
// `resolve(s, player, tile, api)` muta el estado mediante `api` y devuelve un
// resumen { title, text, tone } que la TV muestra. Puede devolver
// `minigame: { participants }` para lanzar un minijuego al terminar.

import { changePemolares, changePerritas, transferPemolares, giveShot, log } from './wallet.js';

const registry = new Map();

export function registerTileType(type, def) {
  registry.set(type, { type, ...def });
}

export function getTileType(type) {
  return registry.get(type);
}

export function tileTypes() {
  return [...registry.values()].map(({ type, label, description }) => ({ type, label, description }));
}

export function resolveTile(s, playerId, tile, api) {
  const def = registry.get(tile.type);
  const player = s.players[playerId];
  if (!def) return { title: 'Casilla', text: 'No pasa nada.', tone: 'neutral' };
  const res = def.resolve(s, player, tile, api) || { title: def.label, text: '', tone: 'neutral' };
  log(s, `${player.name} · ${res.title}${res.text ? ' — ' + res.text : ''}`);
  return res;
}

const others = (s, playerId) => s.order.filter((id) => id !== playerId);

registerTileType('start', {
  label: 'Salida',
  description: 'Pasar por aquí da Pemolares.',
  resolve: () => ({ title: 'Salida', text: 'De vuelta al inicio.', tone: 'neutral' }),
});

registerTileType('pemolar_plus', {
  label: 'Pemolares +',
  description: 'Gana Pemolares.',
  resolve(s, p, _t, { rng }) {
    const n = rng.int(s.config.pemolarPlusMin, s.config.pemolarPlusMax);
    const got = changePemolares(s, p.id, n, 'Casilla azul');
    return { title: `+${got} Pemolares`, text: 'Casilla de Pemolares', tone: 'good' };
  },
});

registerTileType('pemolar_minus', {
  label: 'Pemolares −',
  description: 'Pierde Pemolares (un escudo lo bloquea).',
  resolve(s, p, _t, { rng }) {
    p.stats.minusHits += 1;
    const n = rng.int(s.config.pemolarMinusMin, s.config.pemolarMinusMax);
    const hadShield = p.shield;
    const lost = changePemolares(s, p.id, -n, 'Casilla roja', { blockable: true });
    const shot = giveShot(s, p.id, 1, 'Casilla roja', rng);
    const extra = shot ? ` y ¡${s.config.shotWord}!` : '';
    if (hadShield && !lost) return { title: '¡Escudo!', text: `Tu escudo bloqueó la pérdida${extra}`, tone: shot ? 'bad' : 'good' };
    return { title: `${lost} Pemolares${shot ? ` + ${s.config.shotWord}` : ''}`, text: lost ? `Casilla roja${extra}` : `No tenías nada que perder${extra}`, tone: 'bad' };
  },
});

registerTileType('perrita', {
  label: 'Perrita',
  description: 'Probabilidad de ganar una Perrita; si no, Pemolares.',
  resolve(s, p, _t, { rng }) {
    if (rng.float() < s.config.perritaTileChance) {
      changePerritas(s, p.id, 1, 'Casilla Perrita');
      return { title: '¡+1 Perrita!', text: 'La casilla dorada te premió.', tone: 'great' };
    }
    const got = changePemolares(s, p.id, s.config.perritaTileFallback, 'Casilla Perrita');
    return { title: `+${got} Pemolares`, text: 'Casi… la Perrita se escapó.', tone: 'good' };
  },
});

registerTileType('choice', {
  label: 'Elección',
  description: 'Bifurcación: elige ruta al pasar.',
  resolve(s, p) {
    const got = changePemolares(s, p.id, s.config.choiceTileBonus, 'Cruce');
    return { title: got ? `+${got} Pemolares` : 'Cruce', text: 'Descanso en el cruce de caminos.', tone: 'good' };
  },
});

registerTileType('shop', {
  label: 'Tienda de Perritas',
  description: 'Compra Perritas con Pemolares al pasar o caer.',
  // La compra se maneja en turnManager (fase SHOP); caer aquí no da nada extra.
  resolve: () => ({ title: 'Tienda de Perritas', text: 'Vuelve pronto.', tone: 'neutral' }),
});

registerTileType('minigame', {
  label: 'Minijuego',
  description: 'Lanza un minijuego.',
  resolve(s, p, _t, { rng }) {
    let participants;
    if (s.config.tileMinigameParticipants === 'all' || s.order.length <= 2) participants = s.order.slice();
    else participants = [p.id, rng.pick(others(s, p.id))];
    return {
      title: participants.length === 2 ? '¡Duelo!' : '¡Minijuego!',
      text: participants.length === 2
        ? `${p.name} contra ${s.players[participants[1]].name}`
        : 'Todos a jugar',
      tone: 'great',
      minigame: { participants },
    };
  },
});

registerTileType('itemshop', {
  label: 'Tienda de objetos',
  description: 'Compra dados especiales y otros objetos al pasar o caer.',
  resolve: () => ({ title: 'Tienda de objetos', text: '', tone: 'neutral' }),
});

// Safari y Examen abren su propia fase en turnManager.
registerTileType('safari', { label: 'Safari', description: 'Apuesta Pemolares; si ganas, te llevas una acompañante.', resolve: () => null });
registerTileType('exam', { label: 'Examen', description: 'Una pregunta de CAP OR FACT para ti solo.', resolve: () => null });

registerTileType('place', { label: 'Entrada', description: 'Puedes entrar al lugar.', resolve: () => null });

registerTileType('ronda', {
  label: 'Ronda',
  description: 'Todos toman.',
  resolve(s, p, _t, { rng }) {
    if (!s.config.shotsEnabled) {
      for (const id of s.order) changePemolares(s, id, 2, 'Ronda en La Pérez');
      return { title: 'Ronda en La Pérez', text: 'Todos ganan 2 Pemolares.', tone: 'good' };
    }
    for (const id of s.order) giveShot(s, id, 1, 'Ronda en La Pérez', rng);
    return { title: '¡RONDA!', text: `Todos se toman un ${s.config.shotWord}.`, tone: 'great' };
  },
});

registerTileType('barra', {
  label: 'Barra libre',
  description: 'Reparte 3 shots a quien quieras.',
  resolve(s, p) {
    if (!s.config.shotsEnabled) {
      changePemolares(s, p.id, 6, 'Barra libre');
      return { title: 'Barra libre', text: '+6 Pemolares', tone: 'good' };
    }
    return { title: '¡Barra libre!', text: `${p.name} reparte 3 ${s.config.shotWord}s.`, tone: 'great', gift: 3 };
  },
});

// ---- CAOS: eventos acotados ----
export const CHAOS_EVENTS = [
  {
    id: 'lluvia', weight: 3, strong: false,
    run(s, p, { rng }) {
      const n = rng.int(5, 10);
      changePemolares(s, p.id, n, 'Lluvia de Pemolares');
      return { title: 'Lluvia de Pemolares', text: `+${n} Pemolares`, tone: 'good' };
    },
  },
  {
    id: 'escudo', weight: 2, strong: false,
    run(s, p) {
      p.shield = true;
      return { title: 'Burbuja escudo', text: 'Bloquea tu próxima pérdida.', tone: 'good' };
    },
  },
  {
    id: 'fiesta', weight: 2, strong: false,
    run(s) {
      for (const id of s.order) changePemolares(s, id, 3, 'Fiesta');
      return { title: '¡Fiesta!', text: 'Todos ganan 3 Pemolares.', tone: 'good' };
    },
  },
  {
    id: 'robin', weight: 2, strong: true,
    run(s, p) {
      const rivals = others(s, p.id).sort((a, b) => s.players[b].pemolares - s.players[a].pemolares);
      const rich = rivals[0];
      if (!rich || !s.players[rich].pemolares) return { title: 'Ladrón torpe', text: 'Nadie tenía Pemolares.', tone: 'neutral' };
      if (s.players[rich].shield) {
        s.players[rich].shield = false;
        return { title: 'Robo bloqueado', text: `${s.players[rich].name} tenía escudo.`, tone: 'neutral' };
      }
      const n = transferPemolares(s, rich, p.id, 5, 'Robin Gomita');
      return { title: 'Robin Gomita', text: `Tomas ${n} Pemolares de ${s.players[rich].name}.`, tone: 'good' };
    },
  },
  {
    id: 'impuesto', weight: 2, strong: true,
    run(s, p) {
      let paid = 0;
      for (const id of others(s, p.id)) paid += transferPemolares(s, p.id, id, 2, 'Impuesto del caos');
      return { title: 'Impuesto del caos', text: `Repartes ${paid} Pemolares a tus rivales.`, tone: 'bad' };
    },
  },
  {
    id: 'canon', weight: 1.5, strong: true,
    run(s, p, { rng, board }) {
      const options = board.order.filter((id) => !['shop', 'itemshop', 'start', 'safari', 'exam', 'barra'].includes(board.tiles[id].type) && id !== p.tileId);
      const to = rng.pick(options);
      p.tileId = to;
      return { title: 'Cañón de confeti', text: `¡Saliste volando a ${board.regions[board.tiles[to].region].name}!`, tone: 'neutral', warpTo: to };
    },
  },
  {
    id: 'brindis', weight: 2, strong: false, needsShots: true,
    run(s, p, { rng }) {
      for (const id of s.order) giveShot(s, id, 1, 'Brindis', rng);
      return { title: '¡Salud!', text: `Brindis: todos se toman un ${s.config.shotWord}.`, tone: 'great' };
    },
  },
  {
    id: 'cascada', weight: 1.5, strong: true, needsShots: true,
    run(s, p, { rng }) {
      const start = s.order.indexOf(p.id);
      const ordered = s.order.slice(start).concat(s.order.slice(0, start));
      for (const id of ordered) giveShot(s, id, 1, 'Cascada', rng);
      return { title: 'Cascada', text: `Empezando por ${p.name}, todos toman en orden.`, tone: 'great' };
    },
  },
  {
    id: 'elige', weight: 2, strong: true, needsShots: true,
    run(s, p) {
      return { title: 'Elige a alguien', text: `${p.name} manda un ${s.config.shotWord}.`, tone: 'great', gift: 1 };
    },
  },
  {
    id: 'duelo', weight: 2, strong: true, needsMinigame: true,
    run(s, p, { rng }) {
      const rival = rng.pick(others(s, p.id));
      return {
        title: 'Duelo del caos',
        text: `${p.name} reta a ${s.players[rival].name}`,
        tone: 'great',
        minigame: { participants: [p.id, rival] },
      };
    },
  },
];

registerTileType('chaos', {
  label: 'Caos',
  description: 'Evento aleatorio acotado.',
  resolve(s, p, tile, api) {
    p.stats.chaosHits += 1;
    const f = s.config.chaosFrequency;
    if (f <= 0) return { title: 'Calma', text: 'El caos está dormido.', tone: 'neutral' };
    const pool = CHAOS_EVENTS.filter((e) => (!e.needsMinigame || api.hasMinigames()) && (!e.needsShots || s.config.shotsEnabled)).map((e) => ({
      ...e,
      weight: e.strong ? e.weight * f : e.weight,
    }));
    const ev = api.rng.weighted(pool);
    return { chaosId: ev.id, ...ev.run(s, p, api) };
  },
});
