// Configuración por defecto del tablero. Todo es ajustable desde el panel del host
// y se valida/normaliza en el servidor con `normalizeConfig` antes de usarse.

export const DEFAULT_CONFIG = {
  // Dado
  diceMin: 1,
  diceMax: 6, // cambia a 10 para un dado de 1–10

  // Economía
  startingPemolares: 10,
  perritaPrice: 20,
  startingPerritas: 0,
  allowNegativePemolares: false,
  pemolarPlusMin: 3,
  pemolarPlusMax: 8,
  pemolarMinusMin: 3,
  pemolarMinusMax: 5,
  passStartBonus: 3, // Pemolares por pasar por la salida
  perritaTileChance: 0.3, // probabilidad de que la casilla Perrita entregue una Perrita
  perritaTileFallback: 8, // si no sale la Perrita, entrega estos Pemolares
  choiceTileBonus: 2,

  // Recompensas de minijuegos
  minigameRewards: { first: 10, second: 6, participation: 3 },

  // Partida
  totalRounds: 10,
  boardLength: 'normal', // corto | normal | largo
  boardBranches: true, // false quita los atajos
  minigameEveryNRounds: 1, // 0 = sin minijuego común al final de cada ronda
  tileMinigameParticipants: 'duel', // all | duel
  enabledMinigames: ['cap-or-fact', 'skill-issue'],
  chaosFrequency: 1, // 0 = casillas de caos neutralizadas, 1 = normal, 2 = el doble de eventos fuertes

  // Fin de partida
  endBonuses: { minigameKing: true, richest: true, chaosMagnet: false },
  pemolaresTiebreak: true,

  // Tiempos (segundos). 0 = sin límite.
  turnTimeoutSec: 30,

  // Tienda de objetos
  maxItems: 3,
  itemPrices: { double: 10, triple: 18, choice: 15, slow: 5, shield: 8, bell: 30, steal: 12, pass: 10, water: 6 },

  // Modo fiesta (shots)
  shotsEnabled: true,
  shotWord: 'shot', // shot | trago
  shotLimit: 0, // 0 = sin límite

  // Retos de Las Vegas (los escribe el host) y sus premios
  challenges: [],
  challengePemolares: 10,
  challengePerritas: 1,

  // Nombres que el host da a los 10 personajes ('' = "Personaje N")
  characterNames: ['', '', '', '', '', '', '', '', '', ''],
};

const clampInt = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return d;
  return Math.max(lo, Math.min(hi, n));
};
const clampNum = (v, lo, hi, d) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.max(lo, Math.min(hi, n));
};
const oneOf = (v, opts, d) => (opts.includes(v) ? v : d);

/** Normaliza una configuración enviada por el cliente. Nunca confía en el cliente. */
export function normalizeConfig(input = {}, knownMinigames = []) {
  const d = DEFAULT_CONFIG;
  const c = { ...d, ...input };
  const out = {};
  out.diceMin = clampInt(c.diceMin, 1, 9, d.diceMin);
  out.diceMax = clampInt(c.diceMax, out.diceMin + 1, 10, d.diceMax);
  out.startingPemolares = clampInt(c.startingPemolares, 0, 200, d.startingPemolares);
  out.startingPerritas = clampInt(c.startingPerritas, 0, 5, d.startingPerritas);
  out.perritaPrice = clampInt(c.perritaPrice, 1, 200, d.perritaPrice);
  out.allowNegativePemolares = Boolean(c.allowNegativePemolares);
  out.pemolarPlusMin = clampInt(c.pemolarPlusMin, 0, 50, d.pemolarPlusMin);
  out.pemolarPlusMax = clampInt(c.pemolarPlusMax, out.pemolarPlusMin, 60, d.pemolarPlusMax);
  out.pemolarMinusMin = clampInt(c.pemolarMinusMin, 0, 50, d.pemolarMinusMin);
  out.pemolarMinusMax = clampInt(c.pemolarMinusMax, out.pemolarMinusMin, 60, d.pemolarMinusMax);
  out.passStartBonus = clampInt(c.passStartBonus, 0, 50, d.passStartBonus);
  out.perritaTileChance = clampNum(c.perritaTileChance, 0, 1, d.perritaTileChance);
  out.perritaTileFallback = clampInt(c.perritaTileFallback, 0, 60, d.perritaTileFallback);
  out.choiceTileBonus = clampInt(c.choiceTileBonus, 0, 20, d.choiceTileBonus);
  const r = { ...d.minigameRewards, ...(c.minigameRewards || {}) };
  out.minigameRewards = {
    first: clampInt(r.first, 0, 100, d.minigameRewards.first),
    second: clampInt(r.second, 0, 100, d.minigameRewards.second),
    participation: clampInt(r.participation, 0, 100, d.minigameRewards.participation),
  };
  out.totalRounds = clampInt(c.totalRounds, 1, 50, d.totalRounds);
  out.boardLength = oneOf(c.boardLength, ['corto', 'normal', 'largo'], d.boardLength);
  out.boardBranches = c.boardBranches !== false && c.boardBranches !== 'false';
  out.minigameEveryNRounds = clampInt(c.minigameEveryNRounds, 0, 10, d.minigameEveryNRounds);
  out.tileMinigameParticipants = oneOf(c.tileMinigameParticipants, ['all', 'duel'], d.tileMinigameParticipants);
  const enabled = Array.isArray(c.enabledMinigames) ? c.enabledMinigames : d.enabledMinigames;
  out.enabledMinigames = knownMinigames.length
    ? enabled.filter((id) => knownMinigames.includes(id))
    : enabled.slice();
  out.chaosFrequency = clampNum(c.chaosFrequency, 0, 2, d.chaosFrequency);
  const b = { ...d.endBonuses, ...(c.endBonuses || {}) };
  out.endBonuses = {
    minigameKing: Boolean(b.minigameKing),
    richest: Boolean(b.richest),
    chaosMagnet: Boolean(b.chaosMagnet),
  };
  out.pemolaresTiebreak = c.pemolaresTiebreak !== false && c.pemolaresTiebreak !== 'false';
  out.turnTimeoutSec = clampInt(c.turnTimeoutSec, 0, 300, d.turnTimeoutSec);
  out.maxItems = clampInt(c.maxItems, 1, 6, d.maxItems);
  const ip = { ...d.itemPrices, ...(c.itemPrices || {}) };
  out.itemPrices = Object.fromEntries(Object.keys(d.itemPrices).map((k) => [k, clampInt(ip[k], 0, 200, d.itemPrices[k])]));
  out.shotsEnabled = c.shotsEnabled !== false && c.shotsEnabled !== 'false';
  out.shotWord = oneOf(c.shotWord, ['shot', 'trago'], d.shotWord);
  out.shotLimit = clampInt(c.shotLimit, 0, 99, d.shotLimit);
  out.challenges = (Array.isArray(c.challenges) ? c.challenges : []).map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 30);
  out.challengePemolares = clampInt(c.challengePemolares, 0, 100, d.challengePemolares);
  out.challengePerritas = clampInt(c.challengePerritas, 0, 5, d.challengePerritas);
  const names = Array.isArray(c.characterNames) ? c.characterNames : d.characterNames;
  out.characterNames = Array.from({ length: 10 }, (_, i) => String(names[i] ?? '').trim().slice(0, 16));
  return out;
}
