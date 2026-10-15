// Las Vegas: tablero exprés de 10 casillas al que viajan todos desde la
// casilla "Bachelor of Abdo". Cada jugador da un turno y regresan al mapa principal.

export const DEFAULT_CHALLENGES = [
  'Baila 20 segundos la canción que elija el grupo',
  'Cuenta un chisme que nadie sepa',
  'Imita a otro jugador hasta que adivinen quién es',
  'Manda un audio cantando a tu último chat',
  'Haz 10 sentadillas sin soltar tu vaso',
  'Di un trabalenguas sin equivocarte',
  'Habla con acento argentino hasta tu próximo turno',
  'Deja que el grupo te ponga un apodo por el resto de la partida',
  'Haz tu mejor pose de modelo para una foto',
  'Cuenta tu peor cita en 30 segundos',
];

// s = shot (1–3) · g = repartir shots · p = reto de Pemolares · r = reto de Perritas
const LOOP = ['vstart', 'vshot', 'vpem', 'vgive', 'vshot', 'vper', 'vshot', 'vgive', 'vpem', 'vshot'];

export function buildVegasBoard() {
  const tiles = {};
  const order = [];
  const n = LOOP.length;
  LOOP.forEach((type, i) => {
    const ang = Math.PI / 2 + (i / n) * Math.PI * 2;
    const id = `V${i + 1}`;
    tiles[id] = {
      id,
      x: Math.round(800 + Math.cos(ang) * 560),
      y: Math.round(520 + Math.sin(ang) * 300),
      type,
      region: 'vegas',
      segment: 'V',
      next: [`V${((i + 1) % n) + 1}`],
    };
    order.push(id);
  });
  return {
    theme: 'vegas',
    width: 1600,
    height: 1000,
    startId: 'V1',
    tiles,
    order,
    regions: { vegas: { name: 'Las Vegas' } },
    edges: order.map((id) => [id, tiles[id].next[0]]),
  };
}
