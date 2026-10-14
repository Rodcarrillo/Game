// CAP OR FACT — ¿mentira (cap) o dato real (fact)? Todos responden a la vez.
// Correcto = 100 pts + bono de rapidez (30/20/10 para los tres primeros correctos).

const STATEMENTS = [
  ['Los pulpos tienen tres corazones.', 'fact'],
  ['La miel puede durar miles de años sin echarse a perder.', 'fact'],
  ['Un día en Venus dura más que un año en Venus.', 'fact'],
  ['Los plátanos son ligeramente radiactivos.', 'fact'],
  ['El corazón de una ballena azul pesa más de 150 kilos.', 'fact'],
  ['Los flamencos son rosas por lo que comen.', 'fact'],
  ['Las nutrias marinas se toman de las manos al dormir.', 'fact'],
  ['El animal nacional de Escocia es el unicornio.', 'fact'],
  ['El chocolate es tóxico para los perros.', 'fact'],
  ['La Torre Eiffel puede crecer unos centímetros en verano por el calor.', 'fact'],
  ['Los tiburones existían antes que los árboles.', 'fact'],
  ['Cleopatra vivió más cerca de la llegada a la Luna que de la construcción de la Gran Pirámide.', 'fact'],
  ['Botánicamente, el plátano es una baya y la fresa no.', 'fact'],
  ['Los koalas pueden dormir hasta 20 horas al día.', 'fact'],
  ['El aguacate es una fruta.', 'fact'],
  ['Australia es más ancha que la Luna.', 'fact'],
  ['La Gran Muralla China se ve a simple vista desde la Luna.', 'cap'],
  ['Los peces dorados sólo tienen 3 segundos de memoria.', 'cap'],
  ['Los toros se enojan por el color rojo.', 'cap'],
  ['Los murciélagos son ciegos.', 'cap'],
  ['Los humanos sólo usamos el 10% del cerebro.', 'cap'],
  ['Los avestruces esconden la cabeza en la tierra cuando tienen miedo.', 'cap'],
  ['Un rayo nunca cae dos veces en el mismo lugar.', 'cap'],
  ['El Everest es la montaña más alta medida desde su base hasta la cima.', 'cap'],
  ['Napoleón era muy bajito para su época.', 'cap'],
  ['Los camellos guardan agua en sus jorobas.', 'cap'],
  ['Un chicle tragado se queda 7 años en tu estómago.', 'cap'],
  ['Las tortugas pueden salirse de su caparazón.', 'cap'],
  ['México tiene una sola zona horaria.', 'cap'],
  ['Hay pingüinos salvajes en el Polo Norte.', 'cap'],
  ['Mercurio es el planeta más caliente del sistema solar.', 'cap'],
  ['Botánicamente, el tomate es una verdura.', 'cap'],
];

const QUESTIONS = 4;
const ASK_MS = 9000;
const REVEAL_MS = 3200;
const SPEED_BONUS = [30, 20, 10];

function toReveal(d) {
  const q = d.questions[d.qIndex];
  const ans = d.answers[d.qIndex] || {};
  const correctOrder = Object.entries(ans)
    .filter(([, v]) => v.a === q.answer)
    .sort((a, b) => a[1].t - b[1].t)
    .map(([pid]) => pid);
  const result = {};
  for (const pid of d.participants) {
    const a = ans[pid]?.a || null;
    const ok = a === q.answer;
    const rank = correctOrder.indexOf(pid);
    const pts = ok ? 100 + (SPEED_BONUS[rank] || 0) : 0;
    d.points[pid] += pts;
    result[pid] = { a, ok, pts };
  }
  d.reveal = { correct: q.answer, result };
  d.step = 'reveal';
  d.wantTimerMs = REVEAL_MS;
}

export default {
  id: 'cap-or-fact',
  name: 'CAP OR FACT',
  tagline: '¿Dato real o puro cuento?',
  instructions: 'Lee la frase y elige FACT si es verdad o CAP si es mentira. Acertar rápido da puntos extra.',
  implemented: true,
  minPlayers: 2,
  controls: [
    { key: 'cap', label: 'CAP 🧢' },
    { key: 'fact', label: 'FACT ✅' },
  ],

  init({ participants, rng, now }) {
    const picks = rng.shuffle(STATEMENTS.map((s, i) => i)).slice(0, QUESTIONS);
    const d = {
      step: 'ask',
      qIndex: 0,
      participants: participants.slice(),
      questions: picks.map((i) => ({ text: STATEMENTS[i][0], answer: STATEMENTS[i][1] })),
      answers: {},
      points: Object.fromEntries(participants.map((p) => [p, 0])),
      askedAt: now,
      reveal: null,
      done: false,
      wantTimerMs: ASK_MS,
    };
    return d;
  },

  input(d, playerId, payload, { now }) {
    if (d.step !== 'ask') return false;
    const a = payload?.answer;
    if (a !== 'cap' && a !== 'fact') return false;
    d.answers[d.qIndex] = d.answers[d.qIndex] || {};
    if (d.answers[d.qIndex][playerId]) return false; // una sola respuesta
    d.answers[d.qIndex][playerId] = { a, t: now - d.askedAt };
    if (Object.keys(d.answers[d.qIndex]).length >= d.participants.length) toReveal(d);
    return true;
  },

  tick(d, { now }) {
    if (d.step === 'ask') return toReveal(d);
    if (d.step === 'reveal') {
      if (d.qIndex + 1 >= d.questions.length) {
        d.done = true;
        return;
      }
      d.qIndex += 1;
      d.step = 'ask';
      d.reveal = null;
      d.askedAt = now;
      d.wantTimerMs = ASK_MS;
    }
  },

  isDone: (d) => d.done,
  scores: (d) => ({ ...d.points }),
  scoreLabel: (d, pid) => `${d.points[pid]} pts`,

  publicView(d) {
    const q = d.questions[d.qIndex];
    return {
      step: d.step,
      qIndex: d.qIndex,
      total: d.questions.length,
      statement: q.text,
      answered: Object.keys(d.answers[d.qIndex] || {}),
      askMs: ASK_MS,
      reveal: d.reveal,
      points: d.points,
    };
  },

  privateView(d, playerId) {
    return { myAnswer: d.answers[d.qIndex]?.[playerId]?.a || null };
  },

  bot(d, playerId, rand) {
    if (d.step !== 'ask' || d.answers[d.qIndex]?.[playerId]) return null;
    const q = d.questions[d.qIndex];
    const right = rand() < 0.65;
    const answer = right ? q.answer : q.answer === 'cap' ? 'fact' : 'cap';
    return { key: `q${d.qIndex}`, payload: { answer }, delayMs: 1500 + rand() * 4500 };
  },
};
