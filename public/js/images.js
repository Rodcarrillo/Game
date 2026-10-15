// Rutas de imágenes. El empaquetado del artefacto reemplaza este módulo por
// uno con las imágenes incrustadas (data URIs).
export const CHAR_SRC = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`c${i + 1}`, `/img/chars/c${i + 1}.webp`]));
export const PEMOL_LOGO = '/img/pemol-logo.png';
