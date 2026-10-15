// Objetos de la tienda de objetos. `kind`:
//   dice     se usa antes de tirar y cambia el dado de ese turno (uno por turno)
//   instant  se usa antes de tirar y tiene efecto inmediato
//   warp     se usa antes de tirar y reemplaza la tirada (termina el turno)
//   passive  se activa solo cuando te toca un shot
export const ITEMS = {
  double: { id: 'double', name: 'Dado doble', desc: 'Tira 2 dados y avanza la suma.', kind: 'dice' },
  triple: { id: 'triple', name: 'Dado triple', desc: 'Tira 3 dados y avanza la suma.', kind: 'dice' },
  choice: { id: 'choice', name: 'Dado a elección', desc: 'Tú eliges el número exacto.', kind: 'dice' },
  slow: { id: 'slow', name: 'Dado lento', desc: 'Tira de 1 a 3, para caer justo donde quieres.', kind: 'dice' },
  shield: { id: 'shield', name: 'Escudo', desc: 'Bloquea tu próxima pérdida de Pemolares.', kind: 'instant' },
  bell: { id: 'bell', name: 'Campana', desc: 'Te lleva a la tienda de Perritas más cercana.', kind: 'warp' },
  steal: { id: 'steal', name: 'Robo', desc: 'Le quitas un objeto a un rival.', kind: 'instant' },
  pass: { id: 'pass', name: 'Pasa el shot', desc: 'Tu próximo shot se lo toma otro.', kind: 'passive', shots: true },
  water: { id: 'water', name: 'Vaso de agua', desc: 'Te salva de tu próximo shot.', kind: 'passive', shots: true },
};

export const ITEM_IDS = Object.keys(ITEMS);

export function itemCatalog(config) {
  return ITEM_IDS
    .filter((id) => config.shotsEnabled || !ITEMS[id].shots)
    .map((id) => ({ ...ITEMS[id], price: config.itemPrices[id] }));
}
