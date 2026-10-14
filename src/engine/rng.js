// RNG determinista con estado serializable (mulberry32). El estado vive en la
// parte privada del juego y nunca se envía a los clientes.

export function seedFrom(value) {
  let h = 1779033703 ^ String(value).length;
  const s = String(value);
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** Devuelve [valor en [0,1), nuevoEstado] */
export function nextRandom(state) {
  let t = (state + 0x6d2b79f5) >>> 0;
  const newState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, newState];
}

/** Envoltorio mutable sobre un contenedor { rngState } */
export function makeRng(holder) {
  const rng = {
    float() {
      const [v, s] = nextRandom(holder.rngState);
      holder.rngState = s;
      return v;
    },
    int(min, max) {
      return min + Math.floor(rng.float() * (max - min + 1));
    },
    pick(arr) {
      return arr[Math.floor(rng.float() * arr.length)];
    },
    weighted(entries) {
      const total = entries.reduce((a, e) => a + Math.max(0, e.weight), 0);
      let r = rng.float() * total;
      for (const e of entries) {
        r -= Math.max(0, e.weight);
        if (r < 0) return e;
      }
      return entries[entries.length - 1];
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng.float() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
  return rng;
}
