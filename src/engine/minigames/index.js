// MiniGameBridge: registro de minijuegos. Cada minijuego implementa:
//   init({participants, rng, now, config}) → data
//   input(data, playerId, payload, {now}) → boolean (aceptado)
//   tick(data, {now})                      → avanza su paso interno
//   isDone(data) · scores(data) → {playerId: número (mayor = mejor)}
//   publicView(data) · privateView(data, playerId) · bot(data, playerId, rand)
// y fija `data.wantTimerMs` cuando necesita que el motor lo despierte.
//
// Los modos sin implementación aún aparecen en el panel del host como
// "próximamente" y el motor nunca los elige.

import capOrFact from './capOrFact.js';
import skillIssue from './skillIssue.js';

const placeholder = (id, name, tagline) => ({ id, name, tagline, implemented: false, minPlayers: 2 });

const LIST = [
  placeholder('gg-did-it', 'GG DID IT?', 'Próximamente en el tablero'),
  placeholder('snake-in-the-room', 'SNAKE IN THE ROOM', 'Próximamente en el tablero'),
  skillIssue,
  capOrFact,
  placeholder('out-of-pocket', 'OUT OF POCKET', 'Próximamente en el tablero'),
  placeholder('chaos-engine', 'CHAOS ENGINE', 'Próximamente en el tablero'),
];

export const MINIGAMES = Object.fromEntries(LIST.map((g) => [g.id, g]));

export function registerMinigame(def) {
  MINIGAMES[def.id] = def;
}

export function listMinigames() {
  return Object.values(MINIGAMES).map((g) => ({
    id: g.id,
    name: g.name,
    tagline: g.tagline,
    implemented: !!g.implemented,
    minPlayers: g.minPlayers,
  }));
}

export function eligibleMinigames(config, participantCount) {
  return (config.enabledMinigames || [])
    .map((id) => MINIGAMES[id])
    .filter((g) => g && g.implemented && participantCount >= (g.minPlayers || 1));
}
